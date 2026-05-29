import type { PeriodReport } from "./regimeBacktestMetrics.js";
import type { WalkForwardWindowResult } from "./walkForward.js";

export type CandidateScore = {
  composite: number;
  avgOosMonthlyPct: number;
  worstOosMonthPct: number;
  avgOosDdPct: number;
  avgOosPf: number;
  oosWindowsPositive: number;
  totalOosTrades: number;
  maxOneTradeDom: number;
  maxOneMonthDom: number;
  regimeBalanceScore: number;
  rejected: boolean;
  rejectReasons: string[];
};

const monthDominance = (reports: PeriodReport[]): number => {
  const nets = reports.map((r) => r.metrics.netPnL).filter((n) => n > 0);
  const total = nets.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  return (Math.max(...nets) / total) * 100;
};

const regimeBalance = (reports: PeriodReport[]): number => {
  const regimes = new Map<string, number>();
  for (const r of reports) {
    for (const row of r.byRegime) {
      if (row.trades < 3) continue;
      regimes.set(row.regime, (regimes.get(row.regime) ?? 0) + row.netPnL);
    }
  }
  const pnls = [...regimes.values()];
  if (pnls.length < 2) return 0;
  const pos = pnls.filter((p) => p > 0).length;
  return pos / pnls.length;
};

export const scoreWalkForwardCandidate = (
  windows: WalkForwardWindowResult[],
  opts: { minOosTrades: number; minPositiveWindows: number }
): CandidateScore => {
  const oos = windows.map((w) => w.outOfSample);
  const rejectReasons: string[] = [];

  const monthly = oos.map((o) => o.averageMonthlyReturnPct);
  const avgOosMonthlyPct = monthly.length ? monthly.reduce((a, b) => a + b, 0) / monthly.length : 0;
  const worstOosMonthPct = monthly.length ? Math.min(...monthly) : 0;
  const avgOosDdPct = oos.length
    ? oos.reduce((s, o) => s + o.metrics.maxDrawdownPct, 0) / oos.length
    : 100;
  const pfVals = oos.map((o) => Math.min(o.metrics.profitFactor, 10));
  const avgOosPf = pfVals.length ? pfVals.reduce((s, v) => s + v, 0) / pfVals.length : 0;
  const oosWindowsPositive = oos.filter((o) => o.metrics.netPnL > 0).length;
  const totalOosTrades = oos.reduce((s, o) => s + o.metrics.tradesCount, 0);
  const maxOneTradeDom = Math.max(...oos.map((o) => o.oneTradeDominancePct), 0);
  const maxOneMonthDom = monthDominance(oos);
  const regimeBalanceScore = regimeBalance(oos);

  if (totalOosTrades < opts.minOosTrades) rejectReasons.push("low_oos_trades");
  if (oosWindowsPositive < opts.minPositiveWindows) rejectReasons.push("insufficient_positive_oos_windows");
  if (maxOneTradeDom > 45) rejectReasons.push("one_trade_dominance");
  if (maxOneMonthDom > 50) rejectReasons.push("one_month_dominance");
  if (avgOosDdPct > 8) rejectReasons.push("oos_dd_high");

  const composite =
    avgOosMonthlyPct * 4 +
    worstOosMonthPct * 6 +
    oosWindowsPositive * 80 -
    avgOosDdPct * 4 +
    Math.min(avgOosPf, 2.5) * 8 -
    maxOneTradeDom * 0.15 -
    maxOneMonthDom * 0.12 +
    regimeBalanceScore * 40 -
    rejectReasons.length * 120;

  return {
    composite,
    avgOosMonthlyPct,
    worstOosMonthPct,
    avgOosDdPct,
    avgOosPf,
    oosWindowsPositive,
    totalOosTrades,
    maxOneTradeDom,
    maxOneMonthDom,
    regimeBalanceScore,
    rejected: rejectReasons.length > 0,
    rejectReasons,
  };
};

export type CandidateBucket = "target" | "stable_low_risk" | "best_return" | "best_drawdown" | "rejected";

export const classifyCandidate = (
  score: CandidateScore,
  targetMonthly: number,
  targetDd: number
): CandidateBucket => {
  if (score.rejected) return "rejected";
  if (score.avgOosMonthlyPct >= targetMonthly && score.avgOosDdPct <= targetDd) return "target";
  if (score.avgOosDdPct <= targetDd * 1.2 && score.avgOosMonthlyPct >= 1) return "stable_low_risk";
  if (score.avgOosMonthlyPct >= 3 && score.avgOosDdPct <= 12) return "best_return";
  if (score.avgOosDdPct <= 4) return "best_drawdown";
  return "rejected";
};
