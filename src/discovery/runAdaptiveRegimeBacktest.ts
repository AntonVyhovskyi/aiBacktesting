import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import {
  BINANCE_FUTURES_SOURCE,
  BinanceCacheMissingError,
  loadBinanceFuturesCandles,
} from "../backtest/fetchBinanceFuturesCandles.js";
import { resolveStrategyCandles } from "../backtest/candleTimeframe.js";
import { formatQualityReport, type CandleQualityReport } from "../backtest/candleValidate.js";
import { buildDiscoveryIndicatorCache } from "./indicatorCache.js";
import { mergeParams } from "./grids.js";
import { adaptiveRegimeStrategy } from "./strategies/adaptiveRegimeStrategy.js";
import { writeJson, exportArtifacts } from "./progressive/output.js";
import {
  buildPeriodReport,
  formatMetricsTable,
  formatRegimeTable,
  type PeriodReport,
} from "./regime/regimeBacktestMetrics.js";
import {
  scoreWalkForwardCandidate,
  classifyCandidate,
  type CandidateScore,
  type CandidateBucket,
} from "./regime/adaptiveScoring.js";
import {
  buildRollingWalkForwardSlices,
  evaluateWalkForwardWindow,
  type WalkForwardWindowResult,
} from "./regime/walkForward.js";
import { refreshBinanceSymbolData } from "./runDataQualityRefresh.js";
import type { StrategyBacktestResult } from "./types.js";

const num = (v: string | undefined, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const bool = (v: string | undefined, fb: boolean) =>
  !v ? fb : v === "1" || v.toLowerCase() === "true";

const TARGET_MONTHLY = num(process.env.ADAPTIVE_TARGET_MONTHLY_PCT, 10);
const TARGET_DD = num(process.env.ADAPTIVE_TARGET_MAX_DD_PCT, 5);
const MIN_COVERAGE_PCT = num(process.env.BINANCE_MIN_COVERAGE_PCT, 90);
const DEFAULT_SYMBOLS = "SOLUSDT,ETHUSDT";

type ParamSet = Record<string, number | string>;

const OPTIMIZER_GRID: ParamSet[] = [
  { adxTrendMin: 25, adxRangeMax: 20, atrHighPct: 1.2, riskPct: 0.35, atrMult: 1, tradeCompression: 0, tradeHighVol: 0, minRegimeConfidence: 0.5, minMoveVsFeeMult: 4, minVolumeMult: 1.1, riskMultTrendMax: 1.6, trendStrengthRiskBoost: 0.7 },
  { adxTrendMin: 25, adxRangeMax: 18, atrHighPct: 1.0, riskPct: 0.35, atrMult: 0.9, tradeCompression: 0, rangeTpPct: 0.4, trendTrailStart: 0.25, minMoveVsFeeMult: 5, minVolumeMult: 1.2, minTrendStrengthToTrade: 0.3 },
  { adxTrendMin: 28, adxRangeMax: 20, atrHighPct: 1.3, riskPct: 0.3, atrMult: 1, tradeCompression: 0, maxTradesPerDay: 15, minMoveVsFeeMult: 6, minVolumeMult: 1.2, riskMultTrendMax: 1.8 },
  { adxTrendMin: 22, adxRangeMax: 22, atrHighPct: 1.1, riskPct: 0.35, atrMult: 1, tradeCompression: 0, tradeRange: 1, tradeTrend: 1, minMoveVsFeeMult: 5, minVolumeMult: 1.1 },
  { adxTrendMin: 25, adxRangeMax: 20, atrHighPct: 1.2, riskPct: 0.25, atrMult: 0.85, tradeCompression: 0, maxTrendExtensionPct: 1.2, minMoveVsFeeMult: 6, minVolumeMult: 1.5, maxTradesPerDay: 12 },
  { adxTrendMin: 25, adxRangeMax: 20, atrHighPct: 1.0, riskPct: 0.3, atrMult: 1, tradeCompression: 0, tradeTransition: 0, rangeVwapDistPct: 0.2, minMoveVsFeeMult: 5, minVolumeMult: 1.2 },
];

type RunConfig = {
  symbol: string;
  timeframe: string;
  candles: import("../backtest/types.js").NormalizedCandle[];
  quality: CandleQualityReport;
  rangeStart: number;
  rangeEnd: number;
};

const runOnSlice = (
  candles: import("../backtest/types.js").NormalizedCandle[],
  params: ParamSet,
  start: number,
  end: number,
  balance: number,
  feeRate: number,
  entryMode: "close" | "nextOpen"
): StrategyBacktestResult => {
  const slice = candles.filter((c) => c.openTime >= start && c.openTime < end);
  const cache = buildDiscoveryIndicatorCache(slice, adaptiveRegimeStrategy.indicatorReq);
  return adaptiveRegimeStrategy.run({
    candles: slice,
    cache,
    params: mergeParams(adaptiveRegimeStrategy.defaults, params),
    initialBalance: balance,
    entryMode,
    feeRate,
    leverage: num(process.env.BACKTEST_LEVERAGE, 5),
    riskPct: num(process.env.BACKTEST_RISK_PCT, 1),
    backtestMsSpan: end - start,
  });
};

const runWalkForward = (
  cfg: RunConfig,
  params: ParamSet,
  windows: ReturnType<typeof buildRollingWalkForwardSlices>,
  balance: number,
  feeRate: number,
  entryMode: "close" | "nextOpen"
): WalkForwardWindowResult[] =>
  windows.map((slice) => {
    const train = runOnSlice(cfg.candles, params, slice.trainStart, slice.trainEnd, balance, feeRate, entryMode);
    const val = runOnSlice(cfg.candles, params, slice.trainEnd, slice.valEnd, balance, feeRate, entryMode);
    const oos = runOnSlice(cfg.candles, params, slice.valEnd, slice.oosEnd, balance, feeRate, entryMode);
    return evaluateWalkForwardWindow(cfg.symbol, train, val, oos, slice, balance);
  });

type CandidateResult = {
  symbol: string;
  timeframe: string;
  params: ParamSet;
  score: CandidateScore;
  bucket: CandidateBucket;
  windows: WalkForwardWindowResult[];
  fullPeriod?: PeriodReport;
};

const loadConfig = async (symbol: string, months: number, timeframe: string, endTimeMs: number): Promise<RunConfig> => {
  const cacheDir = path.resolve(process.env.BACKTEST_CACHE_DIR ?? "data/cache");
  const load = await loadBinanceFuturesCandles(symbol, {
    cacheDir,
    months,
    endTimeMs,
    minCoveragePct: MIN_COVERAGE_PCT,
  });
  const candles = resolveStrategyCandles(load.candles, timeframe);
  return {
    symbol,
    timeframe,
    candles,
    quality: load.quality,
    rangeStart: candles[0]!.openTime,
    rangeEnd: (candles[candles.length - 1]?.closeTime ?? Date.now()) + 1,
  };
};

const recommendationFrom = (
  candidates: CandidateResult[],
  dataReliable: boolean
): "live" | "paper_only" | "reject" => {
  if (!dataReliable) return "reject";
  const target = candidates.find((c) => c.bucket === "target" && !c.score.rejected);
  if (target) return "paper_only";
  const stable = candidates.filter((c) => c.bucket === "stable_low_risk" && !c.score.rejected);
  if (stable.length && stable[0]!.score.avgOosMonthlyPct >= 2) return "paper_only";
  return "reject";
};

const main = async () => {
  const outputDir = path.resolve(process.env.BACKTEST_OUTPUT_DIR ?? "data/results");
  const months = num(process.env.BACKTEST_MONTHS, 12);
  const forceRefresh = bool(process.env.BACKTEST_FORCE_REFRESH, false);
  const refreshFirst = bool(process.env.ADAPTIVE_REFRESH_DATA, forceRefresh);
  const symbols = (process.env.ADAPTIVE_SYMBOLS ?? DEFAULT_SYMBOLS).split(",").map((s) => s.trim());
  const timeframes = (process.env.ADAPTIVE_TIMEFRAMES ?? "1m,3m").split(",").map((s) => s.trim());
  const wfWindows = num(process.env.ADAPTIVE_WF_WINDOWS, 4);
  const startBalance = num(process.env.BACKTEST_INITIAL_BALANCE, 100);
  const feeRate = num(process.env.BACKTEST_FEE_RATE, 0.00035);
  const entryMode = process.env.BACKTEST_ENTRY_MODE === "close" ? "close" : "nextOpen";
  const endTimeMs = num(process.env.BACKTEST_END_TIME_MS, Date.now());

  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n=== ADAPTIVE REGIME — WALK-FORWARD BACKTEST ===`);
  console.log(`source=${BINANCE_FUTURES_SOURCE}\n`);

  if (refreshFirst) {
    console.log("[STEP 1] Downloading Binance Futures candles...\n");
    for (const symbol of symbols) {
      try {
        const r = await refreshBinanceSymbolData(symbol, months, true);
        console.log(formatQualityReport(r));
      } catch (e) {
        console.error(`[FAIL] ${symbol}`, e);
      }
    }
  }

  const qualityReports: CandleQualityReport[] = [];
  const allCandidates: CandidateResult[] = [];
  let dataReliable = true;

  for (const symbol of symbols) {
    for (const timeframe of timeframes) {
      console.log(`\n========== ${symbol} ${timeframe} (${BINANCE_FUTURES_SOURCE}) ==========\n`);
      let cfg: RunConfig;
      try {
        cfg = await loadConfig(symbol, months, timeframe, endTimeMs);
      } catch (e) {
        if (e instanceof BinanceCacheMissingError) {
          console.error(e.message);
          console.error("Run: npm run binance-refresh");
          dataReliable = false;
          continue;
        }
        throw e;
      }

      if (!qualityReports.some((q) => q.symbol === cfg.quality.symbol && q.cachePath === cfg.quality.cachePath)) {
        qualityReports.push(cfg.quality);
      }
      console.log(formatQualityReport(cfg.quality));

      if (!cfg.quality.reliable) {
        dataReliable = false;
        console.warn(
          `[SKIP] ${symbol} ${timeframe} — coverage ${cfg.quality.coveragePct}% < ${MIN_COVERAGE_PCT}% or quality failed. Results invalid.`
        );
        console.warn(`Run: npm run binance-refresh\n`);
        continue;
      }

      const slices = buildRollingWalkForwardSlices(cfg.rangeStart, cfg.rangeEnd, wfWindows);
      console.log(`[STEP 2] Walk-forward: ${wfWindows} windows, ${OPTIMIZER_GRID.length} param sets\n`);

      let best: CandidateResult | null = null;

      for (let pi = 0; pi < OPTIMIZER_GRID.length; pi++) {
        const params = OPTIMIZER_GRID[pi]!;
        const windows = runWalkForward(cfg, params, slices, startBalance, feeRate, entryMode);
        const score = scoreWalkForwardCandidate(windows, { minOosTrades: 15, minPositiveWindows: 2 });
        const bucket = classifyCandidate(score, TARGET_MONTHLY, TARGET_DD);

        console.log(
          `  [${pi + 1}/${OPTIMIZER_GRID.length}] score=${score.composite.toFixed(1)} bucket=${bucket} oosAvgMo=${score.avgOosMonthlyPct.toFixed(2)}% oosDD=${score.avgOosDdPct.toFixed(2)}% posWin=${score.oosWindowsPositive}/${wfWindows} reject=${score.rejectReasons.join(",") || "none"}`
        );

        const cand: CandidateResult = { symbol, timeframe, params, score, bucket, windows };
        allCandidates.push(cand);
        if (!best || score.composite > best.score.composite) best = cand;
      }

      if (best) {
        const full = runOnSlice(cfg.candles, best.params, cfg.rangeStart, cfg.rangeEnd, startBalance, feeRate, entryMode);
        best.fullPeriod = buildPeriodReport("full", full.trades, cfg.rangeStart, cfg.rangeEnd, startBalance);
        const paths = exportArtifacts(full, outputDir);
        const tag = `${symbol}_${timeframe}`.replace(/[^a-zA-Z0-9]/g, "_");
        const jsonPath = path.join(outputDir, `adaptive-regime-${tag}-wf.json`);
        writeJson(jsonPath, {
          source: BINANCE_FUTURES_SOURCE,
          symbol,
          timeframe,
          dataReliable: true,
          quality: cfg.quality,
          best,
          walkForwardWindows: best.windows,
          tradeHistoryPath: paths.tradeHistoryPath,
          equityCurvePath: paths.equityCurvePath,
        });

        console.log(`\n[BEST ${symbol} ${timeframe}] bucket=${best.bucket}`);
        console.log(`  OOS avg month: ${best.score.avgOosMonthlyPct.toFixed(2)}% | DD: ${best.score.avgOosDdPct.toFixed(2)}%`);
        console.log("\n  Walk-forward (train / val / OOS):");
        for (const w of best.windows) {
          const t = w.train.metrics;
          const v = w.validation.metrics;
          const o = w.outOfSample.metrics;
          console.log(
            `    W${w.slice.windowIndex}: train ${t.netPnLPct.toFixed(2)}% | val ${v.netPnLPct.toFixed(2)}% | oos ${o.netPnLPct.toFixed(2)}% (DD ${o.maxDrawdownPct.toFixed(2)}%, ${o.tradesCount} tr)`
          );
        }
        console.log(formatMetricsTable(best.windows.map((w) => w.outOfSample)));
        if (best.fullPeriod) console.log(formatRegimeTable(best.fullPeriod));
        console.log(`  Trades: ${paths.tradeHistoryPath}\n`);
      }
    }
  }

  const rec = recommendationFrom(allCandidates, dataReliable);
  const sorted = [...allCandidates].sort((a, b) => b.score.composite - a.score.composite);

  const pickBest = (fn: (c: CandidateResult) => number, dir: "max" | "min") => {
    const pool = sorted.filter((c) => c.score.totalOosTrades >= 10);
    if (!pool.length) return null;
    let best = pool[0]!;
    for (let i = 1; i < pool.length; i++) {
      const c = pool[i]!;
      if (dir === "max" ? fn(c) > fn(best) : fn(c) < fn(best)) best = c;
    }
    return best;
  };
  const realisticCandidates = {
    stable_low_risk: pickBest((c) => c.score.avgOosMonthlyPct - c.score.avgOosDdPct * 2, "max"),
    best_return: pickBest((c) => c.score.avgOosMonthlyPct, "max"),
    best_drawdown: pickBest((c) => c.score.avgOosDdPct, "min"),
  };

  const tableRows = sorted.map((c) => ({
    symbol: c.symbol,
    tf: c.timeframe,
    bucket: c.bucket,
    composite: c.score.composite,
    oosAvgMonth: c.score.avgOosMonthlyPct,
    oosDD: c.score.avgOosDdPct,
    oosPF: c.score.avgOosPf,
    posWindows: c.score.oosWindowsPositive,
    rejected: c.score.rejected,
    rejectReasons: c.score.rejectReasons,
  }));

  const targetHit = sorted.some((c) => c.bucket === "target");
  const reportMd = [
    "# Adaptive Regime — Walk-Forward Report",
    "",
    `Source: **${BINANCE_FUTURES_SOURCE}**`,
    `Generated: ${new Date(endTimeMs).toISOString()}`,
    "",
    "## Data quality",
    "",
    ...qualityReports.map((q) => formatQualityReport(q)),
    "",
    `**Overall data reliable (≥${MIN_COVERAGE_PCT}% coverage):** ${dataReliable ? "YES" : "NO — optimization skipped or invalid"}`,
    "",
    "## Target",
    "",
    `- Avg monthly return ≥ **${TARGET_MONTHLY}%**`,
    `- Max drawdown ≤ **${TARGET_DD}%**`,
    `- Walk-forward: **${wfWindows}** rolling windows`,
    "",
    `**Primary target met:** ${targetHit ? "YES" : "NO"}`,
    "",
    "## Walk-forward detail (best per symbol/TF)",
    "",
    ...(sorted.length
      ? sorted
          .filter((c, i, arr) => arr.findIndex((x) => x.symbol === c.symbol && x.timeframe === c.timeframe) === i)
          .flatMap((c) => {
            const bestFor = sorted
              .filter((x) => x.symbol === c.symbol && x.timeframe === c.timeframe)
              .sort((a, b) => b.score.composite - a.score.composite)[0]!;
            return [
              `### ${bestFor.symbol} ${bestFor.timeframe}`,
              "",
              "| Window | Train net % | Val net % | OOS net % | OOS DD % | OOS trades |",
              "|-------:|------------:|----------:|----------:|---------:|-----------:|",
              ...bestFor.windows.map((w) => {
                const tr = w.train.metrics.netPnLPct;
                const va = w.validation.metrics.netPnLPct;
                const oo = w.outOfSample.metrics.netPnLPct;
                const dd = w.outOfSample.metrics.maxDrawdownPct;
                const tc = w.outOfSample.metrics.tradesCount;
                return `| ${w.slice.windowIndex} | ${tr.toFixed(2)} | ${va.toFixed(2)} | ${oo.toFixed(2)} | ${dd.toFixed(2)} | ${tc} |`;
              }),
              "",
            ];
          })
      : ["_No optimization runs — refresh Binance data first._", ""]),
    "",
    "## Best candidates",
    "",
    "| Symbol | TF | Bucket | Score | OOS avg mo % | OOS DD % | OOS PF | +windows | Rejected |",
    "|--------|-----|--------|------:|-------------:|---------:|-------:|---------:|:--------:|",
    ...(tableRows.length
      ? tableRows.map(
          (r) =>
            `| ${r.symbol} | ${r.tf} | ${r.bucket} | ${r.composite.toFixed(1)} | ${r.oosAvgMonth.toFixed(2)} | ${r.oosDD.toFixed(2)} | ${r.oosPF.toFixed(2)} | ${r.posWindows} | ${r.rejected ? r.rejectReasons.join(";") : "no"} |`
        )
      : ["| — | — | — | — | — | — | — | — | — |"]),
    "",
    "## Final recommendation",
    "",
    `**${rec.toUpperCase()}**`,
    "",
    "### Realistic candidates",
    "",
    realisticCandidates.stable_low_risk
      ? `- **Stable / low risk:** ${realisticCandidates.stable_low_risk.symbol} ${realisticCandidates.stable_low_risk.timeframe}`
      : "- **Stable / low risk:** none",
    realisticCandidates.best_return
      ? `- **Best return:** ${realisticCandidates.best_return.symbol} ${realisticCandidates.best_return.timeframe}`
      : "- **Best return:** none",
    realisticCandidates.best_drawdown
      ? `- **Best drawdown:** ${realisticCandidates.best_drawdown.symbol} ${realisticCandidates.best_drawdown.timeframe}`
      : "- **Best drawdown:** none",
  ].join("\n");

  const reportPath = path.join(outputDir, "adaptive-regime-walkforward-report.md");
  const finalPath = path.join(outputDir, "adaptive-regime-walkforward-final.json");
  const candidatesPath = path.join(outputDir, "adaptive-regime-candidates.json");
  fs.writeFileSync(reportPath, reportMd);
  writeJson(candidatesPath, {
    source: BINANCE_FUTURES_SOURCE,
    generatedAt: new Date(endTimeMs).toISOString(),
    dataReliable,
    targetMonthly: TARGET_MONTHLY,
    targetMaxDd: TARGET_DD,
    candidates: tableRows,
    realisticCandidates,
  });
  writeJson(finalPath, {
    source: BINANCE_FUTURES_SOURCE,
    generatedAt: new Date(endTimeMs).toISOString(),
    dataReliable,
    recommendation: rec,
    targetMet: targetHit,
    qualityReports,
    candidates: tableRows,
    realisticCandidates,
  });

  console.log("\n=== COMPLETE ===\n");
  console.log(`source=${BINANCE_FUTURES_SOURCE}`);
  console.log(`Data reliable: ${dataReliable}`);
  console.log(`Recommendation: ${rec}`);
  console.log(`Target (10%/mo, 5% DD) met: ${targetHit}`);
  console.log(`Report: ${reportPath}`);
  console.log(`Candidates: ${candidatesPath}`);
  console.log(`JSON: ${finalPath}\n`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
