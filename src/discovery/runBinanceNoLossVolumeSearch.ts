import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { BINANCE_FUTURES_SOURCE, loadBinanceFuturesCandles } from "../backtest/fetchBinanceFuturesCandles.js";
import { resolveStrategyCandles } from "../backtest/candleTimeframe.js";
import { buildDiscoveryIndicatorCache } from "./indicatorCache.js";
import { cartesian, mergeParams } from "./grids.js";
import { ALL_STRATEGIES, mergeMergedIndicatorReq, resolveStrategyGrids } from "./strategies/registry.js";
import { COMMON_DEFAULTS } from "./strategies/phasedGrids.js";
import { evaluateStableProfit, stableProfitSummary } from "./stableProfitEvaluation.js";
import { evaluateAutonomousVariant } from "./weeklyVolumeEvaluation.js";
import { writeJson } from "./progressive/output.js";
import type { DiscoveryMetrics, DiscoveryTrade, StrategyBacktestResult } from "./types.js";

const envNum = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const r = (v: number): number => Math.round(v * 1e6) / 1e6;

const tradeNotional = (t: DiscoveryTrade): number => t.qty * t.entryPrice + t.qty * t.exitPrice;

const PARAM_PROFILES: Record<string, number | string>[] = [
  {
    label: "fee4-vol12-balanced",
    atrPeriod: 14,
    atrMult: 1.5,
    riskPct: 0.25,
    leverage: 3,
    trailStart: 0.5,
    trailGap: 0.7,
    takeProfitPct: 0.8,
    maxHoldCandles: 120,
    cooldownCandles: 2,
    minMoveVsFeeMult: 4,
    minVolumeMult: 1.2,
    minAtrPct: 0.03,
    maxTradesPerDay: 20,
  },
  {
    label: "fee6-vol15-conservative",
    atrPeriod: 14,
    atrMult: 2,
    riskPct: 0.25,
    leverage: 3,
    trailStart: 0.8,
    trailGap: 1,
    takeProfitPct: 1.2,
    maxHoldCandles: 180,
    cooldownCandles: 3,
    minMoveVsFeeMult: 6,
    minVolumeMult: 1.5,
    minAtrPct: 0.05,
    maxTradesPerDay: 12,
  },
  {
    label: "fee8-vol15-slow",
    atrPeriod: 20,
    atrMult: 2.5,
    riskPct: 0.25,
    leverage: 2,
    trailStart: 1,
    trailGap: 1.2,
    takeProfitPct: 1.5,
    maxHoldCandles: 240,
    cooldownCandles: 5,
    minMoveVsFeeMult: 8,
    minVolumeMult: 1.5,
    minAtrPct: 0.08,
    maxTradesPerDay: 8,
  },
  {
    label: "fee10-vol20-strict",
    atrPeriod: 20,
    atrMult: 3,
    riskPct: 0.2,
    leverage: 2,
    trailStart: 1.2,
    trailGap: 1.5,
    takeProfitPct: 2,
    maxHoldCandles: 360,
    cooldownCandles: 8,
    minMoveVsFeeMult: 10,
    minVolumeMult: 2,
    minAtrPct: 0.1,
    maxTradesPerDay: 6,
  },
  {
    label: "fee5-vol12-more-volume",
    atrPeriod: 14,
    atrMult: 1.2,
    riskPct: 0.35,
    leverage: 3,
    trailStart: 0.4,
    trailGap: 0.6,
    takeProfitPct: 0.6,
    maxHoldCandles: 90,
    cooldownCandles: 1,
    minMoveVsFeeMult: 5,
    minVolumeMult: 1.2,
    minAtrPct: 0.03,
    maxTradesPerDay: 30,
  },
  {
    label: "fee6-vol10-wider",
    atrPeriod: 10,
    atrMult: 2,
    riskPct: 0.3,
    leverage: 3,
    trailStart: 0.8,
    trailGap: 1.2,
    takeProfitPct: 0,
    maxHoldCandles: 240,
    cooldownCandles: 3,
    minMoveVsFeeMult: 6,
    minVolumeMult: 1,
    minAtrPct: 0.05,
    maxTradesPerDay: 16,
  },
  {
    label: "fee12-vol20-rare",
    atrPeriod: 20,
    atrMult: 3,
    riskPct: 0.15,
    leverage: 2,
    trailStart: 1.5,
    trailGap: 2,
    takeProfitPct: 2.5,
    maxHoldCandles: 480,
    cooldownCandles: 12,
    minMoveVsFeeMult: 12,
    minVolumeMult: 2,
    minAtrPct: 0.12,
    maxTradesPerDay: 4,
  },
  {
    label: "fee4-vol15-medium-risk",
    atrPeriod: 14,
    atrMult: 1.8,
    riskPct: 0.5,
    leverage: 3,
    trailStart: 0.6,
    trailGap: 0.9,
    takeProfitPct: 1,
    maxHoldCandles: 180,
    cooldownCandles: 2,
    minMoveVsFeeMult: 4,
    minVolumeMult: 1.5,
    minAtrPct: 0.04,
    maxTradesPerDay: 15,
  },
];

type Candidate = {
  rank?: number;
  source: typeof BINANCE_FUTURES_SOURCE;
  symbol: string;
  timeframe: string;
  strategyName: string;
  params: Record<string, number | string>;
  score: number;
  passesNoLoss: boolean;
  failReasons: string[];
  metrics: DiscoveryMetrics;
  averageWeeklyNotionalVolume: number;
  averageTradesPerDay: number;
  maxWeeklyDrawdownPct: number;
  stableProfit: ReturnType<typeof stableProfitSummary>;
  dailyActive: {
    date: string;
    tradesCount: number;
    notionalVolumeUsdc: number;
    netPnL: number;
    fees: number;
  }[];
};

const noLossFailures = (m: DiscoveryMetrics): string[] => {
  const failures: string[] = [];
  if (m.netPnL < 0) failures.push("netPnL<0");
  if (m.profitFactor < 1) failures.push("profitFactor<1");
  if (m.maxDrawdownPct > 20) failures.push("maxDrawdownPct>20");
  if (m.tradesCount < 10) failures.push("tradesCount<10");
  if (m.totalFees > Math.max(1, m.grossPnL) * 2 && m.grossPnL > 0) failures.push("fees>2x_gross");
  return failures;
};

const scoreCandidate = (m: DiscoveryMetrics, weeklyNotional: number): number =>
  r(
    weeklyNotional +
      m.totalNotional * 0.02 +
      m.netPnL * 2000 -
      m.totalFees * 250 -
      m.maxDrawdownPct * 500 +
      Math.min(m.tradesCount, 500) * 10
  );

const dailyMetrics = (trades: DiscoveryTrade[]) => {
  const byDay = new Map<string, { date: string; tradesCount: number; notionalVolumeUsdc: number; netPnL: number; fees: number }>();
  for (const t of trades) {
    const date = new Date(t.entryTime).toISOString().slice(0, 10);
    const row = byDay.get(date) ?? { date, tradesCount: 0, notionalVolumeUsdc: 0, netPnL: 0, fees: 0 };
    row.tradesCount += 1;
    row.notionalVolumeUsdc += tradeNotional(t);
    row.netPnL += t.netPnL;
    row.fees += t.fees;
    byDay.set(date, row);
  }
  return [...byDay.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((d) => d.tradesCount > 0)
    .map((d) => ({
      date: d.date,
      tradesCount: d.tradesCount,
      notionalVolumeUsdc: r(d.notionalVolumeUsdc),
      netPnL: r(d.netPnL),
      fees: r(d.fees),
    }));
};

const consider = (list: Candidate[], item: Candidate, limit: number, key: (c: Candidate) => number) => {
  list.push(item);
  list.sort((a, b) => key(b) - key(a));
  if (list.length > limit) list.length = limit;
};

const hash = (candidate: Candidate): string =>
  crypto
    .createHash("md5")
    .update(`${candidate.symbol}:${candidate.timeframe}:${candidate.strategyName}:${JSON.stringify(candidate.params)}`)
    .digest("hex")
    .slice(0, 12);

const exportCandidateArtifacts = (candidate: Candidate, result: StrategyBacktestResult, outputDir: string) => {
  const id = hash(candidate);
  const tradesDir = path.join(outputDir, "trades");
  const equityDir = path.join(outputDir, "equity");
  fs.mkdirSync(tradesDir, { recursive: true });
  fs.mkdirSync(equityDir, { recursive: true });
  const tradeHistoryPath = path.join(tradesDir, `BINANCE_NO_LOSS_${candidate.strategyName}_${id}.json`);
  const equityCurvePath = path.join(equityDir, `BINANCE_NO_LOSS_${candidate.strategyName}_${id}.csv`);
  fs.writeFileSync(tradeHistoryPath, JSON.stringify(result.trades, null, 2));
  const lines = ["time,balance", `${result.metrics.startBalance},${result.metrics.startBalance}`];
  for (const t of result.trades) lines.push(`${t.exitTime},${t.balanceAfter}`);
  fs.writeFileSync(equityCurvePath, lines.join("\n"));
  return { tradeHistoryPath, equityCurvePath };
};

const buildReport = (payload: {
  generatedAt: string;
  testedVariants: number;
  bestNoLoss: Candidate | null;
  topNoLoss: Candidate[];
  topNearMiss: Candidate[];
  artifacts?: { tradeHistoryPath: string; equityCurvePath: string };
}) => {
  const row = (c: Candidate, i: number) =>
    `| ${i + 1} | ${c.strategyName} | ${c.timeframe} | ${c.metrics.totalNotional.toFixed(2)} | ${c.averageWeeklyNotionalVolume.toFixed(2)} | ${c.metrics.netPnL.toFixed(6)} | ${c.metrics.totalFees.toFixed(6)} | ${c.metrics.maxDrawdownPct.toFixed(4)}% | ${c.metrics.profitFactor.toFixed(4)} | ${c.metrics.tradesCount} | ${c.failReasons.join(", ") || "PASS"} |`;
  const best = payload.bestNoLoss;
  return `# Binance No-Loss Volume Search

Generated: ${payload.generatedAt}

## Verdict

${best ? `Best candidate: **${best.strategyName} ${best.timeframe}** with **${best.metrics.netPnL.toFixed(6)} USDC** net PnL and **${best.metrics.totalNotional.toFixed(2)} USDC** notional.` : "**No candidate passed** netPnL>=0, PF>=1, DD<=20%, trades>=10."}

## Search constraints

- Source: **${BINANCE_FUTURES_SOURCE}**
- Hard pass: netPnL >= 0, profitFactor >= 1, maxDrawdown <= 20%, trades >= 10
- Fee gate profiles: minMoveVsFeeMult 4-12, volume filters 1.0-2.0, cooldown and daily caps to avoid fee death
- Tested variants: ${payload.testedVariants}

## Best no-loss candidate

${best ? `\`\`\`json
${JSON.stringify(best.params, null, 2)}
\`\`\`

| Metric | Value |
|---|---:|
| Symbol | ${best.symbol} |
| Timeframe | ${best.timeframe} |
| Total notional | ${best.metrics.totalNotional.toFixed(2)} USDC |
| Avg weekly notional | ${best.averageWeeklyNotionalVolume.toFixed(2)} USDC |
| Net PnL | ${best.metrics.netPnL.toFixed(6)} USDC (${best.metrics.netPnLPct.toFixed(6)}%) |
| Gross PnL | ${best.metrics.grossPnL.toFixed(6)} USDC |
| Fees | ${best.metrics.totalFees.toFixed(6)} USDC |
| Profit factor | ${best.metrics.profitFactor.toFixed(6)} |
| Max drawdown | ${best.metrics.maxDrawdownPct.toFixed(6)}% |
| Trades | ${best.metrics.tradesCount} |
| Trades/day | ${best.metrics.tradesPerDay.toFixed(6)} |
| Active days | ${best.dailyActive.length} |
${payload.artifacts ? `| Trades artifact | \`${payload.artifacts.tradeHistoryPath}\` |
| Equity artifact | \`${payload.artifacts.equityCurvePath}\` |` : ""}
` : "_None._"}

## Top no-loss candidates

| Rank | Strategy | TF | Total notional | Avg weekly | Net PnL | Fees | Max DD | PF | Trades | Status |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|
${payload.topNoLoss.map(row).join("\n") || "| - | - | - | - | - | - | - | - | - | - | - |"}

## Top near misses

| Rank | Strategy | TF | Total notional | Avg weekly | Net PnL | Fees | Max DD | PF | Trades | Status |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|
${payload.topNearMiss.map(row).join("\n") || "| - | - | - | - | - | - | - | - | - | - | - |"}
`;
};

const main = async () => {
  const outputDir = path.resolve(process.env.BACKTEST_OUTPUT_DIR ?? "data/results");
  const cacheDir = path.resolve(process.env.BACKTEST_CACHE_DIR ?? "data/cache");
  const symbol = process.env.BINANCE_SYMBOL ?? "SOLUSDT";
  const months = envNum(process.env.BACKTEST_MONTHS, 6);
  const endTimeMs = envNum(process.env.BACKTEST_END_TIME_MS, Date.now());
  const initialBalance = envNum(process.env.BACKTEST_INITIAL_BALANCE, 100);
  const feeRate = envNum(process.env.BACKTEST_FEE_RATE, 0.00035);
  const leverage = envNum(process.env.BACKTEST_LEVERAGE, 3);
  const riskPct = envNum(process.env.BACKTEST_RISK_PCT, 0.25);
  const maxVariants = envNum(process.env.BINANCE_NO_LOSS_MAX_VARIANTS, 3000);
  const mode = (process.env.BINANCE_NO_LOSS_MODE as "quick" | "fast" | "full") ?? "fast";
  const timeframes = (process.env.BINANCE_NO_LOSS_TIMEFRAMES ?? "3m,5m,15m")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const load = await loadBinanceFuturesCandles(symbol, {
    cacheDir,
    months,
    endTimeMs,
    minCoveragePct: envNum(process.env.BINANCE_MIN_COVERAGE_PCT, 95),
  });

  const topNoLoss: Candidate[] = [];
  const topNearMiss: Candidate[] = [];
  let bestNoLossResult: StrategyBacktestResult | null = null;
  let bestNoLossCandidate: Candidate | null = null;
  let tested = 0;

  for (const timeframe of timeframes) {
    const candles = resolveStrategyCandles(load.candles, timeframe);
    const rangeStart = candles[0]!.openTime;
    const rangeEnd = (candles[candles.length - 1]?.closeTime ?? endTimeMs) + 1;
    const cache = buildDiscoveryIndicatorCache(candles, mergeMergedIndicatorReq());

    for (const strategy of ALL_STRATEGIES) {
      const entryCombos = cartesian(resolveStrategyGrids(strategy, mode).phase1);
      for (const entryParams of entryCombos) {
        for (const profile of PARAM_PROFILES) {
          if (tested >= maxVariants) break;
          tested += 1;
          const params = mergeParams(COMMON_DEFAULTS, entryParams, profile);
          const result = strategy.run({
            candles,
            cache,
            params,
            initialBalance,
            entryMode: "nextOpen",
            feeRate,
            leverage,
            riskPct,
            backtestMsSpan: rangeEnd - rangeStart,
          });
          const weekly = evaluateAutonomousVariant(result, rangeStart, rangeEnd, initialBalance);
          const stable = evaluateStableProfit(result, rangeStart, rangeEnd, initialBalance);
          const failReasons = noLossFailures(result.metrics);
          const candidate: Candidate = {
            source: BINANCE_FUTURES_SOURCE,
            symbol,
            timeframe,
            strategyName: result.strategyName,
            params: result.params,
            score: scoreCandidate(result.metrics, weekly.averageWeeklyNotionalVolume),
            passesNoLoss: failReasons.length === 0,
            failReasons,
            metrics: result.metrics,
            averageWeeklyNotionalVolume: weekly.averageWeeklyNotionalVolume,
            averageTradesPerDay: weekly.averageTradesPerDay,
            maxWeeklyDrawdownPct: weekly.maxWeeklyDrawdownPct,
            stableProfit: stableProfitSummary(stable),
            dailyActive: dailyMetrics(result.trades),
          };
          if (candidate.passesNoLoss) {
            consider(topNoLoss, candidate, 20, (c) => c.score);
            if (!bestNoLossCandidate || candidate.score > bestNoLossCandidate.score) {
              bestNoLossCandidate = candidate;
              bestNoLossResult = result;
            }
          } else {
            consider(topNearMiss, candidate, 20, (c) => c.score);
          }
        }
        if (tested >= maxVariants) break;
      }
      console.log(`[SEARCH] ${timeframe} ${strategy.strategyName} tested=${tested} best=${bestNoLossCandidate?.strategyName ?? "none"}`);
      if (tested >= maxVariants) break;
    }
    if (tested >= maxVariants) break;
  }

  const artifacts =
    bestNoLossCandidate && bestNoLossResult
      ? exportCandidateArtifacts(bestNoLossCandidate, bestNoLossResult, outputDir)
      : undefined;

  const payload = {
    generatedAt: new Date(endTimeMs).toISOString(),
    source: BINANCE_FUTURES_SOURCE,
    symbol,
    months,
    timeframes,
    cachePath: load.cachePath,
    quality: load.quality,
    testedVariants: tested,
    constraints: {
      netPnL: ">=0",
      profitFactor: ">=1",
      maxDrawdownPct: "<=20",
      tradesCount: ">=10",
    },
    bestNoLoss: bestNoLossCandidate ? { ...bestNoLossCandidate, artifacts } : null,
    topNoLoss: topNoLoss.map((c, i) => ({ ...c, rank: i + 1 })),
    topNearMiss: topNearMiss.map((c, i) => ({ ...c, rank: i + 1 })),
  };
  const jsonPath = path.join(outputDir, "binance-no-loss-volume-search.json");
  const reportPath = path.join(outputDir, "binance-no-loss-volume-search.md");
  writeJson(jsonPath, payload);
  fs.writeFileSync(reportPath, buildReport({ ...payload, artifacts }));

  console.log("\n=== BINANCE NO-LOSS VOLUME SEARCH COMPLETE ===\n");
  console.log(`Tested: ${tested}`);
  if (bestNoLossCandidate) {
    const m = bestNoLossCandidate.metrics;
    console.log(`Best: ${bestNoLossCandidate.strategyName} ${bestNoLossCandidate.timeframe}`);
    console.log(`  netPnL=${m.netPnL} fees=${m.totalFees} DD=${m.maxDrawdownPct}% PF=${m.profitFactor}`);
    console.log(`  notional=${m.totalNotional} trades=${m.tradesCount}`);
  } else {
    console.log("No no-loss candidate passed hard filters.");
  }
  console.log(`JSON: ${jsonPath}`);
  console.log(`Report: ${reportPath}\n`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
