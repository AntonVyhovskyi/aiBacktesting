import { computeMetrics } from "../metrics.js";
import { buildMonthlyProfitMetrics } from "../stableProfitEvaluation.js";
import type { DiscoveryMetrics, DiscoveryTrade, StrategyBacktestResult } from "../types.js";
import { ALL_REGIMES } from "./types.js";

const r = (v: number) => Math.round(v * 1e6) / 1e6;

export type RegimePerformance = {
  regime: string;
  trades: number;
  netPnL: number;
  winRate: number;
  profitFactor: number;
  averageR: number;
};

export type PeriodReport = {
  label: string;
  rangeStart: number;
  rangeEnd: number;
  metrics: DiscoveryMetrics;
  monthly: ReturnType<typeof buildMonthlyProfitMetrics>;
  averageMonthlyReturnPct: number;
  worstMonthReturnPct: number;
  bestMonthReturnPct: number;
  averageR: number;
  oneTradeDominancePct: number;
  byRegime: RegimePerformance[];
};

const averageR = (trades: DiscoveryTrade[]): number => {
  const rs = trades
    .map((t) => (t.initialRiskUsdc && t.initialRiskUsdc > 0 ? t.netPnL / t.initialRiskUsdc : 0))
    .filter((x) => Number.isFinite(x));
  return rs.length ? r(rs.reduce((a, b) => a + b, 0) / rs.length) : 0;
};

const oneTradeDominance = (trades: DiscoveryTrade[], netPnL: number): number => {
  if (netPnL <= 0 || !trades.length) return 0;
  const best = Math.max(...trades.map((t) => t.netPnL));
  return best > 0 ? r((best / netPnL) * 100) : 0;
};

export const buildRegimePerformance = (trades: DiscoveryTrade[]): RegimePerformance[] => {
  const out: RegimePerformance[] = [];
  for (const regime of ALL_REGIMES) {
    const slice = trades.filter((t) => t.entryRegime === regime);
    if (!slice.length) {
      out.push({ regime, trades: 0, netPnL: 0, winRate: 0, profitFactor: 0, averageR: 0 });
      continue;
    }
    const m = computeMetrics(slice, 100, 1);
    out.push({
      regime,
      trades: slice.length,
      netPnL: m.netPnL,
      winRate: m.winRate,
      profitFactor: m.profitFactor,
      averageR: averageR(slice),
    });
  }
  const other = trades.filter((t) => !t.entryRegime || !ALL_REGIMES.includes(t.entryRegime as never));
  if (other.length) {
    const m = computeMetrics(other, 100, 1);
    out.push({
      regime: "UNTAGGED",
      trades: other.length,
      netPnL: m.netPnL,
      winRate: m.winRate,
      profitFactor: m.profitFactor,
      averageR: averageR(other),
    });
  }
  return out;
};

export const buildPeriodReport = (
  label: string,
  trades: DiscoveryTrade[],
  rangeStart: number,
  rangeEnd: number,
  startBalance: number
): PeriodReport => {
  const span = rangeEnd - rangeStart;
  const metrics = computeMetrics(trades, startBalance, span);
  const monthly = buildMonthlyProfitMetrics(trades, rangeStart, rangeEnd, startBalance);
  const full = monthly.filter((m) => m.isFullMonth);
  const use = full.length ? full : monthly;
  const rets = use.map((m) => m.netPnLPct);
  return {
    label,
    rangeStart,
    rangeEnd,
    metrics,
    monthly,
    averageMonthlyReturnPct: rets.length ? r(rets.reduce((a, b) => a + b, 0) / rets.length) : 0,
    worstMonthReturnPct: rets.length ? r(Math.min(...rets)) : 0,
    bestMonthReturnPct: rets.length ? r(Math.max(...rets)) : 0,
    averageR: averageR(trades),
    oneTradeDominancePct: oneTradeDominance(trades, metrics.netPnL),
    byRegime: buildRegimePerformance(trades),
  };
};

export const sliceTradesByTime = (
  trades: DiscoveryTrade[],
  start: number,
  end: number
): DiscoveryTrade[] => trades.filter((t) => t.entryTime >= start && t.entryTime < end);

export const meetsTarget = (report: PeriodReport, minMonthlyPct: number, maxDdPct: number): boolean =>
  report.averageMonthlyReturnPct >= minMonthlyPct &&
  report.metrics.maxDrawdownPct <= maxDdPct &&
  report.metrics.profitFactor >= 1.1 &&
  report.metrics.tradesCount >= 20;

export const formatMetricsTable = (reports: PeriodReport[]): string => {
  const lines = [
    "| Period | Net PnL % | Avg month % | Worst month % | Max DD % | PF | Trades | Avg R | 1-trade dom % |",
    "|--------|----------:|------------:|--------------:|---------:|---:|-------:|------:|--------------:|",
  ];
  for (const p of reports) {
    const m = p.metrics;
    lines.push(
      `| ${p.label} | ${m.netPnLPct.toFixed(2)} | ${p.averageMonthlyReturnPct.toFixed(2)} | ${p.worstMonthReturnPct.toFixed(2)} | ${m.maxDrawdownPct.toFixed(2)} | ${m.profitFactor.toFixed(2)} | ${m.tradesCount} | ${p.averageR.toFixed(2)} | ${p.oneTradeDominancePct.toFixed(1)} |`
    );
  }
  return lines.join("\n");
};

export const formatRegimeTable = (report: PeriodReport): string => {
  const lines = [
    `### Regime performance — ${report.label}`,
    "",
    "| Regime | Trades | Net PnL | Win % | PF | Avg R |",
    "|--------|-------:|--------:|------:|---:|------:|",
  ];
  for (const row of report.byRegime) {
    if (row.trades === 0) continue;
    lines.push(
      `| ${row.regime} | ${row.trades} | ${row.netPnL.toFixed(2)} | ${row.winRate.toFixed(1)} | ${row.profitFactor.toFixed(2)} | ${row.averageR.toFixed(2)} |`
    );
  }
  return lines.join("\n");
};

export type FullAdaptiveReport = {
  symbol: string;
  timeframe: string;
  params: Record<string, number | string>;
  train: PeriodReport;
  validation: PeriodReport;
  outOfSample: PeriodReport;
  full: PeriodReport;
  targetMet: boolean;
  targetNotes: string[];
  result: StrategyBacktestResult;
};
