import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { BINANCE_FUTURES_SOURCE, loadBinanceFuturesCandles } from "../backtest/fetchBinanceFuturesCandles.js";
import { resolveStrategyCandles } from "../backtest/candleTimeframe.js";
import { buildDiscoveryIndicatorCache } from "./indicatorCache.js";
import { mergeParams } from "./grids.js";
import { atrVolatilityBreakout } from "./strategies/atrVolatilityBreakout.js";
import { COMMON_DEFAULTS } from "./strategies/phasedGrids.js";
import { buildMonthlyProfitMetrics } from "./stableProfitEvaluation.js";
import { writeJson } from "./progressive/output.js";
import type { StrategyBacktestResult } from "./types.js";

const envNum = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const r = (v: number): number => Math.round(v * 1e6) / 1e6;

const TARGET_MONTHLY_NOTIONAL = 50_000;
const TARGET_MAX_DD = 5;

const ENTRY_GRID = {
  timeframe: ["3m", "5m", "15m"],
  atrPeriod: [10, 14, 20],
  lookback: [5, 8, 10, 15],
  breakoutMult: [0.8, 1, 1.2, 1.5],
  stopMult: [0.35, 0.45, 0.6, 0.8],
};

const PROFILES: Record<string, number | string>[] = [
  { label: "r25-l5-tight-vol12", riskPct: 0.25, leverage: 5, minMoveVsFeeMult: 5, minVolumeMult: 1.2, minAtrPct: 0.03, maxTradesPerDay: 40, cooldownCandles: 1, trailStart: 0.4, trailGap: 0.6, takeProfitPct: 0.6, maxHoldCandles: 90 },
  { label: "r25-l5-tight-vol10", riskPct: 0.25, leverage: 5, minMoveVsFeeMult: 5, minVolumeMult: 1, minAtrPct: 0.03, maxTradesPerDay: 50, cooldownCandles: 1, trailStart: 0.4, trailGap: 0.6, takeProfitPct: 0.6, maxHoldCandles: 90 },
  { label: "r30-l5-tight-fee6", riskPct: 0.3, leverage: 5, minMoveVsFeeMult: 6, minVolumeMult: 1.2, minAtrPct: 0.04, maxTradesPerDay: 40, cooldownCandles: 1, trailStart: 0.5, trailGap: 0.7, takeProfitPct: 0.8, maxHoldCandles: 120 },
  { label: "r20-l5-tight-more-trades", riskPct: 0.2, leverage: 5, minMoveVsFeeMult: 4, minVolumeMult: 1, minAtrPct: 0.02, maxTradesPerDay: 60, cooldownCandles: 0, trailStart: 0.35, trailGap: 0.55, takeProfitPct: 0.5, maxHoldCandles: 75 },
  { label: "r25-l3-balanced", riskPct: 0.25, leverage: 3, minMoveVsFeeMult: 5, minVolumeMult: 1.2, minAtrPct: 0.03, maxTradesPerDay: 35, cooldownCandles: 1, trailStart: 0.45, trailGap: 0.65, takeProfitPct: 0.7, maxHoldCandles: 100 },
  { label: "r30-l3-volume", riskPct: 0.3, leverage: 3, minMoveVsFeeMult: 5, minVolumeMult: 1.1, minAtrPct: 0.03, maxTradesPerDay: 45, cooldownCandles: 1, trailStart: 0.4, trailGap: 0.6, takeProfitPct: 0.6, maxHoldCandles: 90 },
  { label: "r20-l3-dd-safe", riskPct: 0.2, leverage: 3, minMoveVsFeeMult: 6, minVolumeMult: 1.2, minAtrPct: 0.04, maxTradesPerDay: 30, cooldownCandles: 2, trailStart: 0.6, trailGap: 0.8, takeProfitPct: 0.9, maxHoldCandles: 150 },
  { label: "r35-l5-aggressive-dd-cap", riskPct: 0.35, leverage: 5, minMoveVsFeeMult: 6, minVolumeMult: 1.5, minAtrPct: 0.05, maxTradesPerDay: 30, cooldownCandles: 2, trailStart: 0.5, trailGap: 0.8, takeProfitPct: 0.8, maxHoldCandles: 120 },
  { label: "r25-l5-fee8", riskPct: 0.25, leverage: 5, minMoveVsFeeMult: 8, minVolumeMult: 1.2, minAtrPct: 0.05, maxTradesPerDay: 35, cooldownCandles: 2, trailStart: 0.7, trailGap: 1, takeProfitPct: 1.2, maxHoldCandles: 180 },
  { label: "r30-l5-fast-tp", riskPct: 0.3, leverage: 5, minMoveVsFeeMult: 5, minVolumeMult: 1.2, minAtrPct: 0.03, maxTradesPerDay: 45, cooldownCandles: 0, trailStart: 0.3, trailGap: 0.5, takeProfitPct: 0.45, maxHoldCandles: 60 },
];

type Candidate = {
  rank?: number;
  source: typeof BINANCE_FUTURES_SOURCE;
  symbol: string;
  timeframe: string;
  strategyName: string;
  params: Record<string, number | string>;
  passedTarget: boolean;
  failReasons: string[];
  score: number;
  metrics: StrategyBacktestResult["metrics"];
  monthly: ReturnType<typeof buildMonthlyProfitMetrics>;
  avgMonthlyNotional: number;
  minMonthlyNotional: number;
  maxMonthlyDrawdownPct: number;
  worstMonthlyPnlPct: number;
  profitableMonths: number;
  losingMonths: number;
};

const cartesian = <T extends Record<string, readonly (number | string)[]>>(grid: T): Record<keyof T, number | string>[] => {
  const keys = Object.keys(grid) as (keyof T)[];
  const out: Record<keyof T, number | string>[] = [];
  const walk = (i: number, cur: Record<keyof T, number | string>) => {
    if (i >= keys.length) {
      out.push({ ...cur });
      return;
    }
    const key = keys[i]!;
    for (const value of grid[key]!) walk(i + 1, { ...cur, [key]: value });
  };
  walk(0, {} as Record<keyof T, number | string>);
  return out;
};

const evaluate = (
  result: StrategyBacktestResult,
  rangeStart: number,
  rangeEnd: number,
  initialBalance: number
): Omit<Candidate, "source" | "symbol" | "timeframe" | "strategyName" | "params" | "score" | "passedTarget" | "failReasons"> => {
  const monthly = buildMonthlyProfitMetrics(result.trades, rangeStart, rangeEnd, initialBalance);
  const fullMonths = monthly.filter((m) => m.isFullMonth);
  const months = fullMonths.length ? fullMonths : monthly;
  const avgMonthlyNotional = months.length ? r(months.reduce((s, m) => s + m.volume, 0) / months.length) : 0;
  const minMonthlyNotional = months.length ? r(Math.min(...months.map((m) => m.volume))) : 0;
  const maxMonthlyDrawdownPct = months.length ? r(Math.max(...months.map((m) => m.maxDrawdownPct))) : 0;
  const worstMonthlyPnlPct = months.length ? r(Math.min(...months.map((m) => m.netPnLPct))) : 0;
  return {
    metrics: result.metrics,
    monthly,
    avgMonthlyNotional,
    minMonthlyNotional,
    maxMonthlyDrawdownPct,
    worstMonthlyPnlPct,
    profitableMonths: months.filter((m) => m.netPnL > 0).length,
    losingMonths: months.filter((m) => m.netPnL < 0).length,
  };
};

const failReasons = (
  c: Omit<Candidate, "source" | "symbol" | "timeframe" | "strategyName" | "params" | "score" | "passedTarget" | "failReasons">,
  requireMinMonthly = false
): string[] => {
  const out: string[] = [];
  if (requireMinMonthly) {
    if (c.minMonthlyNotional < TARGET_MONTHLY_NOTIONAL) out.push("minMonthlyNotional<50k");
  } else if (c.avgMonthlyNotional < TARGET_MONTHLY_NOTIONAL) {
    out.push("avgMonthlyNotional<50k");
  }
  if (c.maxMonthlyDrawdownPct > TARGET_MAX_DD) out.push("monthlyDD>5");
  if (c.metrics.maxDrawdownPct > TARGET_MAX_DD) out.push("fullDD>5");
  if (c.metrics.netPnL < 0) out.push("netPnL<0");
  if (c.metrics.profitFactor < 1) out.push("PF<1");
  return out;
};

const score = (
  c: Omit<Candidate, "source" | "symbol" | "timeframe" | "strategyName" | "params" | "score" | "passedTarget" | "failReasons">,
  requireMinMonthly = false
): number => {
  const volumeTerm = requireMinMonthly ? c.minMonthlyNotional : c.avgMonthlyNotional;
  return r(
    volumeTerm * 0.1 +
      Math.min(volumeTerm, TARGET_MONTHLY_NOTIONAL) * 0.2 +
      c.metrics.netPnL * 1000 +
      c.metrics.profitFactor * 500 -
      Math.max(0, c.maxMonthlyDrawdownPct - TARGET_MAX_DD) * 5000 -
      Math.max(0, c.metrics.maxDrawdownPct - TARGET_MAX_DD) * 5000 -
      Math.max(0, TARGET_MONTHLY_NOTIONAL - volumeTerm) * 0.4 -
      c.losingMonths * 500
  );
};

const keepTop = (items: Candidate[], item: Candidate, limit: number) => {
  items.push(item);
  items.sort((a, b) => b.score - a.score);
  if (items.length > limit) items.length = limit;
};

const idFor = (c: Candidate): string =>
  crypto
    .createHash("md5")
    .update(`${c.symbol}:${c.timeframe}:${c.strategyName}:${JSON.stringify(c.params)}`)
    .digest("hex")
    .slice(0, 12);

const exportArtifacts = (candidate: Candidate, result: StrategyBacktestResult, outputDir: string) => {
  const id = idFor(candidate);
  const tradesDir = path.join(outputDir, "trades");
  const equityDir = path.join(outputDir, "equity");
  fs.mkdirSync(tradesDir, { recursive: true });
  fs.mkdirSync(equityDir, { recursive: true });
  const tradeHistoryPath = path.join(tradesDir, `BINANCE_500_TARGET_${candidate.strategyName}_${id}.json`);
  const equityCurvePath = path.join(equityDir, `BINANCE_500_TARGET_${candidate.strategyName}_${id}.csv`);
  fs.writeFileSync(tradeHistoryPath, JSON.stringify(result.trades, null, 2));
  const lines = ["time,balance", `${result.metrics.startBalance},${result.metrics.startBalance}`];
  for (const t of result.trades) lines.push(`${t.exitTime},${t.balanceAfter}`);
  fs.writeFileSync(equityCurvePath, lines.join("\n"));
  const rel = (p: string) => path.relative(process.cwd(), p).replace(/\\/g, "/");
  return { tradeHistoryPath: rel(tradeHistoryPath), equityCurvePath: rel(equityCurvePath) };
};

const report = (payload: {
  generatedAt: string;
  testedVariants: number;
  best: Candidate | null;
  topPassed: Candidate[];
  topOverall: Candidate[];
  artifacts?: { tradeHistoryPath: string; equityCurvePath: string };
  title?: string;
  volumeRule?: string;
}) => {
  const row = (c: Candidate, i: number) =>
    `| ${i + 1} | ${c.timeframe} | ${c.avgMonthlyNotional.toFixed(2)} | ${c.minMonthlyNotional.toFixed(2)} | ${c.metrics.totalNotional.toFixed(2)} | ${c.metrics.netPnL.toFixed(6)} | ${c.maxMonthlyDrawdownPct.toFixed(4)}% | ${c.metrics.maxDrawdownPct.toFixed(4)}% | ${c.metrics.profitFactor.toFixed(4)} | ${c.metrics.tradesCount} | ${c.failReasons.join(", ") || "PASS"} |`;
  const best = payload.best;
  const title = payload.title ?? "Binance 500 Balance / 50k Monthly Volume Target Search";
  const volumeRule = payload.volumeRule ?? "Average monthly notional: **>= 50,000 USDC**";
  return `# ${title}

Generated: ${payload.generatedAt}

## Target

- Start balance: **500 USDC**
- ${volumeRule}
- Max monthly drawdown: **<= 5%**
- Full-period max drawdown: **<= 5%**
- Net PnL >= 0 and PF >= 1

## Verdict

${best ? `Best target candidate: **${best.strategyName} ${best.timeframe}**, avg monthly notional **${best.avgMonthlyNotional.toFixed(2)}**, max monthly DD **${best.maxMonthlyDrawdownPct.toFixed(4)}%**, net PnL **${best.metrics.netPnL.toFixed(6)}**.` : "**No candidate passed all target filters.**"}

${best ? `## Best params

\`\`\`json
${JSON.stringify(best.params, null, 2)}
\`\`\`

| Metric | Value |
|---|---:|
| Avg monthly notional | ${best.avgMonthlyNotional.toFixed(2)} USDC |
| Min monthly notional | ${best.minMonthlyNotional.toFixed(2)} USDC |
| Total notional | ${best.metrics.totalNotional.toFixed(2)} USDC |
| Net PnL | ${best.metrics.netPnL.toFixed(6)} USDC (${best.metrics.netPnLPct.toFixed(6)}%) |
| Gross PnL | ${best.metrics.grossPnL.toFixed(6)} USDC |
| Fees | ${best.metrics.totalFees.toFixed(6)} USDC |
| Profit factor | ${best.metrics.profitFactor.toFixed(6)} |
| Full max DD | ${best.metrics.maxDrawdownPct.toFixed(6)}% |
| Max monthly DD | ${best.maxMonthlyDrawdownPct.toFixed(6)}% |
| Trades | ${best.metrics.tradesCount} |
| Trades/day | ${best.metrics.tradesPerDay.toFixed(6)} |
${payload.artifacts ? `| Trades artifact | \`${payload.artifacts.tradeHistoryPath}\` |
| Equity artifact | \`${payload.artifacts.equityCurvePath}\` |` : ""}

### Monthly breakdown

| Month | Notional | Net PnL | Net % | Max DD | Trades | PF |
|---|---:|---:|---:|---:|---:|---:|
${best.monthly
  .filter((m) => m.isFullMonth)
  .map((m) => `| ${m.monthKey} | ${m.volume.toFixed(2)} | ${m.netPnL.toFixed(6)} | ${m.netPnLPct.toFixed(4)}% | ${m.maxDrawdownPct.toFixed(4)}% | ${m.tradesCount} | ${m.profitFactor.toFixed(4)} |`)
  .join("\n")}
` : ""}

## Top passed candidates

| Rank | TF | Avg monthly | Min monthly | Total notional | Net PnL | Max monthly DD | Full DD | PF | Trades | Status |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
${payload.topPassed.map(row).join("\n") || "| - | - | - | - | - | - | - | - | - | - | - |"}

## Top overall / closest candidates

| Rank | TF | Avg monthly | Min monthly | Total notional | Net PnL | Max monthly DD | Full DD | PF | Trades | Status |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
${payload.topOverall.map(row).join("\n")}
`;
};

const main = async () => {
  const outputDir = path.resolve(process.env.BACKTEST_OUTPUT_DIR ?? "data/results");
  const cacheDir = path.resolve(process.env.BACKTEST_CACHE_DIR ?? "data/cache");
  const symbol = process.env.BINANCE_SYMBOL ?? "SOLUSDT";
  const months = envNum(process.env.BACKTEST_MONTHS, 6);
  const endTimeMs = envNum(process.env.BACKTEST_END_TIME_MS, Date.now());
  const initialBalance = envNum(process.env.BACKTEST_INITIAL_BALANCE, 500);
  const feeRate = envNum(process.env.BACKTEST_FEE_RATE, 0.00035);
  const maxVariants = envNum(process.env.BINANCE_500_TARGET_MAX_VARIANTS, 100_000);
  const load = await loadBinanceFuturesCandles(symbol, {
    cacheDir,
    months,
    endTimeMs,
    minCoveragePct: envNum(process.env.BINANCE_MIN_COVERAGE_PCT, 95),
  });

  const topPassed: Candidate[] = [];
  const topOverall: Candidate[] = [];
  const topPassedMinMonthly: Candidate[] = [];
  const topOverallMinMonthly: Candidate[] = [];
  let bestResult: StrategyBacktestResult | null = null;
  let best: Candidate | null = null;
  let bestMinMonthly: Candidate | null = null;
  let bestMinMonthlyResult: StrategyBacktestResult | null = null;
  let tested = 0;

  const entryCombos = cartesian(ENTRY_GRID);
  for (const tf of ENTRY_GRID.timeframe) {
    const candles = resolveStrategyCandles(load.candles, String(tf));
    const rangeStart = candles[0]!.openTime;
    const rangeEnd = (candles[candles.length - 1]?.closeTime ?? endTimeMs) + 1;
    const cache = buildDiscoveryIndicatorCache(candles, atrVolatilityBreakout.indicatorReq);
    for (const entry of entryCombos.filter((x) => x.timeframe === tf)) {
      for (const profile of PROFILES) {
        if (tested >= maxVariants) break;
        tested += 1;
        const params = mergeParams(COMMON_DEFAULTS, entry, profile);
        delete params.timeframe;
        const result = atrVolatilityBreakout.run({
          candles,
          cache,
          params,
          initialBalance,
          entryMode: "nextOpen",
          feeRate,
          leverage: Number(params.leverage ?? 3),
          riskPct: Number(params.riskPct ?? 0.25),
          backtestMsSpan: rangeEnd - rangeStart,
        });
        const ev = evaluate(result, rangeStart, rangeEnd, initialBalance);
        const fails = failReasons(ev, false);
        const failsMin = failReasons(ev, true);
        const candidate: Candidate = {
          source: BINANCE_FUTURES_SOURCE,
          symbol,
          timeframe: String(tf),
          strategyName: result.strategyName,
          params: result.params,
          passedTarget: fails.length === 0,
          failReasons: fails,
          score: score(ev, false),
          ...ev,
        };
        const minCandidate: Candidate = {
          ...candidate,
          passedTarget: failsMin.length === 0,
          failReasons: failsMin,
          score: score(ev, true),
        };
        keepTop(topOverall, candidate, 30);
        keepTop(topOverallMinMonthly, minCandidate, 30);
        if (candidate.passedTarget) {
          keepTop(topPassed, candidate, 30);
          if (!best || candidate.score > best.score) {
            best = candidate;
            bestResult = result;
          }
        }
        if (minCandidate.passedTarget) {
          keepTop(topPassedMinMonthly, minCandidate, 30);
          if (!bestMinMonthly || minCandidate.score > bestMinMonthly.score) {
            bestMinMonthly = minCandidate;
            bestMinMonthlyResult = result;
          }
        }
      }
      if (tested >= maxVariants) break;
    }
    console.log(`[500_TARGET] ${tf} tested=${tested} passedAvg=${topPassed.length} passedMin=${topPassedMinMonthly.length} best=${best ? `${best.timeframe} ${best.avgMonthlyNotional.toFixed(0)} DD=${best.maxMonthlyDrawdownPct.toFixed(2)}` : "none"}`);
  }

  const artifacts = best && bestResult ? exportArtifacts(best, bestResult, outputDir) : undefined;
  const minArtifacts =
    bestMinMonthly && bestMinMonthlyResult ? exportArtifacts(bestMinMonthly, bestMinMonthlyResult, outputDir) : undefined;
  const payload = {
    generatedAt: new Date(endTimeMs).toISOString(),
    source: BINANCE_FUTURES_SOURCE,
    symbol,
    months,
    initialBalance,
    target: {
      avgMonthlyNotional: TARGET_MONTHLY_NOTIONAL,
      maxMonthlyDrawdownPct: TARGET_MAX_DD,
      maxFullDrawdownPct: TARGET_MAX_DD,
    },
    testedVariants: tested,
    best: best ? { ...best, artifacts } : null,
    topPassed: topPassed.map((c, i) => ({ ...c, rank: i + 1 })),
    topOverall: topOverall.map((c, i) => ({ ...c, rank: i + 1 })),
  };
  const jsonPath = path.join(outputDir, "binance-500-volume-target-search.json");
  const reportPath = path.join(outputDir, "binance-500-volume-target-search.md");
  const cloudMd = path.join(outputDir, "binance-500-volume-target-search.cloud.md");
  const cloudJson = path.join(outputDir, "binance-500-volume-target-search.cloud.json");
  if (fs.existsSync(reportPath) && !fs.existsSync(cloudMd)) fs.copyFileSync(reportPath, cloudMd);
  if (fs.existsSync(jsonPath) && !fs.existsSync(cloudJson)) fs.copyFileSync(jsonPath, cloudJson);
  writeJson(jsonPath, payload);
  fs.writeFileSync(
    reportPath,
    report({
      generatedAt: payload.generatedAt,
      testedVariants: tested,
      best,
      topPassed,
      topOverall,
      artifacts,
      title: "Binance 500 Balance / 50k Monthly Volume Target Search",
      volumeRule: "Average monthly notional: **>= 50,000 USDC**",
    })
  );

  const minPayload = {
    generatedAt: new Date(endTimeMs).toISOString(),
    source: BINANCE_FUTURES_SOURCE,
    symbol,
    months,
    initialBalance,
    target: {
      minMonthlyNotional: TARGET_MONTHLY_NOTIONAL,
      maxMonthlyDrawdownPct: TARGET_MAX_DD,
      maxFullDrawdownPct: TARGET_MAX_DD,
    },
    testedVariants: tested,
    best: bestMinMonthly ? { ...bestMinMonthly, artifacts: minArtifacts } : null,
    topPassed: topPassedMinMonthly.map((c, i) => ({ ...c, rank: i + 1 })),
    topOverall: topOverallMinMonthly.map((c, i) => ({ ...c, rank: i + 1 })),
  };
  const minJsonPath = path.join(outputDir, "binance-500-min-monthly-50k-search.json");
  const minReportPath = path.join(outputDir, "binance-500-min-monthly-50k-search.md");
  writeJson(minJsonPath, minPayload);
  fs.writeFileSync(
    minReportPath,
    report({
      generatedAt: minPayload.generatedAt,
      testedVariants: tested,
      best: bestMinMonthly,
      topPassed: topPassedMinMonthly,
      topOverall: topOverallMinMonthly,
      artifacts: minArtifacts,
      title: "Binance 500 Balance / Min Monthly 50k Notional Search",
      volumeRule: "Every full month notional: **>= 50,000 USDC** (not only average)",
    })
  );

  console.log("\n=== BINANCE 500 / 50K MONTHLY TARGET SEARCH COMPLETE ===\n");
  console.log(`Tested: ${tested}`);
  if (best) {
    console.log(`Best avg-monthly: ${best.strategyName} ${best.timeframe}`);
    console.log(`  avgMonthlyNotional=${best.avgMonthlyNotional.toFixed(2)} minMonthly=${best.minMonthlyNotional.toFixed(2)} maxMonthlyDD=${best.maxMonthlyDrawdownPct.toFixed(4)} fullDD=${best.metrics.maxDrawdownPct.toFixed(4)}`);
    console.log(`  net=${best.metrics.netPnL.toFixed(6)} PF=${best.metrics.profitFactor.toFixed(6)} trades=${best.metrics.tradesCount}`);
  } else {
    console.log("No candidate passed average-monthly target filters.");
  }
  if (bestMinMonthly) {
    console.log(`Best min-monthly: ${bestMinMonthly.strategyName} ${bestMinMonthly.timeframe}`);
    console.log(`  minMonthlyNotional=${bestMinMonthly.minMonthlyNotional.toFixed(2)} avgMonthly=${bestMinMonthly.avgMonthlyNotional.toFixed(2)} net=${bestMinMonthly.metrics.netPnL.toFixed(6)}`);
  } else {
    console.log("No candidate passed min-monthly >=50k on every full month.");
  }
  console.log(`JSON: ${jsonPath}`);
  console.log(`Report: ${reportPath}`);
  console.log(`Min-monthly JSON: ${minJsonPath}`);
  console.log(`Min-monthly Report: ${minReportPath}\n`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
