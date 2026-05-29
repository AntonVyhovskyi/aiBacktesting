import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import {
  BINANCE_FUTURES_SOURCE,
  BinanceCacheMissingError,
  downloadBinanceFuturesCandles,
  loadBinanceFuturesCandles,
} from "../backtest/fetchBinanceFuturesCandles.js";
import { resolveStrategyCandles } from "../backtest/candleTimeframe.js";
import { buildDiscoveryIndicatorCache } from "./indicatorCache.js";
import { writeJson, exportArtifacts } from "./progressive/output.js";
import { mergeParams } from "./grids.js";
import { bollingerMeanReversion } from "./strategies/bollingerMeanReversion.js";
import { COMMON_DEFAULTS } from "./strategies/phasedGrids.js";
import { evaluateAutonomousVariant } from "./weeklyVolumeEvaluation.js";
import { evaluateStableProfit, stableProfitSummary } from "./stableProfitEvaluation.js";
import type { DiscoveryTrade, StrategyBacktestResult } from "./types.js";

const envNum = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const envBool = (v: string | undefined, fallback: boolean): boolean =>
  v === undefined ? fallback : v === "1" || v.toLowerCase() === "true";

const r = (v: number): number => Math.round(v * 1e6) / 1e6;

const BOLLINGER_NO_LOSS_PARAMS: Record<string, number | string> = {
  atrPeriod: 14,
  atrMult: 1.2,
  trailStart: 0.3,
  trailGap: 0.4,
  takeProfitPct: 0,
  breakEvenPct: 0,
  maxHoldCandles: 0,
  exitOnOppositeSignal: 1,
  cooldownCandles: 0,
  minAtrFilter: 0,
  minEmaDistancePct: 0,
  minMoveVsFeeMult: 0,
  minVolumeMult: 1.2,
  maxTradesPerDay: 30,
  bbPeriod: 20,
  riskPct: 1.5,
  leverage: 5,
};

const tradeNotional = (t: DiscoveryTrade): number => t.qty * t.entryPrice + t.qty * t.exitPrice;

const tradeSummary = (t: DiscoveryTrade) => ({
  direction: t.direction,
  entryTime: new Date(t.entryTime).toISOString(),
  exitTime: new Date(t.exitTime).toISOString(),
  entryPrice: t.entryPrice,
  exitPrice: t.exitPrice,
  qty: t.qty,
  notionalUsdc: r(tradeNotional(t)),
  grossPnL: t.grossPnL,
  fees: t.fees,
  netPnL: t.netPnL,
  balanceAfter: t.balanceAfter,
  exitReason: t.exitReason,
  durationCandles: t.durationCandles,
});

const buildDailyMetrics = (trades: DiscoveryTrade[]) => {
  const byDay = new Map<
    string,
    {
      date: string;
      tradesCount: number;
      notionalVolumeUsdc: number;
      grossPnL: number;
      totalFees: number;
      netPnL: number;
      wins: number;
      losses: number;
    }
  >();

  for (const t of trades) {
    const date = new Date(t.entryTime).toISOString().slice(0, 10);
    const row = byDay.get(date) ?? {
      date,
      tradesCount: 0,
      notionalVolumeUsdc: 0,
      grossPnL: 0,
      totalFees: 0,
      netPnL: 0,
      wins: 0,
      losses: 0,
    };
    row.tradesCount += 1;
    row.notionalVolumeUsdc += tradeNotional(t);
    row.grossPnL += t.grossPnL;
    row.totalFees += t.fees;
    row.netPnL += t.netPnL;
    if (t.netPnL > 0) row.wins += 1;
    else row.losses += 1;
    byDay.set(date, row);
  }

  return [...byDay.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({
      ...row,
      notionalVolumeUsdc: r(row.notionalVolumeUsdc),
      grossPnL: r(row.grossPnL),
      totalFees: r(row.totalFees),
      netPnL: r(row.netPnL),
    }));
};

const loadBinance = async (input: {
  symbol: string;
  cacheDir: string;
  months: number;
  endTimeMs: number;
  forceRefresh: boolean;
  minCoveragePct: number;
}) => {
  try {
    return await loadBinanceFuturesCandles(input.symbol, {
      cacheDir: input.cacheDir,
      months: input.months,
      endTimeMs: input.endTimeMs,
      forceRefresh: input.forceRefresh,
      minCoveragePct: input.minCoveragePct,
    });
  } catch (e) {
    if (!(e instanceof BinanceCacheMissingError)) throw e;
    console.warn(`${e.message}\n[BINANCE] cache missing; downloading now...`);
    return downloadBinanceFuturesCandles(input.symbol, "1m", {
      cacheDir: input.cacheDir,
      months: input.months,
      endTimeMs: input.endTimeMs,
      forceRefresh: true,
      minCoveragePct: input.minCoveragePct,
      requestDelayMs: envNum(process.env.BINANCE_REQUEST_DELAY_MS, 150),
      maxRetries: 8,
      retryDelayMs: 2000,
    });
  }
};

const buildMarkdownReport = (payload: {
  symbol: string;
  timeframe: string;
  cachePath: string;
  quality: { coveragePct: number; reliable: boolean; gaps: number; largestGapMinutes: number };
  candleCount: number;
  candleRange: { start: string; end: string };
  params: Record<string, number | string>;
  result: StrategyBacktestResult;
  stable: ReturnType<typeof stableProfitSummary>;
  weekly: ReturnType<typeof evaluateAutonomousVariant>["weekly"];
  dailyActive: ReturnType<typeof buildDailyMetrics>;
  paths: { jsonPath: string; tradeHistoryPath: string; equityCurvePath: string };
}) => {
  const { result, stable } = payload;
  const m = result.metrics;
  const monthlyLines = (stable.monthly ?? [])
    .map(
      (mo) =>
        `| ${mo.monthKey} | ${mo.isFullMonth ? "yes" : "partial"} | ${mo.tradesCount} | ${mo.volume.toFixed(2)} | ${mo.grossPnL.toFixed(6)} | ${mo.fees.toFixed(6)} | ${mo.netPnL.toFixed(6)} | ${mo.netPnLPct.toFixed(6)}% | ${mo.maxDrawdownPct.toFixed(4)}% | ${mo.profitFactor.toFixed(4)} |`
    )
    .join("\n");
  const weeklyLines = payload.weekly
    .map(
      (w) =>
        `| W${w.weekIndex} | ${w.startTime.slice(0, 10)} | ${w.isFullWeek ? "yes" : "partial"} | ${w.tradesCount} | ${w.notionalVolumeUsdc.toFixed(2)} | ${w.grossPnL.toFixed(6)} | ${w.totalFees.toFixed(6)} | ${w.netPnL.toFixed(6)} | ${w.maxDrawdownPct.toFixed(4)}% |`
    )
    .join("\n");
  const dailyLines = payload.dailyActive.length
    ? payload.dailyActive
        .map(
          (d) =>
            `- **${d.date}**: trades=${d.tradesCount}, notional=${d.notionalVolumeUsdc.toFixed(2)}, net=${d.netPnL.toFixed(6)}, fees=${d.totalFees.toFixed(6)}`
        )
        .join("\n")
    : "- No trading days.";
  const failed = stable.hardTargetFailures?.length ? stable.hardTargetFailures.join(", ") : "none";

  return `# Binance Bollinger No-Loss Volume Candidate — 6-Month Validation

## Verdict

**${m.netPnL >= 0 ? "PASS for no-loss" : "FAIL for no-loss"}** over the tested Binance Futures 6-month window.

This validates the fixed **BOLLINGER_MEAN_REVERSION** candidate from \`no-loss-volume-strategy-report.md\` on Binance Futures data. It answers whether the strategy still avoids losing money after fees; it does not claim stable monthly profitability.

## Setup

| Field | Value |
|---|---:|
| Source | ${BINANCE_FUTURES_SOURCE} |
| Symbol | ${payload.symbol} |
| Timeframe | ${payload.timeframe} |
| Candles | ${payload.candleCount.toLocaleString("en-US")} |
| Range start | ${payload.candleRange.start} |
| Range end | ${payload.candleRange.end} |
| Cache | \`${payload.cachePath}\` |
| Coverage | ${payload.quality.coveragePct}% |
| Reliable data | ${payload.quality.reliable ? "yes" : "no"} |
| Gaps | ${payload.quality.gaps} |
| Largest gap | ${payload.quality.largestGapMinutes} min |
| Start balance | ${m.startBalance.toFixed(2)} USDC |
| Fee rate | ${(envNum(process.env.BACKTEST_FEE_RATE, 0.00035) * 100).toFixed(4)}% per side |

## Parameters

\`\`\`json
${JSON.stringify(payload.params, null, 2)}
\`\`\`

## Full-period metrics

| Metric | Value |
|---|---:|
| End balance | ${m.endBalance.toFixed(6)} USDC |
| Net PnL after fees | ${m.netPnL.toFixed(6)} USDC (${m.netPnLPct.toFixed(6)}%) |
| Gross PnL | ${m.grossPnL.toFixed(6)} USDC |
| Total fees | ${m.totalFees.toFixed(6)} USDC |
| Total notional volume | ${m.totalNotional.toFixed(2)} USDC |
| Trades | ${m.tradesCount} |
| Trades/day | ${m.tradesPerDay.toFixed(6)} |
| Win rate | ${m.winRate.toFixed(6)}% |
| Profit factor | ${m.profitFactor.toFixed(6)} |
| Max drawdown | ${m.maxDrawdownPct.toFixed(6)}% |
| Avg monthly PnL | ${stable.averageMonthlyPnLPct.toFixed(6)}% |
| Worst monthly PnL | ${stable.worstMonthlyPnLPct.toFixed(6)}% |
| Profitable months | ${stable.profitableMonths} |
| Stable-profit hard failures | ${failed} |

## Monthly breakdown

| Month | Full | Trades | Notional USDC | Gross PnL | Fees | Net PnL | Net % | Max DD | PF |
|---|:---:|---:|---:|---:|---:|---:|---:|---:|---:|
${monthlyLines}

## Weekly breakdown

| Week | Start | Full | Trades | Notional USDC | Gross PnL | Fees | Net PnL | Max DD |
|---:|---|:---:|---:|---:|---:|---:|---:|---:|
${weeklyLines}

## Active days

${dailyLines}

## Artifacts

- JSON: \`${payload.paths.jsonPath}\`
- Trades: \`${payload.paths.tradeHistoryPath}\`
- Equity: \`${payload.paths.equityCurvePath}\`
`;
};

const main = async () => {
  const outputDir = path.resolve(process.env.BACKTEST_OUTPUT_DIR ?? "data/results");
  const jsonPath = path.join(outputDir, "binance-bollinger-no-loss-6m-validation.json");
  const mdPath = path.join(outputDir, "binance-bollinger-no-loss-6m-validation.md");

  const symbol = process.env.BINANCE_SYMBOL ?? process.env.ADAPTIVE_SYMBOLS?.split(",")[0]?.trim() ?? "SOLUSDT";
  const months = envNum(process.env.BACKTEST_MONTHS, 6);
  const initialBalance = envNum(process.env.BACKTEST_INITIAL_BALANCE, 100);
  const feeRate = envNum(process.env.BACKTEST_FEE_RATE, 0.00035);
  const leverage = envNum(process.env.BACKTEST_LEVERAGE, 5);
  const riskPct = envNum(process.env.BACKTEST_RISK_PCT, 1);
  const entryMode = process.env.BACKTEST_ENTRY_MODE === "close" ? "close" : "nextOpen";
  const timeframe = process.env.BACKTEST_TIMEFRAME ?? "1m";
  const endTimeMs = envNum(process.env.BACKTEST_END_TIME_MS, Date.now());
  const cacheDir = path.resolve(process.env.BACKTEST_CACHE_DIR ?? "data/cache");
  const minCoveragePct = envNum(process.env.BINANCE_MIN_COVERAGE_PCT, 95);
  const forceRefresh = envBool(process.env.BACKTEST_FORCE_REFRESH, false);

  const load = await loadBinance({
    symbol,
    cacheDir,
    months,
    endTimeMs,
    forceRefresh,
    minCoveragePct,
  });
  if (!load.quality.reliable) {
    console.warn(
      `[BINANCE] data quality warning: coverage=${load.quality.coveragePct}% gaps=${load.quality.gaps}`
    );
  }

  const candles = resolveStrategyCandles(load.candles, timeframe);
  const rangeStart = candles[0]!.openTime;
  const rangeEnd = (candles[candles.length - 1]?.closeTime ?? endTimeMs) + 1;
  const params = mergeParams(COMMON_DEFAULTS, BOLLINGER_NO_LOSS_PARAMS);
  const cache = buildDiscoveryIndicatorCache(candles, bollingerMeanReversion.indicatorReq);
  const result = bollingerMeanReversion.run({
    candles,
    cache,
    params,
    initialBalance,
    entryMode,
    feeRate,
    leverage,
    riskPct,
    backtestMsSpan: rangeEnd - rangeStart,
  });
  const weekly = evaluateAutonomousVariant(result, rangeStart, rangeEnd, initialBalance);
  const stable = evaluateStableProfit(result, rangeStart, rangeEnd, initialBalance);
  const paths = exportArtifacts(result, outputDir);
  const sorted = [...result.trades].sort((a, b) => b.netPnL - a.netPnL);

  const payload = {
    source: BINANCE_FUTURES_SOURCE,
    generatedFromRangeEnd: new Date(rangeEnd - 1).toISOString(),
    symbol,
    timeframe,
    cachePath: load.cachePath,
    quality: load.quality,
    candleCount: candles.length,
    candleRange: {
      start: new Date(rangeStart).toISOString(),
      end: new Date(rangeEnd - 1).toISOString(),
    },
    params,
    metrics: result.metrics,
    diagnostics: result.diagnostics,
    weeklyVolumeEvaluation: {
      averageWeeklyNotionalVolume: weekly.averageWeeklyNotionalVolume,
      averageTradesPerDay: weekly.averageTradesPerDay,
      profitableWeeks: weekly.profitableWeeks,
      losingWeeks: weekly.losingWeeks,
      nearBreakevenOrProfitableWeeks: weekly.nearBreakevenOrProfitableWeeks,
      maxWeeklyDrawdownPct: weekly.maxWeeklyDrawdownPct,
      hardTargetFailures: weekly.hardTargetFailures,
      passesHardTarget: weekly.passesHardTarget,
      weekly: weekly.weekly,
    },
    stableProfitEvaluation: stableProfitSummary(stable),
    dailyActive: buildDailyMetrics(result.trades),
    bestTrades: sorted.slice(0, 5).map(tradeSummary),
    worstTrades: sorted.slice(-5).reverse().map(tradeSummary),
    tradeHistoryPath: paths.tradeHistoryPath,
    equityCurvePath: paths.equityCurvePath,
  };

  writeJson(jsonPath, payload);
  fs.writeFileSync(
    mdPath,
    buildMarkdownReport({
      symbol,
      timeframe,
      cachePath: load.cachePath,
      quality: {
        coveragePct: load.quality.coveragePct,
        reliable: load.quality.reliable,
        gaps: load.quality.gaps,
        largestGapMinutes: load.quality.largestGapMinutes,
      },
      candleCount: candles.length,
      candleRange: payload.candleRange,
      params,
      result,
      stable: payload.stableProfitEvaluation,
      weekly: weekly.weekly,
      dailyActive: payload.dailyActive,
      paths: { jsonPath, ...paths },
    })
  );

  const m = result.metrics;
  console.log("\n=== BINANCE BOLLINGER NO-LOSS 6M VALIDATION ===\n");
  console.log(`Range: ${payload.candleRange.start} → ${payload.candleRange.end}`);
  console.log(`Symbol: ${symbol} | candles=${candles.length} | coverage=${load.quality.coveragePct}%`);
  console.log(`Net PnL: ${m.netPnL.toFixed(6)} USDC (${m.netPnLPct.toFixed(6)}%)`);
  console.log(`Gross: ${m.grossPnL.toFixed(6)} | Fees: ${m.totalFees.toFixed(6)}`);
  console.log(`Notional: ${m.totalNotional.toFixed(2)} USDC | Trades: ${m.tradesCount}`);
  console.log(`PF: ${m.profitFactor.toFixed(6)} | DD: ${m.maxDrawdownPct.toFixed(6)}%`);
  console.log(`Monthly: profitable=${stable.profitableMonths}, worst=${stable.worstMonthlyPnLPct}%`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Report: ${mdPath}\n`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
