import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { BINANCE_FUTURES_SOURCE, loadBinanceFuturesCandles } from "../backtest/fetchBinanceFuturesCandles.js";
import { resolveStrategyCandles } from "../backtest/candleTimeframe.js";
import { buildDiscoveryIndicatorCache } from "./indicatorCache.js";
import { mergeParams } from "./grids.js";
import { atrVolatilityBreakout } from "./strategies/atrVolatilityBreakout.js";
import { COMMON_DEFAULTS } from "./strategies/phasedGrids.js";
import { buildMonthlyProfitMetrics } from "./stableProfitEvaluation.js";
import { buildRollingWalkForwardSlices } from "./regime/walkForward.js";
import { writeJson } from "./progressive/output.js";
import type { NormalizedCandle } from "../backtest/types.js";
import type { StrategyBacktestResult } from "./types.js";

const envNum = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const r = (v: number): number => Math.round(v * 1e6) / 1e6;

const TARGET_MONTHLY_NOTIONAL = 50_000;
const TARGET_MAX_DD = 5;

const WINNER_PARAMS: Record<string, number | string> = {
  atrPeriod: 14,
  atrMult: 1.2,
  trailStart: 0.4,
  trailGap: 0.6,
  takeProfitPct: 0.6,
  breakEvenPct: 0,
  maxHoldCandles: 90,
  exitOnOppositeSignal: 1,
  cooldownCandles: 1,
  minAtrFilter: 0,
  minEmaDistancePct: 0,
  minMoveVsFeeMult: 5,
  minVolumeMult: 1.1,
  maxTradesPerDay: 45,
  lookback: 8,
  breakoutMult: 1,
  stopMult: 0.45,
  label: "r30-l3-volume",
  riskPct: 0.3,
  leverage: 3,
  minAtrPct: 0.03,
};

const TOP5: { rank: number; params: Record<string, number | string> }[] = [
  { rank: 1, params: { ...WINNER_PARAMS } },
  {
    rank: 2,
    params: {
      ...WINNER_PARAMS,
      atrPeriod: 20,
      lookback: 10,
    },
  },
  {
    rank: 3,
    params: {
      ...WINNER_PARAMS,
      trailStart: 0.3,
      trailGap: 0.5,
      takeProfitPct: 0.45,
      maxHoldCandles: 60,
      cooldownCandles: 0,
      minVolumeMult: 1.2,
      label: "r30-l5-fast-tp",
      leverage: 5,
    },
  },
  {
    rank: 4,
    params: {
      ...WINNER_PARAMS,
      atrPeriod: 20,
    },
  },
  {
    rank: 5,
    params: {
      ...WINNER_PARAMS,
      trailStart: 0.35,
      trailGap: 0.55,
      takeProfitPct: 0.5,
      maxHoldCandles: 75,
      cooldownCandles: 0,
      minMoveVsFeeMult: 4,
      minVolumeMult: 1,
      maxTradesPerDay: 60,
      lookback: 10,
      breakoutMult: 0.8,
      stopMult: 0.35,
      label: "r20-l5-tight-more-trades",
      riskPct: 0.2,
      leverage: 5,
      minAtrPct: 0.02,
    },
  },
];

const CLOUD_EXPECTED = {
  endBalance: 660.268462,
  netPnL: 160.268462,
  avgMonthlyNotional: 52406.491553,
  minMonthlyNotional: 37071.325513,
  maxDrawdownPct: 4.424832,
  profitFactor: 1.462911,
  tradesCount: 247,
};

type Snapshot = {
  label: string;
  symbol: string;
  timeframe: string;
  params: Record<string, number | string>;
  metrics: StrategyBacktestResult["metrics"];
  avgMonthlyNotional: number;
  minMonthlyNotional: number;
  maxMonthlyDrawdownPct: number;
  profitableMonths: number;
  losingMonths: number;
  monthly: ReturnType<typeof buildMonthlyProfitMetrics>;
  failReasons: string[];
};

const evaluate = (result: StrategyBacktestResult, rangeStart: number, rangeEnd: number, initialBalance: number) => {
  const monthly = buildMonthlyProfitMetrics(result.trades, rangeStart, rangeEnd, initialBalance);
  const fullMonths = monthly.filter((m) => m.isFullMonth);
  const months = fullMonths.length ? fullMonths : monthly;
  const avgMonthlyNotional = months.length ? r(months.reduce((s, m) => s + m.volume, 0) / months.length) : 0;
  const minMonthlyNotional = months.length ? r(Math.min(...months.map((m) => m.volume))) : 0;
  const maxMonthlyDrawdownPct = months.length ? r(Math.max(...months.map((m) => m.maxDrawdownPct))) : 0;
  const failReasons: string[] = [];
  if (avgMonthlyNotional < TARGET_MONTHLY_NOTIONAL) failReasons.push("avgMonthlyNotional<50k");
  if (minMonthlyNotional < TARGET_MONTHLY_NOTIONAL) failReasons.push("minMonthlyNotional<50k");
  if (maxMonthlyDrawdownPct > TARGET_MAX_DD) failReasons.push("monthlyDD>5");
  if (result.metrics.maxDrawdownPct > TARGET_MAX_DD) failReasons.push("fullDD>5");
  if (result.metrics.netPnL < 0) failReasons.push("netPnL<0");
  if (result.metrics.profitFactor < 1) failReasons.push("PF<1");
  return {
    monthly,
    avgMonthlyNotional,
    minMonthlyNotional,
    maxMonthlyDrawdownPct,
    profitableMonths: months.filter((m) => m.netPnL > 0).length,
    losingMonths: months.filter((m) => m.netPnL < 0).length,
    failReasons,
  };
};

const runStrategy = (
  candles: NormalizedCandle[],
  params: Record<string, number | string>,
  initialBalance: number,
  feeRate: number
): StrategyBacktestResult => {
  const rangeStart = candles[0]!.openTime;
  const rangeEnd = (candles[candles.length - 1]?.closeTime ?? rangeStart) + 1;
  const merged = mergeParams(COMMON_DEFAULTS, params);
  delete merged.timeframe;
  const cache = buildDiscoveryIndicatorCache(candles, atrVolatilityBreakout.indicatorReq);
  return atrVolatilityBreakout.run({
    candles,
    cache,
    params: merged,
    initialBalance,
    entryMode: "nextOpen",
    feeRate,
    leverage: Number(merged.leverage ?? 3),
    riskPct: Number(merged.riskPct ?? 0.25),
    backtestMsSpan: rangeEnd - rangeStart,
  });
};

const snapshotOf = (
  label: string,
  symbol: string,
  timeframe: string,
  _params: Record<string, number | string>,
  result: StrategyBacktestResult,
  rangeStart: number,
  rangeEnd: number,
  initialBalance: number
): Snapshot => {
  const ev = evaluate(result, rangeStart, rangeEnd, initialBalance);
  return { label, symbol, timeframe, params: result.params, metrics: result.metrics, ...ev };
};

const close = (actual: number, expected: number, rel = 0.02, abs = 1): boolean => {
  const diff = Math.abs(actual - expected);
  return diff <= abs || diff / Math.max(Math.abs(expected), 1e-9) <= rel;
};

const mdRow = (s: Snapshot) =>
  `| ${s.label} | ${s.metrics.endBalance.toFixed(2)} | ${s.metrics.netPnL.toFixed(4)} | ${s.avgMonthlyNotional.toFixed(0)} | ${s.minMonthlyNotional.toFixed(0)} | ${s.metrics.maxDrawdownPct.toFixed(3)}% | ${s.maxMonthlyDrawdownPct.toFixed(3)}% | ${s.metrics.profitFactor.toFixed(3)} | ${s.metrics.tradesCount} | ${s.failReasons.join(", ") || "PASS avg+DD"} |`;

const main = async () => {
  const outputDir = path.resolve(process.env.BACKTEST_OUTPUT_DIR ?? "data/results");
  const cacheDir = path.resolve(process.env.BACKTEST_CACHE_DIR ?? "data/cache");
  const symbol = process.env.BINANCE_SYMBOL ?? "SOLUSDT";
  const months = envNum(process.env.BACKTEST_MONTHS, 6);
  const endTimeMs = envNum(process.env.BACKTEST_END_TIME_MS, 1_777_593_600_000);
  const initialBalance = envNum(process.env.BACKTEST_INITIAL_BALANCE, 500);
  const feeRate = envNum(process.env.BACKTEST_FEE_RATE, 0.00035);
  const extraSymbols = (process.env.BINANCE_HARDENING_SYMBOLS ?? "BTCUSDT,ETHUSDT")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s !== symbol);

  const load = await loadBinanceFuturesCandles(symbol, {
    cacheDir,
    months,
    endTimeMs,
    minCoveragePct: envNum(process.env.BINANCE_MIN_COVERAGE_PCT, 95),
  });
  const candles = resolveStrategyCandles(load.candles, "15m");
  const rangeStart = candles[0]!.openTime;
  const rangeEnd = (candles[candles.length - 1]?.closeTime ?? endTimeMs) + 1;

  const baselineResult = runStrategy(candles, WINNER_PARAMS, initialBalance, feeRate);
  const baseline = snapshotOf("baseline-0slip-0fund", symbol, "15m", WINNER_PARAMS, baselineResult, rangeStart, rangeEnd, initialBalance);

  const costScenarios: { label: string; extra: Record<string, number | string> }[] = [
    { label: "slip-1bps", extra: { slippageBps: 1 } },
    { label: "slip-2bps", extra: { slippageBps: 2 } },
    { label: "funding-1bp-per-8h", extra: { fundingRatePer8h: 0.0001 } },
    { label: "funding-3bp-per-8h", extra: { fundingRatePer8h: 0.0003 } },
    { label: "slip-2bps+funding-1bp", extra: { slippageBps: 2, fundingRatePer8h: 0.0001 } },
  ];
  const costSnaps: Snapshot[] = [];
  for (const sc of costScenarios) {
    const result = runStrategy(candles, { ...WINNER_PARAMS, ...sc.extra }, initialBalance, feeRate);
    costSnaps.push(snapshotOf(sc.label, symbol, "15m", { ...WINNER_PARAMS, ...sc.extra }, result, rangeStart, rangeEnd, initialBalance));
  }

  const neighborSnaps: Snapshot[] = [];
  const neighborStress: Snapshot[] = [];
  for (const n of TOP5) {
    const result = runStrategy(candles, n.params, initialBalance, feeRate);
    neighborSnaps.push(
      snapshotOf(`top${n.rank}-baseline`, symbol, "15m", n.params, result, rangeStart, rangeEnd, initialBalance)
    );
    const stressed = runStrategy(candles, { ...n.params, slippageBps: 2, fundingRatePer8h: 0.0001 }, initialBalance, feeRate);
    neighborStress.push(
      snapshotOf(`top${n.rank}-slip2+fund1`, symbol, "15m", { ...n.params, slippageBps: 2, fundingRatePer8h: 0.0001 }, stressed, rangeStart, rangeEnd, initialBalance)
    );
  }

  const wfSlices = buildRollingWalkForwardSlices(rangeStart, rangeEnd, 3, 0.5, 0.15);
  const wf = wfSlices.map((slice) => {
    const trainC = candles.filter((c) => c.openTime >= slice.trainStart && c.openTime < slice.trainEnd);
    const valC = candles.filter((c) => c.openTime >= slice.trainEnd && c.openTime < slice.valEnd);
    const oosC = candles.filter((c) => c.openTime >= slice.valEnd && c.openTime < slice.oosEnd);
    const runSlice = (label: string, sliceCandles: NormalizedCandle[]) => {
      if (sliceCandles.length < 50) {
        return {
          label,
          trades: 0,
          netPnL: 0,
          maxDrawdownPct: 0,
          profitFactor: 0,
          start: new Date(sliceCandles[0]?.openTime ?? 0).toISOString(),
          end: new Date(sliceCandles[sliceCandles.length - 1]?.closeTime ?? 0).toISOString(),
        };
      }
      const res = runStrategy(sliceCandles, WINNER_PARAMS, initialBalance, feeRate);
      return {
        label,
        trades: res.metrics.tradesCount,
        netPnL: res.metrics.netPnL,
        maxDrawdownPct: res.metrics.maxDrawdownPct,
        profitFactor: res.metrics.profitFactor,
        start: new Date(sliceCandles[0]!.openTime).toISOString(),
        end: new Date(sliceCandles[sliceCandles.length - 1]!.closeTime).toISOString(),
      };
    };
    return {
      windowIndex: slice.windowIndex,
      train: runSlice("train", trainC),
      validation: runSlice("val", valC),
      oos: runSlice("oos", oosC),
    };
  });

  const splitAt = rangeStart + (rangeEnd - rangeStart) * 0.7;
  const isCandles = candles.filter((c) => c.openTime < splitAt);
  const oosCandles = candles.filter((c) => c.openTime >= splitAt);
  const anchoredIs = runStrategy(isCandles, WINNER_PARAMS, initialBalance, feeRate);
  const anchoredOos = runStrategy(oosCandles, WINNER_PARAMS, initialBalance, feeRate);
  const fullRunOosTrades = baselineResult.trades.filter((t) => t.entryTime >= splitAt);
  const fullRunIsTrades = baselineResult.trades.filter((t) => t.entryTime < splitAt);

  const otherSymbolSnaps: Snapshot[] = [];
  for (const extra of extraSymbols) {
    try {
      const extraLoad = await loadBinanceFuturesCandles(extra, {
        cacheDir,
        months,
        endTimeMs,
        minCoveragePct: envNum(process.env.BINANCE_MIN_COVERAGE_PCT, 90),
      });
      const extraCandles = resolveStrategyCandles(extraLoad.candles, "15m");
      if (extraCandles.length < 200) {
        otherSymbolSnaps.push(
          snapshotOf(`${extra}-insufficient-data`, extra, "15m", WINNER_PARAMS, runStrategy(extraCandles, WINNER_PARAMS, initialBalance, feeRate), extraCandles[0]?.openTime ?? 0, extraCandles[extraCandles.length - 1]?.closeTime ?? 0, initialBalance)
        );
        continue;
      }
      const extraStart = extraCandles[0]!.openTime;
      const extraEnd = extraCandles[extraCandles.length - 1]!.closeTime + 1;
      const extraRes = runStrategy(extraCandles, WINNER_PARAMS, initialBalance, feeRate);
      otherSymbolSnaps.push(snapshotOf(`${extra}-winner-params`, extra, "15m", WINNER_PARAMS, extraRes, extraStart, extraEnd, initialBalance));
    } catch (e) {
      console.warn(`[HARDENING] skip ${extra}: ${e}`);
    }
  }

  const reproduced =
    close(baseline.metrics.endBalance, CLOUD_EXPECTED.endBalance) &&
    close(baseline.metrics.netPnL, CLOUD_EXPECTED.netPnL) &&
    close(baseline.avgMonthlyNotional, CLOUD_EXPECTED.avgMonthlyNotional, 0.03, 500) &&
    baseline.metrics.tradesCount === CLOUD_EXPECTED.tradesCount;

  const conservative = costSnaps.find((s) => s.label === "slip-2bps+funding-1bp")!;
  const oosNet = anchoredOos.metrics.netPnL;
  const oosDd = anchoredOos.metrics.maxDrawdownPct;
  const wfOosNets = wf.map((w) => w.oos.netPnL);
  const wfOosPositive = wfOosNets.filter((x) => x > 0).length;
  const neighborsAvgPass = neighborSnaps.filter((s) => !s.failReasons.includes("avgMonthlyNotional<50k") && !s.failReasons.includes("fullDD>5") && s.metrics.netPnL >= 0 && s.metrics.profitFactor >= 1).length;

  let verdict: "research-only" | "paper-ready" | "not ready" = "research-only";
  if (!reproduced) verdict = "not ready";
  else if (
    conservative.metrics.netPnL >= 0 &&
    conservative.metrics.maxDrawdownPct <= TARGET_MAX_DD &&
    conservative.metrics.profitFactor >= 1 &&
    oosNet >= 0 &&
    oosDd <= TARGET_MAX_DD &&
    wfOosPositive >= 2 &&
    baseline.minMonthlyNotional >= TARGET_MONTHLY_NOTIONAL
  ) {
    verdict = "paper-ready";
  } else {
    verdict = "research-only";
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: BINANCE_FUTURES_SOURCE,
    symbol,
    timeframe: "15m",
    endTimeMs,
    months,
    feeRate,
    cachePath: load.cachePath,
    candleCount1m: load.candles.length,
    candleCount15m: candles.length,
    quality: load.quality,
    reproduced,
    cloudExpected: CLOUD_EXPECTED,
    baseline,
    costScenarios: costSnaps,
    neighborsBaseline: neighborSnaps,
    neighborsStress: neighborStress,
    walkForward: wf,
    anchored: {
      splitAt: new Date(splitAt).toISOString(),
      inSample: {
        trades: anchoredIs.metrics.tradesCount,
        netPnL: anchoredIs.metrics.netPnL,
        maxDrawdownPct: anchoredIs.metrics.maxDrawdownPct,
        profitFactor: anchoredIs.metrics.profitFactor,
      },
      outOfSampleColdStart: {
        trades: anchoredOos.metrics.tradesCount,
        netPnL: anchoredOos.metrics.netPnL,
        maxDrawdownPct: anchoredOos.metrics.maxDrawdownPct,
        profitFactor: anchoredOos.metrics.profitFactor,
      },
      fullRunSplit: {
        isTrades: fullRunIsTrades.length,
        oosTrades: fullRunOosTrades.length,
        oosNet: r(fullRunOosTrades.reduce((s, t) => s + t.netPnL, 0)),
      },
    },
    otherSymbols: otherSymbolSnaps,
    neighborsAvgPass,
    verdict,
    notes: [
      "Slippage is applied on both entry and exit fills (buy worse / sell worse).",
      "Funding is a minimal 8h model (00:00/08:00/16:00 UTC) using candle open as mark; positive rate = longs pay.",
      "Walk-forward uses the same params (no re-optimization). Slice runs rebuild indicators on the slice only (cold start).",
      "exitOnOppositeSignal is present in params but unused by ATR_VOLATILITY_BREAKOUT (flat-or-enter logic).",
      "Paper trading only — no live keys, no order routing.",
    ],
  };

  const md = `# ATR Volatility Breakout — local hardening (SOLUSDT 15m)

Generated: ${payload.generatedAt}

## Setup

- Source: **${BINANCE_FUTURES_SOURCE}** (REST, with data.binance.vision fallback)
- Symbol / TF: **${symbol} 15m** (aggregated from 1m cache)
- Window: ${new Date(rangeStart).toISOString()} → ${new Date(rangeEnd).toISOString()} (\`BACKTEST_END_TIME_MS=${endTimeMs}\`, ${months}×30d)
- Start balance: **${initialBalance} USDC**, fee **${feeRate} per side**
- 1m candles: ${load.candles.length}, coverage ${load.quality.coveragePct}%
- Strategy: ATR_VOLATILITY_BREAKOUT label \`r30-l3-volume\`

## Reproduction vs cloud report

| Field | Cloud | Local | Match |
|---|---:|---:|:---:|
| End balance | ${CLOUD_EXPECTED.endBalance.toFixed(6)} | ${baseline.metrics.endBalance.toFixed(6)} | ${close(baseline.metrics.endBalance, CLOUD_EXPECTED.endBalance) ? "yes" : "NO"} |
| Net PnL | ${CLOUD_EXPECTED.netPnL.toFixed(6)} | ${baseline.metrics.netPnL.toFixed(6)} | ${close(baseline.metrics.netPnL, CLOUD_EXPECTED.netPnL) ? "yes" : "NO"} |
| Avg monthly notional | ${CLOUD_EXPECTED.avgMonthlyNotional.toFixed(2)} | ${baseline.avgMonthlyNotional.toFixed(2)} | ${close(baseline.avgMonthlyNotional, CLOUD_EXPECTED.avgMonthlyNotional, 0.03, 500) ? "yes" : "NO"} |
| Min monthly notional | ${CLOUD_EXPECTED.minMonthlyNotional.toFixed(2)} | ${baseline.minMonthlyNotional.toFixed(2)} | ${close(baseline.minMonthlyNotional, CLOUD_EXPECTED.minMonthlyNotional, 0.03, 500) ? "yes" : "NO"} |
| Max DD | ${CLOUD_EXPECTED.maxDrawdownPct.toFixed(6)}% | ${baseline.metrics.maxDrawdownPct.toFixed(6)}% | ${close(baseline.metrics.maxDrawdownPct, CLOUD_EXPECTED.maxDrawdownPct, 0.05, 0.2) ? "yes" : "NO"} |
| PF | ${CLOUD_EXPECTED.profitFactor.toFixed(6)} | ${baseline.metrics.profitFactor.toFixed(6)} | ${close(baseline.metrics.profitFactor, CLOUD_EXPECTED.profitFactor, 0.03, 0.05) ? "yes" : "NO"} |
| Trades | ${CLOUD_EXPECTED.tradesCount} | ${baseline.metrics.tradesCount} | ${baseline.metrics.tradesCount === CLOUD_EXPECTED.tradesCount ? "yes" : "NO"} |

Reproduction verdict: **${reproduced ? "MATCH (within tolerance)" : "DIVERGED"}**

### Baseline monthly

| Month | Notional | Net PnL | Max DD | Trades | PF |
|---|---:|---:|---:|---:|---:|
${baseline.monthly
  .filter((m) => m.isFullMonth)
  .map((m) => `| ${m.monthKey} | ${m.volume.toFixed(2)} | ${m.netPnL.toFixed(4)} | ${m.maxDrawdownPct.toFixed(4)}% | ${m.tradesCount} | ${m.profitFactor.toFixed(4)} |`)
  .join("\n")}

## Slippage and funding impact (winner params)

| Scenario | End | Net PnL | Avg monthly | Min monthly | Full DD | Monthly DD | PF | Trades | Flags |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
${mdRow(baseline)}
${costSnaps.map(mdRow).join("\n")}

Funding model: 8h marks, default **+1 bp / 8h** (longs pay, shorts receive). This is a conservative placeholder, not historical Binance funding.

## Walk-forward / OOS (same params, no re-fit)

Anchored split at ${new Date(splitAt).toISOString()} (70/30 by time):

| Leg | Trades | Net PnL | Max DD | PF |
|---|---:|---:|---:|---:|
| In-sample cold start | ${anchoredIs.metrics.tradesCount} | ${anchoredIs.metrics.netPnL.toFixed(4)} | ${anchoredIs.metrics.maxDrawdownPct.toFixed(4)}% | ${anchoredIs.metrics.profitFactor.toFixed(4)} |
| OOS cold start | ${anchoredOos.metrics.tradesCount} | ${anchoredOos.metrics.netPnL.toFixed(4)} | ${anchoredOos.metrics.maxDrawdownPct.toFixed(4)}% | ${anchoredOos.metrics.profitFactor.toFixed(4)} |
| Full-run trades in OOS window | ${fullRunOosTrades.length} | ${r(fullRunOosTrades.reduce((s, t) => s + t.netPnL, 0)).toFixed(4)} | — | — |

Rolling 3-window WF (50% train / 15% val / 35% OOS, cold-start indicators):

| Window | Train net / DD / n | Val net / DD / n | OOS net / DD / n |
|---:|---|---|---|
${wf
  .map(
    (w) =>
      `| ${w.windowIndex} | ${w.train.netPnL.toFixed(2)} / ${w.train.maxDrawdownPct.toFixed(2)}% / ${w.train.trades} | ${w.validation.netPnL.toFixed(2)} / ${w.validation.maxDrawdownPct.toFixed(2)}% / ${w.validation.trades} | ${w.oos.netPnL.toFixed(2)} / ${w.oos.maxDrawdownPct.toFixed(2)}% / ${w.oos.trades} |`
  )
  .join("\n")}

OOS windows with net > 0: **${wfOosPositive}/${wf.length}**

## Neighbor stability (cloud top-5 PASS list)

Baseline (0 slip / 0 funding):

| Scenario | End | Net PnL | Avg monthly | Min monthly | Full DD | Monthly DD | PF | Trades | Flags |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
${neighborSnaps.map(mdRow).join("\n")}

Stress (2 bps slip + 1 bp/8h funding):

| Scenario | End | Net PnL | Avg monthly | Min monthly | Full DD | Monthly DD | PF | Trades | Flags |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
${neighborStress.map(mdRow).join("\n")}

Neighbors still passing avg≥50k, DD≤5, net≥0, PF≥1 at baseline: **${neighborsAvgPass}/5**

## Other symbols (same params, if data loaded)

${
  otherSymbolSnaps.length
    ? `| Scenario | End | Net PnL | Avg monthly | Min monthly | Full DD | Monthly DD | PF | Trades | Flags |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
${otherSymbolSnaps.map(mdRow).join("\n")}`
    : "_No extra symbols loaded._"
}

## Verdict

**${verdict}**

${
  verdict === "paper-ready"
    ? "Conservative costs, OOS, and min-monthly volume all still pass. Paper-trade only; do not go live from this report."
    : verdict === "not ready"
      ? "Local numbers diverged from the cloud candidate or the setup is not usable as-is."
      : "Use as research only. The average-volume target can pass while a month stays below 50k (Nov ~37k on the cloud winner), OOS/cold-start windows are small, and conservative friction eats a large share of the 500 USDC edge. Next step if pursued: paper trade with the same fee/slippage model — no API keys, no live orders."
}

### Caveats

${payload.notes.map((n) => `- ${n}`).join("\n")}
`;

  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "binance-500-atr-breakout-hardening.json");
  const mdPath = path.join(outputDir, "binance-500-atr-breakout-hardening.md");
  writeJson(jsonPath, payload);
  fs.writeFileSync(mdPath, md);
  console.log("\n=== ATR BREAKOUT LOCAL HARDENING ===\n");
  console.log(`Reproduced: ${reproduced}  verdict: ${verdict}`);
  console.log(`Baseline net=${baseline.metrics.netPnL.toFixed(4)} DD=${baseline.metrics.maxDrawdownPct.toFixed(4)} trades=${baseline.metrics.tradesCount}`);
  console.log(`Conservative net=${conservative.metrics.netPnL.toFixed(4)} DD=${conservative.metrics.maxDrawdownPct.toFixed(4)}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Report: ${mdPath}\n`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
