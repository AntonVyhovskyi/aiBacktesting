import type { NormalizedCandle } from "../backtest/types.js";
import type { DiscoveryIndicatorCache } from "./indicatorCache.js";

export type DiscoveryMode = "quick" | "fast" | "full";
export type EntryExecutionMode = "close" | "nextOpen";
export type PhaseName = "ENTRY" | "RISK" | "EXIT" | "EFFICIENCY";

export type StrategyDiagnostics = {
  signalCount: number;
  crossoverCount: number;
  entriesAllowed: number;
  tradesOpened: number;
  skippedByFilter: number;
  skippedByRisk: number;
  skippedByMargin: number;
  skippedInvalidStop: number;
  exitsByStopLoss: number;
  exitsByTrailing: number;
  exitsBySignal: number;
  exitsByEndOfData: number;
  exitsByTakeProfit: number;
  exitsByMaxHold: number;
};

export type DiscoveryTrade = {
  direction: "long" | "short";
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  qty: number;
  grossPnL: number;
  fees: number;
  netPnL: number;
  balanceAfter: number;
  exitReason: string;
  durationCandles: number;
  /** Market regime at entry (adaptive strategies). */
  entryRegime?: string;
  /** Initial stop price at entry. */
  entryStop?: number;
  /** Risk $ at entry (|entry-stop|*qty). */
  initialRiskUsdc?: number;
};

export type DiscoveryMetrics = {
  startBalance: number;
  endBalance: number;
  grossPnL: number;
  totalFees: number;
  netPnL: number;
  netPnLPct: number;
  tradesCount: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  totalVolume: number;
  totalNotional: number;
  feesToVolumeRatio: number;
  netPnlToVolumeRatio: number;
  averageTradeDurationCandles: number;
  tradesPerDay: number;
  averagePnLPerTrade: number;
  averageFeePerTrade: number;
  biggestWin: number;
  biggestLoss: number;
};

export type StrategyBacktestResult = {
  strategyName: string;
  params: Record<string, number | string>;
  trades: DiscoveryTrade[];
  metrics: DiscoveryMetrics;
  diagnostics: StrategyDiagnostics;
  screeningScore: number;
  balancedScore: number;
  volumeProfitScore: number;
  overtradingScore: number;
  highVolumeBreakevenScore: number;
  earlyStopped: boolean;
  earlyStopReason: string | null;
};

export type StrategyContext = {
  candles: NormalizedCandle[];
  cache: DiscoveryIndicatorCache;
  params: Record<string, number | string>;
  initialBalance: number;
  entryMode: EntryExecutionMode;
  feeRate: number;
  leverage: number;
  riskPct: number;
  backtestMsSpan: number;
  /** Optional BTC filter series (aligned 1m candles, same indices). */
  btcCache?: DiscoveryIndicatorCache;
};

export type ParamGrid = Record<string, readonly number[]>;

export type ModeGrids = { quick: ParamGrid; fast: ParamGrid; full: ParamGrid };

export type PhasedStrategyDefinition = {
  strategyName: string;
  defaults: Record<string, number | string>;
  screenGrids: ModeGrids;
  phase1EntryGrids: ModeGrids;
  indicatorReq: import("./indicatorCache.js").IndicatorRequirements;
  run: (ctx: StrategyContext) => StrategyBacktestResult;
};

export type DiscoveryRunConfig = {
  symbol: string;
  marketId: number;
  timeframe: string;
  backtestDays: number;
  maxCandles: number;
  initialBalance: number;
  entryMode: EntryExecutionMode;
  feeRate: number;
  leverage: number;
  riskPct: number;
  mode: DiscoveryMode;
  forceRefresh: boolean;
  cacheDir: string;
  outputDir: string;
  candles: NormalizedCandle[];
  backtestMsSpan: number;
};

export type RankedResult = {
  rank: number;
  strategyName: string;
  score: number;
  params: Record<string, number | string>;
  metrics: DiscoveryMetrics;
  diagnostics: StrategyDiagnostics;
  tradeHistoryPath: string | null;
  equityCurvePath: string | null;
  balancedScore: number;
  volumeProfitScore: number;
  overtradingScore: number;
  screeningScore: number;
  highVolumeBreakevenScore: number;
};

export type BestHighVolumeNearBreakeven = {
  usedFallback: boolean;
  passedStrictFilters: boolean;
} & import("./volumePriority.js").VolumeSummary;

export type HighVolumeNearBreakevenEntry = {
  rank: number;
  strategyName: string;
  highVolumeBreakevenScore: number;
  passedStrictFilters: boolean;
  params: Record<string, number | string>;
  totalVolume: number;
  netPnL: number;
  netPnLPct: number;
  totalFees: number;
  maxDrawdownPct: number;
  tradesCount: number;
  tradesPerDay: number;
  feesToVolumeRatio: number;
  profitFactor: number;
  tradeHistoryPath: string | null;
  equityCurvePath: string | null;
};
