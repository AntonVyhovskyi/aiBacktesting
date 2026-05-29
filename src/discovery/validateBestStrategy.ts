import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { loadOrDownloadO1MinuteCandles, CacheMissingError } from "../backtest/fetchO1Candles.js";
import { filterCandlesByRange, resolveStrategyCandles } from "../backtest/candleTimeframe.js";
import { buildDiscoveryIndicatorCache } from "./indicatorCache.js";
import { mergeParams } from "./grids.js";
import { atrVolatilityBreakout } from "./strategies/atrVolatilityBreakout.js";
import { COMMON_DEFAULTS } from "./strategies/phasedGrids.js";
import { computeMetrics } from "./metrics.js";
import { isFeeDeathSpiral } from "./volumePriority.js";
import type { DiscoveryTrade, StrategyDiagnostics } from "./types.js";

const num = (v: string | undefined, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const bool = (v: string | undefined, fb: boolean) =>
  !v ? fb : v === "1" || v.toLowerCase() === "true";

type WeekChunk = {
  weekIndex: number;
  startTime: string;
  endTime: string;
  tradesCount: number;
  totalVolume: number;
  grossPnL: number;
  totalFees: number;
  netPnL: number;
  maxDrawdownPct: number;
  wins: number;
  losses: number;
};

type Verdict =
  | "STABLE"
  | "UNSTABLE"
  | "OVERFIT_RISK"
  | "FEE_DEATH"
  | "LOW_SAMPLE_SIZE";

const computeStreaks = (trades: DiscoveryTrade[]) => {
  let longestWin = 0;
  let longestLoss = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const t of trades) {
    if (t.netPnL > 0) {
      curWin += 1;
      curLoss = 0;
      if (curWin > longestWin) longestWin = curWin;
    } else {
      curLoss += 1;
      curWin = 0;
      if (curLoss > longestLoss) longestLoss = curLoss;
    }
  }
  return { longestWinningStreak: longestWin, longestLosingStreak: longestLoss };
};

const weekMetrics = (
  trades: DiscoveryTrade[],
  startBalance: number,
  weekStart: number,
  weekEnd: number,
  weekIndex: number
): WeekChunk => {
  const slice = trades.filter((t) => t.entryTime >= weekStart && t.entryTime < weekEnd);
  const m = computeMetrics(slice, startBalance, weekEnd - weekStart);
  let peak = startBalance;
  let maxDd = 0;
  let equity = startBalance;
  for (const t of slice) {
    equity = t.balanceAfter;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    if (dd > maxDd) maxDd = dd;
  }
  return {
    weekIndex,
    startTime: new Date(weekStart).toISOString(),
    endTime: new Date(weekEnd - 1).toISOString(),
    tradesCount: slice.length,
    totalVolume: m.totalVolume,
    grossPnL: m.grossPnL,
    totalFees: m.totalFees,
    netPnL: m.netPnL,
    maxDrawdownPct: maxDd,
    wins: m.wins,
    losses: m.losses,
  };
};

const buildWeeklyChunks = (
  trades: DiscoveryTrade[],
  rangeStart: number,
  rangeEnd: number,
  startBalance: number
): WeekChunk[] => {
  const weekMs = 7 * 86400000;
  const chunks: WeekChunk[] = [];
  let wStart = rangeStart;
  let idx = 1;
  while (wStart < rangeEnd) {
    const wEnd = Math.min(wStart + weekMs, rangeEnd);
    chunks.push(weekMetrics(trades, startBalance, wStart, wEnd, idx));
    wStart = wEnd;
    idx += 1;
  }
  return chunks;
};

const computeVerdict = (input: {
  metrics: ReturnType<typeof computeMetrics>;
  weekly: WeekChunk[];
  subsetNetPnL: number;
  subsetMaxDd: number;
}): { verdict: Verdict; reasons: string[] } => {
  const { metrics, weekly, subsetMaxDd } = input;
  const reasons: string[] = [];

  if (metrics.tradesCount < 50) {
    reasons.push(`tradesCount=${metrics.tradesCount}<50`);
    return { verdict: "LOW_SAMPLE_SIZE", reasons };
  }

  if (isFeeDeathSpiral(metrics) || (metrics.grossPnL > 0 && metrics.totalFees >= metrics.grossPnL * 0.85)) {
    reasons.push("fees consume most or all gross profit");
    return { verdict: "FEE_DEATH", reasons };
  }

  if (metrics.maxDrawdownPct > 35 || metrics.maxDrawdownPct > subsetMaxDd * 2.5) {
    reasons.push(
      `maxDrawdownPct=${metrics.maxDrawdownPct.toFixed(2)}% elevated vs subset ${subsetMaxDd.toFixed(2)}%`
    );
    return { verdict: "UNSTABLE", reasons };
  }

  const totalNet = metrics.netPnL;
  if (totalNet > 0 && weekly.length > 0) {
    const bestWeek = weekly.reduce((a, b) => (b.netPnL > a.netPnL ? b : a), weekly[0]!);
    const share = bestWeek.netPnL / totalNet;
    if (share > 0.6 && weekly.filter((w) => w.netPnL > 0).length <= 2) {
      reasons.push(`one week contributes ${(share * 100).toFixed(1)}% of netPnL`);
      return { verdict: "OVERFIT_RISK", reasons };
    }
    const profitableWeeks = weekly.filter((w) => w.netPnL > 0).length;
    if (profitableWeeks < Math.ceil(weekly.length * 0.4) && totalNet > 0) {
      reasons.push(`only ${profitableWeeks}/${weekly.length} weeks profitable`);
      return { verdict: "OVERFIT_RISK", reasons };
    }
  }

  if (metrics.netPnL <= 0) {
    reasons.push(`netPnL=${metrics.netPnL.toFixed(2)} not positive on full 30d`);
    return { verdict: "UNSTABLE", reasons };
  }

  reasons.push("positive netPnL, acceptable drawdown, fees under control, no single-week dominance");
  return { verdict: "STABLE", reasons };
};

const main = async () => {
  const outputDir = path.resolve(process.env.BACKTEST_OUTPUT_DIR ?? "data/results");
  const discoveryPath = path.join(outputDir, "strategy-discovery-final.json");
  if (!fs.existsSync(discoveryPath)) {
    console.error(`Missing ${discoveryPath} — run strategy-search first.`);
    process.exit(1);
  }

  const discovery = JSON.parse(fs.readFileSync(discoveryPath, "utf8")) as {
    bestHighVolumeNearBreakeven?: {
      strategyName: string;
      params: Record<string, number | string>;
      netPnL: number;
      maxDrawdownPct: number;
      tradesCount: number;
    };
  };

  const best = discovery.bestHighVolumeNearBreakeven;
  if (!best) {
    console.error("bestHighVolumeNearBreakeven not found in discovery JSON.");
    process.exit(1);
  }

  const strategyName = best.strategyName;
  if (strategyName !== "ATR_VOLATILITY_BREAKOUT") {
    console.warn(`Expected ATR_VOLATILITY_BREAKOUT, got ${strategyName}`);
  }

  const strategy = atrVolatilityBreakout;
  const params = mergeParams(strategy.defaults, COMMON_DEFAULTS, best.params);

  const symbol = process.env.O1_SYMBOL ?? "SOLUSD";
  const marketId = num(process.env.O1_MARKET_ID, 2);
  const backtestDays = num(process.env.BACKTEST_DAYS, 30);
  const endTimeMs = Date.now();
  const startTimeMs = endTimeMs - backtestDays * 86400000;
  const initialBalance = num(process.env.BACKTEST_INITIAL_BALANCE, 1000);
  const entryMode = process.env.BACKTEST_ENTRY_MODE === "close" ? "close" : "nextOpen";
  const feeRate = num(process.env.BACKTEST_FEE_RATE, 0.00035);
  const leverage = num(process.env.BACKTEST_LEVERAGE, 5);
  const riskPct = num(process.env.BACKTEST_RISK_PCT, 1);

  let load;
  try {
    load = await loadOrDownloadO1MinuteCandles(
      { webServerUrl: process.env.O1_WEB_SERVER_URL ?? "https://zo-mainnet.n1.xyz", symbol, marketId },
      {
        cacheDir: path.resolve(process.env.BACKTEST_CACHE_DIR ?? "data/cache"),
        startTimeMs,
        endTimeMs,
        backtestDays,
        countback: 500,
        maxRetries: 5,
        retryDelayMs: 1500,
        forceRefresh: bool(process.env.BACKTEST_FORCE_REFRESH, false),
      }
    );
  } catch (e) {
    if (e instanceof CacheMissingError) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }

  const candles = resolveStrategyCandles(
    filterCandlesByRange(load.candles, startTimeMs, endTimeMs),
    process.env.BACKTEST_TIMEFRAME ?? "1m"
  );

  const maxCandlesEnv = process.env.BACKTEST_MAX_CANDLES;
  if (maxCandlesEnv && Number(maxCandlesEnv) > 0) {
    console.warn(
      `[VALIDATE] BACKTEST_MAX_CANDLES=${maxCandlesEnv} is set — ignoring for full 30d validation (using all ${candles.length} candles)`
    );
  }

  const spanMs =
    (candles[candles.length - 1]?.openTime ?? endTimeMs) - (candles[0]?.openTime ?? startTimeMs);
  const cache = buildDiscoveryIndicatorCache(candles, strategy.indicatorReq);

  const result = strategy.run({
    candles,
    cache,
    params,
    initialBalance,
    entryMode,
    feeRate,
    leverage,
    riskPct,
    backtestMsSpan: spanMs,
  });

  const metrics = result.metrics;
  const streaks = computeStreaks(result.trades);
  const rangeStart = candles[0]!.openTime;
  const rangeEnd = (candles[candles.length - 1]?.closeTime ?? endTimeMs) + 1;
  const weekly = buildWeeklyChunks(result.trades, rangeStart, rangeEnd, initialBalance);

  const { verdict, reasons } = computeVerdict({
    metrics,
    weekly,
    subsetNetPnL: best.netPnL,
    subsetMaxDd: best.maxDrawdownPct,
  });

  const equityCurve: { time: number; balance: number }[] = [
    { time: rangeStart, balance: initialBalance },
  ];
  for (const t of result.trades) {
    equityCurve.push({ time: t.exitTime, balance: t.balanceAfter });
  }

  const validationPayload = {
    generatedAt: new Date().toISOString(),
    validationType: "full_30d",
    symbol,
    marketId,
    timeframe: process.env.BACKTEST_TIMEFRAME ?? "1m",
    backtestDays,
    candleCount: candles.length,
    candleRange: {
      start: new Date(rangeStart).toISOString(),
      end: new Date(candles[candles.length - 1]!.openTime).toISOString(),
    },
    strategyName,
    params,
    execution: { initialBalance, entryMode, feeRate, leverage, riskPct },
    referenceSubset10k: {
      netPnL: best.netPnL,
      maxDrawdownPct: best.maxDrawdownPct,
      tradesCount: best.tradesCount,
    },
    metrics: {
      totalVolume: metrics.totalVolume,
      grossPnL: metrics.grossPnL,
      totalFees: metrics.totalFees,
      netPnL: metrics.netPnL,
      netPnLPct: metrics.netPnLPct,
      tradesCount: metrics.tradesCount,
      wins: metrics.wins,
      losses: metrics.losses,
      winRate: metrics.winRate,
      profitFactor: metrics.profitFactor,
      maxDrawdownPct: metrics.maxDrawdownPct,
      averageTradeDurationCandles: metrics.averageTradeDurationCandles,
      tradesPerDay: metrics.tradesPerDay,
      averagePnLPerTrade: metrics.averagePnLPerTrade,
      averageFeePerTrade: metrics.averageFeePerTrade,
      feesToVolumeRatio: metrics.feesToVolumeRatio,
      ...streaks,
    },
    diagnostics: result.diagnostics as StrategyDiagnostics,
    weeklyConsistency: weekly,
    verdict,
    verdictReasons: reasons,
    stayedProfitable: metrics.netPnL > 0,
    drawdownVsSubset: {
      subsetMaxDrawdownPct: best.maxDrawdownPct,
      fullMaxDrawdownPct: metrics.maxDrawdownPct,
      increasedSignificantly: metrics.maxDrawdownPct > best.maxDrawdownPct * 1.75,
    },
  };

  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "full-30d-validation.json");
  const equityPath = path.join(outputDir, "full-30d-equity.json");
  const tradesPath = path.join(outputDir, "full-30d-trades.json");

  fs.writeFileSync(jsonPath, JSON.stringify(validationPayload, null, 2));
  fs.writeFileSync(equityPath, JSON.stringify(equityCurve, null, 2));
  fs.writeFileSync(tradesPath, JSON.stringify(result.trades, null, 2));

  console.log("\n=== FULL 30-DAY VALIDATION ===\n");
  console.log(`Strategy: ${strategyName}`);
  console.log(`Params:   ${JSON.stringify(params)}`);
  console.log(`Candles:  ${candles.length} (full ${backtestDays}d, no max cap)`);
  console.log("\n--- Full 30d metrics ---");
  console.log(`  totalVolume:    ${metrics.totalVolume}`);
  console.log(`  grossPnL:       ${metrics.grossPnL}`);
  console.log(`  totalFees:      ${metrics.totalFees}`);
  console.log(`  netPnL:         ${metrics.netPnL} (${metrics.netPnLPct}%)`);
  console.log(`  trades:         ${metrics.tradesCount} (W${metrics.wins}/L${metrics.losses}) winRate=${metrics.winRate}%`);
  console.log(`  profitFactor:   ${metrics.profitFactor}`);
  console.log(`  maxDrawdownPct: ${metrics.maxDrawdownPct}% (subset was ${best.maxDrawdownPct}%)`);
  console.log(`  trades/day:     ${metrics.tradesPerDay}`);
  console.log(`  avg PnL/trade:  ${metrics.averagePnLPerTrade}`);
  console.log(`  streaks:        win=${streaks.longestWinningStreak} loss=${streaks.longestLosingStreak}`);

  console.log("\n--- Weekly breakdown ---");
  for (const w of weekly) {
    console.log(
      `  W${w.weekIndex} ${w.startTime.slice(0, 10)} → ${w.endTime.slice(0, 10)} | ` +
        `trades=${w.tradesCount} vol=${w.totalVolume.toFixed(2)} gross=${w.grossPnL.toFixed(2)} ` +
        `fees=${w.totalFees.toFixed(2)} net=${w.netPnL.toFixed(2)} dd=${w.maxDrawdownPct.toFixed(2)}%`
    );
  }

  console.log("\n--- Assessment ---");
  console.log(`  Stayed profitable: ${metrics.netPnL > 0}`);
  console.log(`  DD increased significantly: ${validationPayload.drawdownVsSubset.increasedSignificantly}`);
  console.log(`  VERDICT: ${verdict}`);
  console.log(`  Reasons: ${reasons.join("; ")}`);
  console.log(`\n  ${jsonPath}`);
  console.log(`  ${equityPath}`);
  console.log(`  ${tradesPath}\n`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
