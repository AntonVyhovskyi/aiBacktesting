import "dotenv/config";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  BINANCE_FUTURES_SOURCE,
  BinanceCacheMissingError,
  downloadBinanceFuturesCandles,
  getBinanceCachePath,
  loadBinanceFuturesCandles,
} from "../backtest/fetchBinanceFuturesCandles.js";
import { resolveStrategyCandles } from "../backtest/candleTimeframe.js";
import { formatQualityReport, type CandleQualityReport } from "../backtest/candleValidate.js";
import type { NormalizedCandle } from "../backtest/types.js";
import { buildDiscoveryIndicatorCache, type DiscoveryIndicatorCache } from "./indicatorCache.js";
import { cartesian, mergeParams } from "./grids.js";
import { evaluateStableProfit, type MonthlyProfitMetrics } from "./stableProfitEvaluation.js";
import { adaptiveRegimeStrategy } from "./strategies/adaptiveRegimeStrategy.js";
import type { DiscoveryMetrics, StrategyBacktestResult } from "./types.js";
import { writeJson } from "./progressive/output.js";

const SYMBOL = "SOLUSDT";
const TIMEFRAME = "15m";
const MONTHS = 6;
const DEFAULT_END_TIME_MS = 1777593600000;
const TOP_N = 30;
const BINANCE_ARCHIVE_MONTHLY_BASE_URL = "https://data.binance.vision/data/futures/um/monthly/klines";

type ParamSet = Record<string, number>;

type MonthlyBreakdown = Pick<
  MonthlyProfitMetrics,
  | "monthKey"
  | "netPnL"
  | "netPnLPct"
  | "grossPnL"
  | "fees"
  | "tradesCount"
  | "winRate"
  | "profitFactor"
  | "maxDrawdownPct"
  | "isFullMonth"
>;

type ScoreBreakdown = {
  netReturn: number;
  monthlyAverage: number;
  worstMonth: number;
  profitFactor: number;
  profitableMonths: number;
  losingMonths: number;
  drawdown: number;
  monthlyStdDev: number;
  tradeCount: number;
  overtrade: number;
  feeDrag: number;
  hardPenalties: number;
};

type RangeSearchResult = {
  rank: number;
  stage: "stage1" | "stage2";
  score: number;
  scoreBreakdown: ScoreBreakdown;
  params: ParamSet;
  metrics: Pick<
    DiscoveryMetrics,
    | "netPnL"
    | "netPnLPct"
    | "grossPnL"
    | "totalFees"
    | "profitFactor"
    | "maxDrawdownPct"
    | "tradesCount"
    | "tradesPerDay"
    | "totalNotional"
    | "winRate"
    | "averagePnLPerTrade"
  >;
  averageMonthlyPnLPct: number;
  worstMonthlyPnLPct: number;
  bestMonthlyPnLPct: number;
  profitableMonths: number;
  losingMonths: number;
  monthlyPnLStdDev: number;
  feeToGrossProfitPct: number;
  grossProfit: number;
  grossLossAbs: number;
  monthly: MonthlyBreakdown[];
  diagnostics: StrategyBacktestResult["diagnostics"];
  stabilityFlags: {
    positiveNet: boolean;
    profitFactorAboveOne: boolean;
    lowDrawdown: boolean;
    enoughTrades: boolean;
    notOvertrading: boolean;
    feesControlled: boolean;
    mostlyProfitableMonths: boolean;
  };
};

type RunConfig = {
  symbol: string;
  timeframe: string;
  candles: NormalizedCandle[];
  cache: DiscoveryIndicatorCache;
  quality: CandleQualityReport;
  rangeStart: number;
  rangeEnd: number;
  startBalance: number;
  feeRate: number;
  entryMode: "close" | "nextOpen";
};

const SEARCH_PARAM_KEYS = [
  "adxRangeMax",
  "rsiOversold",
  "rsiOverbought",
  "rangeVwapDistPct",
  "rangeTpPct",
  "rangeBandBufferPct",
  "atrMult",
  "riskMultRange",
  "minMoveVsFeeMult",
  "minVolumeMult",
  "cooldownCandles",
  "maxTradesPerDay",
] as const;

const ENTRY_PARAM_KEYS = [
  "adxRangeMax",
  "rsiOversold",
  "rsiOverbought",
  "rangeVwapDistPct",
  "rangeTpPct",
  "rangeBandBufferPct",
  "atrMult",
] as const;

const RANGE_ONLY_PARAMS: ParamSet = {
  tradeTrend: 0,
  tradeRange: 1,
  tradeHighVol: 0,
  tradeCompression: 0,
  tradeTransition: 0,
};

const STAGE1_FIXED_PARAMS: ParamSet = {
  riskMultRange: 0.5,
  minMoveVsFeeMult: 1,
  minVolumeMult: 0,
  cooldownCandles: 4,
  maxTradesPerDay: 6,
};

const RSI_PAIRS: Array<Pick<ParamSet, "rsiOversold" | "rsiOverbought">> = [
  { rsiOversold: 24, rsiOverbought: 76 },
  { rsiOversold: 26, rsiOverbought: 74 },
  { rsiOversold: 28, rsiOverbought: 72 },
  { rsiOversold: 30, rsiOverbought: 70 },
  { rsiOversold: 32, rsiOverbought: 68 },
  { rsiOversold: 26, rsiOverbought: 70 },
  { rsiOversold: 30, rsiOverbought: 74 },
];

const num = (v: string | undefined, fb: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const bool = (v: string | undefined, fb: boolean): boolean => {
  if (!v) return fb;
  return v === "1" || v.toLowerCase() === "true";
};

const r = (v: number, digits = 6): number => Math.round(v * 10 ** digits) / 10 ** digits;

const fmt = (v: number, digits = 2): string => v.toFixed(digits);

const compactParams = (params: Record<string, number | string>): ParamSet => {
  const out: ParamSet = {};
  for (const key of SEARCH_PARAM_KEYS) out[key] = Number(params[key]);
  return out;
};

const paramKey = (params: ParamSet): string =>
  SEARCH_PARAM_KEYS.map((key) => `${key}:${params[key]}`).join("|");

const baseRunParams = (): ParamSet => ({
  ...RANGE_ONLY_PARAMS,
  riskPct: num(process.env.BACKTEST_RISK_PCT, 0.5),
  leverage: num(process.env.BACKTEST_LEVERAGE, 3),
  maxPortfolioDrawdownPct: num(process.env.ADAPTIVE_RANGE_MAX_PORTFOLIO_DD_PCT, 5),
  maxDailyLossPct: num(process.env.ADAPTIVE_RANGE_MAX_DAILY_LOSS_PCT, 2),
});

const archiveMonthKeys = (startTimeMs: number, endTimeMs: number): string[] => {
  const start = new Date(startTimeMs);
  const end = new Date(endTimeMs - 1);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1);
  const out: string[] = [];
  while (cursor.getTime() <= last) {
    out.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
};

const parseArchiveCsv = (csv: string, startTimeMs: number, endTimeMs: number): NormalizedCandle[] => {
  const candles: NormalizedCandle[] = [];
  for (const line of csv.split(/\r?\n/)) {
    if (!line) continue;
    const cols = line.split(",");
    const openTime = Number(cols[0]);
    if (!Number.isFinite(openTime) || openTime < startTimeMs || openTime >= endTimeMs) continue;
    candles.push({
      openTime,
      open: Number(cols[1]),
      high: Number(cols[2]),
      low: Number(cols[3]),
      close: Number(cols[4]),
      volume: Number(cols[5]),
      closeTime: Number(cols[6]),
    });
  }
  return candles;
};

const downloadBinanceArchiveCache = async (
  symbol: string,
  interval: string,
  cacheDir: string,
  months: number,
  startTimeMs: number,
  endTimeMs: number
): Promise<string> => {
  const cachePath = getBinanceCachePath(cacheDir, symbol, interval, months);
  const byOpenTime = new Map<number, NormalizedCandle>();

  for (const monthKey of archiveMonthKeys(startTimeMs, endTimeMs)) {
    const url = `${BINANCE_ARCHIVE_MONTHLY_BASE_URL}/${symbol}/${interval}/${symbol}-${interval}-${monthKey}.zip`;
    console.log(`[BINANCE_ARCHIVE] ${url}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(num(process.env.BINANCE_ARCHIVE_TIMEOUT_MS, 60_000)) });
    if (!res.ok) {
      throw new Error(`Binance archive download failed: ${url} HTTP ${res.status}`);
    }

    const zipPath = path.join(os.tmpdir(), `${symbol}-${interval}-${monthKey}-${Date.now()}.zip`);
    try {
      fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
      const csv = execFileSync("unzip", ["-p", zipPath], { maxBuffer: 100 * 1024 * 1024 }).toString("utf8");
      const candles = parseArchiveCsv(csv, startTimeMs, endTimeMs);
      for (const candle of candles) byOpenTime.set(candle.openTime, candle);
      console.log(`[BINANCE_ARCHIVE] ${monthKey}: kept ${candles.length.toLocaleString()} candles`);
    } finally {
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    }
  }

  const candles = [...byOpenTime.values()].sort((a, b) => a.openTime - b.openTime);
  if (!candles.length) throw new Error(`Binance archive returned no ${symbol} ${interval} candles`);

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(
    cachePath,
    JSON.stringify({
      source: BINANCE_FUTURES_SOURCE,
      symbol,
      interval,
      months,
      startTimeMs,
      endTimeMs,
      downloadedAt: new Date().toISOString(),
      complete: true,
      candles,
    })
  );
  console.log(`[BINANCE_ARCHIVE] wrote ${candles.length.toLocaleString()} candles → ${cachePath}`);
  return cachePath;
};

const buildStage1Params = (): ParamSet[] => {
  const entryGrid = cartesian({
    adxRangeMax: [14, 16, 18, 20, 22],
    rangeVwapDistPct: [0.1, 0.15, 0.2, 0.25],
    rangeTpPct: [0.2, 0.3, 0.4, 0.5],
    rangeBandBufferPct: [0, 0.05, 0.1, 0.15],
    atrMult: [0.8, 1, 1.2],
  });
  const base = baseRunParams();
  const out: ParamSet[] = [];
  for (const entry of entryGrid) {
    for (const rsi of RSI_PAIRS) {
      out.push({ ...base, ...STAGE1_FIXED_PARAMS, ...entry, ...rsi });
    }
  }
  return out;
};

const buildStage2Params = (stage1Top: RangeSearchResult[]): ParamSet[] => {
  const riskGrid = cartesian({
    riskMultRange: [0.35, 0.5, 0.7],
    minMoveVsFeeMult: [0, 1.5, 2.5],
    minVolumeMult: [0, 1, 1.2],
    cooldownCandles: [0, 4, 8],
    maxTradesPerDay: [3, 6, 12],
  });
  const base = baseRunParams();
  const seen = new Set<string>();
  const out: ParamSet[] = [];

  for (const top of stage1Top) {
    const entry: ParamSet = {};
    for (const key of ENTRY_PARAM_KEYS) entry[key] = top.params[key]!;
    for (const risk of riskGrid) {
      const params = { ...base, ...entry, ...risk };
      const key = paramKey(compactParams(params));
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(params);
    }
  }

  return out;
};

const loadMarketData = async (): Promise<RunConfig> => {
  const outputCacheDir = path.resolve(process.env.BACKTEST_CACHE_DIR ?? "data/cache");
  const endTimeMs = num(process.env.BACKTEST_END_TIME_MS, DEFAULT_END_TIME_MS);
  const startTimeMs = endTimeMs - MONTHS * 30 * 86400000;
  const minCoveragePct = num(process.env.BINANCE_MIN_COVERAGE_PCT, 90);
  const startBalance = num(process.env.BACKTEST_INITIAL_BALANCE, 100);
  const feeRate = num(process.env.BACKTEST_FEE_RATE, 0.00035);
  const entryMode = process.env.BACKTEST_ENTRY_MODE === "close" ? "close" : "nextOpen";

  let load;
  try {
    load = await loadBinanceFuturesCandles(SYMBOL, {
      cacheDir: outputCacheDir,
      months: MONTHS,
      endTimeMs,
      minCoveragePct,
    });
  } catch (e) {
    if (!(e instanceof BinanceCacheMissingError)) throw e;

    if (!bool(process.env.ADAPTIVE_RANGE_DISABLE_ARCHIVE, false)) {
      console.warn(`[BINANCE_CACHE] Missing cache for ${SYMBOL} ${MONTHS}m; attempting Binance public archive.`);
      try {
        await downloadBinanceArchiveCache(SYMBOL, "1m", outputCacheDir, MONTHS, startTimeMs, endTimeMs);
        load = await loadBinanceFuturesCandles(SYMBOL, {
          cacheDir: outputCacheDir,
          months: MONTHS,
          endTimeMs,
          minCoveragePct,
        });
      } catch (archiveError) {
        console.warn(`[BINANCE_ARCHIVE] failed: ${archiveError}`);
        if (!bool(process.env.ADAPTIVE_RANGE_ALLOW_DOWNLOAD, false)) throw archiveError;
      }
    }

    if (!load) {
      if (!bool(process.env.ADAPTIVE_RANGE_ALLOW_DOWNLOAD, false)) throw e;
      console.warn(`[BINANCE_CACHE] Missing cache for ${SYMBOL} ${MONTHS}m; attempting Binance Futures REST.`);
      load = await downloadBinanceFuturesCandles(SYMBOL, "1m", {
        cacheDir: outputCacheDir,
        months: MONTHS,
        endTimeMs,
        minCoveragePct,
        requestDelayMs: num(process.env.BINANCE_REQUEST_DELAY_MS, 250),
        maxRetries: num(process.env.BINANCE_MAX_RETRIES, 8),
        retryDelayMs: num(process.env.BINANCE_RETRY_DELAY_MS, 2000),
      });
    }
  }

  if (!load.quality.reliable) {
    throw new Error(`Unreliable Binance cache/data for ${SYMBOL}: coverage=${load.quality.coveragePct}%`);
  }

  const candles = resolveStrategyCandles(load.candles, TIMEFRAME);
  if (candles.length < 200) throw new Error(`Not enough ${TIMEFRAME} candles after resampling: ${candles.length}`);

  const cache = buildDiscoveryIndicatorCache(candles, adaptiveRegimeStrategy.indicatorReq);
  return {
    symbol: SYMBOL,
    timeframe: TIMEFRAME,
    candles,
    cache,
    quality: load.quality,
    rangeStart: endTimeMs - MONTHS * 30 * 86400000,
    rangeEnd: endTimeMs,
    startBalance,
    feeRate,
    entryMode,
  };
};

const runStrategy = (cfg: RunConfig, params: ParamSet): StrategyBacktestResult =>
  adaptiveRegimeStrategy.run({
    candles: cfg.candles,
    cache: cfg.cache,
    params: mergeParams(adaptiveRegimeStrategy.defaults, params),
    initialBalance: cfg.startBalance,
    entryMode: cfg.entryMode,
    feeRate: cfg.feeRate,
    leverage: params.leverage ?? 3,
    riskPct: params.riskPct ?? 0.5,
    backtestMsSpan: cfg.rangeEnd - cfg.rangeStart,
  });

const grossProfitStats = (result: StrategyBacktestResult) => {
  const grossProfit = result.trades.filter((t) => t.grossPnL > 0).reduce((sum, t) => sum + t.grossPnL, 0);
  const grossLossAbs = Math.abs(
    result.trades.filter((t) => t.grossPnL < 0).reduce((sum, t) => sum + t.grossPnL, 0)
  );
  const feeToGrossProfitPct =
    grossProfit > 0 ? (result.metrics.totalFees / grossProfit) * 100 : result.metrics.totalFees > 0 ? 999 : 0;
  return { grossProfit: r(grossProfit), grossLossAbs: r(grossLossAbs), feeToGrossProfitPct: r(feeToGrossProfitPct) };
};

const scoreResult = (
  result: StrategyBacktestResult,
  averageMonthlyPnLPct: number,
  worstMonthlyPnLPct: number,
  profitableMonths: number,
  losingMonths: number,
  monthlyPnLStdDev: number,
  feeToGrossProfitPct: number
): { score: number; scoreBreakdown: ScoreBreakdown } => {
  const m = result.metrics;
  const cappedPf = m.profitFactor >= 999 ? 3 : Math.min(Math.max(m.profitFactor, 0), 3);
  const tradeCount =
    m.tradesCount < 15
      ? -(15 - m.tradesCount) * 10
      : m.tradesCount > 120
        ? 45 - (m.tradesCount - 120) * 0.5
        : Math.min(m.tradesCount, 90) * 0.5;
  const overtrade = m.tradesPerDay > 1.25 ? -(m.tradesPerDay - 1.25) * 45 : 0;
  const feeDrag = feeToGrossProfitPct > 45 ? -(feeToGrossProfitPct - 45) * 1.4 : 0;
  let hardPenalties = 0;
  if (m.netPnL <= 0) hardPenalties -= 100;
  if (m.profitFactor < 1) hardPenalties -= (1 - m.profitFactor) * 140;
  if (m.totalFees > 0 && feeToGrossProfitPct >= 100) hardPenalties -= 120;
  if (m.tradesCount < 10) hardPenalties -= 80;

  const scoreBreakdown: ScoreBreakdown = {
    netReturn: m.netPnLPct * 5,
    monthlyAverage: averageMonthlyPnLPct * 10,
    worstMonth: worstMonthlyPnLPct * 8,
    profitFactor: cappedPf * 35,
    profitableMonths: profitableMonths * 45,
    losingMonths: -losingMonths * 65,
    drawdown: -m.maxDrawdownPct * 14,
    monthlyStdDev: -monthlyPnLStdDev * 9,
    tradeCount,
    overtrade,
    feeDrag,
    hardPenalties,
  };

  const score = Object.values(scoreBreakdown).reduce((sum, part) => sum + part, 0);
  return { score: r(score), scoreBreakdown };
};

const toMonthlyBreakdown = (monthly: MonthlyProfitMetrics[]): MonthlyBreakdown[] =>
  monthly.map((m) => ({
    monthKey: m.monthKey,
    netPnL: m.netPnL,
    netPnLPct: m.netPnLPct,
    grossPnL: m.grossPnL,
    fees: m.fees,
    tradesCount: m.tradesCount,
    winRate: m.winRate,
    profitFactor: m.profitFactor,
    maxDrawdownPct: m.maxDrawdownPct,
    isFullMonth: m.isFullMonth,
  }));

const evaluateParams = (cfg: RunConfig, params: ParamSet, stage: "stage1" | "stage2"): RangeSearchResult => {
  const result = runStrategy(cfg, params);
  const stable = evaluateStableProfit(result, cfg.rangeStart, cfg.rangeEnd, cfg.startBalance);
  const { grossProfit, grossLossAbs, feeToGrossProfitPct } = grossProfitStats(result);
  const { score, scoreBreakdown } = scoreResult(
    result,
    stable.averageMonthlyPnLPct,
    stable.worstMonthlyPnLPct,
    stable.profitableMonths,
    stable.losingMonths,
    stable.monthlyPnLStdDev,
    feeToGrossProfitPct
  );
  const compact = compactParams(result.params);

  return {
    rank: 0,
    stage,
    score,
    scoreBreakdown,
    params: compact,
    metrics: {
      netPnL: result.metrics.netPnL,
      netPnLPct: result.metrics.netPnLPct,
      grossPnL: result.metrics.grossPnL,
      totalFees: result.metrics.totalFees,
      profitFactor: result.metrics.profitFactor,
      maxDrawdownPct: result.metrics.maxDrawdownPct,
      tradesCount: result.metrics.tradesCount,
      tradesPerDay: result.metrics.tradesPerDay,
      totalNotional: result.metrics.totalNotional,
      winRate: result.metrics.winRate,
      averagePnLPerTrade: result.metrics.averagePnLPerTrade,
    },
    averageMonthlyPnLPct: stable.averageMonthlyPnLPct,
    worstMonthlyPnLPct: stable.worstMonthlyPnLPct,
    bestMonthlyPnLPct: stable.bestMonthlyPnLPct,
    profitableMonths: stable.profitableMonths,
    losingMonths: stable.losingMonths,
    monthlyPnLStdDev: stable.monthlyPnLStdDev,
    feeToGrossProfitPct,
    grossProfit,
    grossLossAbs,
    monthly: toMonthlyBreakdown(stable.monthly),
    diagnostics: result.diagnostics,
    stabilityFlags: {
      positiveNet: result.metrics.netPnL > 0,
      profitFactorAboveOne: result.metrics.profitFactor > 1,
      lowDrawdown: result.metrics.maxDrawdownPct <= 5,
      enoughTrades: result.metrics.tradesCount >= 15,
      notOvertrading: result.metrics.tradesPerDay <= 1.25,
      feesControlled: feeToGrossProfitPct < 75,
      mostlyProfitableMonths: stable.profitableMonths > stable.losingMonths,
    },
  };
};

const evaluateMany = (cfg: RunConfig, paramsList: ParamSet[], stage: "stage1" | "stage2"): RangeSearchResult[] => {
  const out: RangeSearchResult[] = [];
  let best: RangeSearchResult | null = null;
  for (let i = 0; i < paramsList.length; i++) {
    const row = evaluateParams(cfg, paramsList[i]!, stage);
    out.push(row);
    if (!best || row.score > best.score) best = row;
    if ((i + 1) % 250 === 0 || i + 1 === paramsList.length) {
      const bestMsg = best
        ? `best=${fmt(best.score, 1)} net=${fmt(best.metrics.netPnLPct)}% pf=${fmt(best.metrics.profitFactor)} trades=${best.metrics.tradesCount}`
        : "best=n/a";
      console.log(`[${stage}] ${i + 1}/${paramsList.length} ${bestMsg}`);
    }
  }
  return out;
};

const rankResults = (results: RangeSearchResult[]): RangeSearchResult[] => {
  const bestByKey = new Map<string, RangeSearchResult>();
  for (const row of results) {
    const key = paramKey(row.params);
    const current = bestByKey.get(key);
    if (!current || row.score > current.score) bestByKey.set(key, row);
  }
  return [...bestByKey.values()]
    .sort((a, b) => b.score - a.score || b.metrics.netPnLPct - a.metrics.netPnLPct)
    .map((row, i) => ({ ...row, rank: i + 1 }));
};

const paramsInline = (params: ParamSet): string =>
  SEARCH_PARAM_KEYS.map((key) => `${key}=${params[key]}`).join(", ");

const monthlyInline = (monthly: MonthlyBreakdown[]): string =>
  monthly.map((m) => `${m.monthKey}: ${fmt(m.netPnLPct)}%/${m.tradesCount}tr`).join("; ");

const recommendation = (top: RangeSearchResult[]): string => {
  const best = top[0];
  if (!best) return "No range-only candidates were evaluated.";
  const stableEnough =
    best.metrics.netPnL > 0 &&
    best.metrics.profitFactor > 1 &&
    best.metrics.tradesCount >= 15 &&
    best.worstMonthlyPnLPct > -2 &&
    best.profitableMonths >= Math.max(3, best.losingMonths + 1) &&
    best.feeToGrossProfitPct < 75;
  if (stableEnough) {
    return "The best range-only parameter set is positive and comparatively stable. Treat it as a paper-trading candidate, not a production change, because the search is single-symbol/single-period.";
  }
  return "No range-only parameter set clears the stability bar. Based on this search, keeping RANGE disabled is safer than enabling these candidates live.";
};

const buildMarkdown = (cfg: RunConfig, ranked: RangeSearchResult[], stage1Count: number, stage2Count: number): string => {
  const top = ranked.slice(0, TOP_N);
  const best = top[0];
  return [
    "# Adaptive Regime RANGE Param Search",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Source: **${BINANCE_FUTURES_SOURCE}**`,
    `Symbol/timeframe: **${cfg.symbol} ${cfg.timeframe}**`,
    `Period: ${new Date(cfg.rangeStart).toISOString()} -> ${new Date(cfg.rangeEnd).toISOString()}`,
    `Search size: stage1=${stage1Count}, stage2=${stage2Count}, unique=${ranked.length}`,
    "",
    "## Data quality",
    "",
    "```",
    formatQualityReport(cfg.quality),
    "```",
    "",
    "## Ranking method",
    "",
    "The stability score rewards positive net PnL, PF > 1, better average/worst monthly PnL, more profitable months, sufficient trade count, and low drawdown. It penalizes losing months, monthly PnL standard deviation, overtrading, too few trades, and cases where fees consume too much gross profit.",
    "",
    "## Top 30 results",
    "",
    "| Rank | Score | Net | Net % | PF | DD % | Trades | Tr/day | Fees/Gross+ % | Avg mo % | Worst mo % | +mo/-mo | StdDev | Params |",
    "|-----:|------:|----:|------:|---:|-----:|-------:|-------:|--------------:|---------:|-----------:|--------:|-------:|--------|",
    ...top.map(
      (row) =>
        `| ${row.rank} | ${fmt(row.score, 1)} | ${fmt(row.metrics.netPnL)} | ${fmt(row.metrics.netPnLPct)} | ${fmt(row.metrics.profitFactor)} | ${fmt(row.metrics.maxDrawdownPct)} | ${row.metrics.tradesCount} | ${fmt(row.metrics.tradesPerDay, 3)} | ${fmt(row.feeToGrossProfitPct)} | ${fmt(row.averageMonthlyPnLPct)} | ${fmt(row.worstMonthlyPnLPct)} | ${row.profitableMonths}/${row.losingMonths} | ${fmt(row.monthlyPnLStdDev)} | ${paramsInline(row.params)} |`
    ),
    "",
    "## Monthly stability for top 30",
    "",
    ...top.flatMap((row) => [
      `### #${row.rank} score=${fmt(row.score, 1)} net=${fmt(row.metrics.netPnLPct)}% pf=${fmt(row.metrics.profitFactor)}`,
      "",
      `Params: \`${paramsInline(row.params)}\``,
      "",
      "| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |",
      "|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|",
      ...row.monthly.map(
        (m) =>
          `| ${m.monthKey} | ${fmt(m.netPnL)} | ${fmt(m.netPnLPct)} | ${fmt(m.grossPnL)} | ${fmt(m.fees)} | ${m.tradesCount} | ${fmt(m.winRate)} | ${fmt(m.profitFactor)} | ${fmt(m.maxDrawdownPct)} | ${m.isFullMonth ? "yes" : "no"} |`
      ),
      "",
    ]),
    "## Conclusion",
    "",
    recommendation(top),
    "",
    best
      ? `Best monthly shorthand: ${monthlyInline(best.monthly)}`
      : "Best monthly shorthand: n/a",
    "",
  ].join("\n");
};

const writeDataUnavailableArtifacts = (outputDir: string, error: unknown): void => {
  const endTimeMs = num(process.env.BACKTEST_END_TIME_MS, DEFAULT_END_TIME_MS);
  const rangeStart = endTimeMs - MONTHS * 30 * 86400000;
  const message = error instanceof Error ? error.message : String(error);
  const jsonPath = path.join(outputDir, "adaptive-range-param-search.json");
  const mdPath = path.join(outputDir, "adaptive-range-param-search.md");
  const conclusion =
    "No range-only candidates were evaluated because Binance Futures cache/data is unavailable in this environment.";

  writeJson(jsonPath, {
    source: BINANCE_FUTURES_SOURCE,
    generatedAt: new Date().toISOString(),
    symbol: SYMBOL,
    timeframe: TIMEFRAME,
    periodMonths: MONTHS,
    rangeStart,
    rangeEnd: endTimeMs,
    rangeStartIso: new Date(rangeStart).toISOString(),
    rangeEndIso: new Date(endTimeMs).toISOString(),
    dataReliable: false,
    skipped: true,
    skipReason: message,
    rangeOnly: RANGE_ONLY_PARAMS,
    search: {
      stage1Count: 0,
      stage2Count: 0,
      uniqueCount: 0,
      topCount: TOP_N,
      ranking: "stability_score",
    },
    top: [],
    results: [],
    conclusion,
  });

  fs.writeFileSync(
    mdPath,
    [
      "# Adaptive Regime RANGE Param Search",
      "",
      `Generated: ${new Date().toISOString()}`,
      `Source: **${BINANCE_FUTURES_SOURCE}**`,
      `Symbol/timeframe: **${SYMBOL} ${TIMEFRAME}**`,
      `Period: ${new Date(rangeStart).toISOString()} -> ${new Date(endTimeMs).toISOString()}`,
      "",
      "## Data unavailable",
      "",
      conclusion,
      "",
      "Reason:",
      "",
      "```",
      message,
      "```",
      "",
      "This runner is cache-only by default for optimization runs to avoid slow Binance REST retries from restricted cloud locations. Provide `data/cache/binance_futures/SOLUSDT_1m_6m.json` for the requested fixed end time, or run with `ADAPTIVE_RANGE_ALLOW_DOWNLOAD=1` in an environment where Binance Futures REST is available.",
      "",
      "## Top 30 results",
      "",
      "_No results: market data was unavailable._",
      "",
      "## Conclusion",
      "",
      "The RANGE mode cannot be recommended or rejected from this run because no valid SOLUSDT 15m candles were available.",
      "",
    ].join("\n")
  );

  console.error(`[DATA_UNAVAILABLE] ${message}`);
  console.error(`JSON: ${jsonPath}`);
  console.error(`MD: ${mdPath}`);
};

const main = async () => {
  const outputDir = path.resolve(process.env.BACKTEST_OUTPUT_DIR ?? "data/results");
  fs.mkdirSync(outputDir, { recursive: true });

  console.log("\n=== ADAPTIVE REGIME RANGE PARAM SEARCH ===\n");
  console.log(`symbol=${SYMBOL} timeframe=${TIMEFRAME} months=${MONTHS}`);
  console.log(`endTimeMs=${num(process.env.BACKTEST_END_TIME_MS, DEFAULT_END_TIME_MS)}`);
  console.log(`source=${BINANCE_FUTURES_SOURCE}\n`);

  let cfg: RunConfig;
  try {
    cfg = await loadMarketData();
  } catch (e) {
    writeDataUnavailableArtifacts(outputDir, e);
    return;
  }
  console.log(formatQualityReport(cfg.quality));
  console.log(`Resampled candles: ${cfg.candles.length}`);

  const stage1Params = buildStage1Params();
  const stage1Limit = num(process.env.ADAPTIVE_RANGE_STAGE1_LIMIT, stage1Params.length);
  const stage1Run = stage1Params.slice(0, Math.max(1, Math.min(stage1Params.length, stage1Limit)));
  console.log(`\n[stage1] signal grid param sets=${stage1Run.length}`);
  const stage1Results = evaluateMany(cfg, stage1Run, "stage1");

  const stage1TopN = num(process.env.ADAPTIVE_RANGE_STAGE1_TOP, 50);
  const stage1Top = rankResults(stage1Results).slice(0, Math.max(1, stage1TopN));
  const stage2Params = buildStage2Params(stage1Top);
  console.log(`\n[stage2] risk/filter grid param sets=${stage2Params.length} from top=${stage1Top.length}`);
  const stage2Results = evaluateMany(cfg, stage2Params, "stage2");

  const ranked = rankResults([...stage1Results, ...stage2Results]);
  const top = ranked.slice(0, TOP_N);
  const jsonPath = path.join(outputDir, "adaptive-range-param-search.json");
  const mdPath = path.join(outputDir, "adaptive-range-param-search.md");

  writeJson(jsonPath, {
    source: BINANCE_FUTURES_SOURCE,
    generatedAt: new Date().toISOString(),
    symbol: cfg.symbol,
    timeframe: cfg.timeframe,
    periodMonths: MONTHS,
    rangeStart: cfg.rangeStart,
    rangeEnd: cfg.rangeEnd,
    rangeStartIso: new Date(cfg.rangeStart).toISOString(),
    rangeEndIso: new Date(cfg.rangeEnd).toISOString(),
    initialBalance: cfg.startBalance,
    feeRate: cfg.feeRate,
    entryMode: cfg.entryMode,
    rangeOnly: RANGE_ONLY_PARAMS,
    quality: cfg.quality,
    search: {
      stage1Count: stage1Run.length,
      stage2Count: stage2Params.length,
      uniqueCount: ranked.length,
      topCount: TOP_N,
      ranking: "stability_score",
    },
    top,
    results: ranked,
    conclusion: recommendation(top),
  });
  fs.writeFileSync(mdPath, buildMarkdown(cfg, ranked, stage1Run.length, stage2Params.length));

  console.log("\n=== TOP 5 ===");
  for (const row of top.slice(0, 5)) {
    console.log(
      `#${row.rank} score=${fmt(row.score, 1)} net=${fmt(row.metrics.netPnLPct)}% pf=${fmt(row.metrics.profitFactor)} dd=${fmt(row.metrics.maxDrawdownPct)}% trades=${row.metrics.tradesCount} worstMo=${fmt(row.worstMonthlyPnLPct)}% params=${paramsInline(row.params)}`
    );
  }
  console.log(`\nJSON: ${jsonPath}`);
  console.log(`MD: ${mdPath}\n`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
