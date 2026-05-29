import { buildWeeklyNotionalMetrics, type WeeklyNotionalMetrics } from "./weeklyVolumeEvaluation.js";
import type { DiscoveryMetrics, StrategyBacktestResult } from "./types.js";

export const MAX_DD_PCT = 10;
export const MIN_END_BALANCE = 90;
export const MONTHLY_NORMALIZE_DAYS = 30;

const r = (v: number) => Math.round(v * 1e6) / 1e6;

export type MaxVolume10DDEvaluation = {
  strategyName: string;
  params: Record<string, number | string>;
  metrics: DiscoveryMetrics;
  weekly: WeeklyNotionalMetrics[];
  totalNotionalVolume: number;
  totalMonthlyNotionalVolume: number;
  averageWeeklyNotionalVolume: number;
  averageDailyNotionalVolume: number;
  maxVolumeWithRiskScore: number;
  passesRiskConstraint: boolean;
  hardRejected: boolean;
  rejectReasons: string[];
};

export const computeMaxVolumeWithRiskScore = (
  totalNotional: number,
  maxDrawdownPct: number,
  endBalance: number
): number =>
  r(totalNotional - maxDrawdownPct * 10_000 - Math.max(0, MIN_END_BALANCE - endBalance) * 10_000);

export const getRiskRejectReasons = (m: DiscoveryMetrics): string[] => {
  const reasons: string[] = [];
  if (m.maxDrawdownPct > MAX_DD_PCT) reasons.push(`maxDrawdownPct=${m.maxDrawdownPct}>${MAX_DD_PCT}`);
  if (m.endBalance < MIN_END_BALANCE) reasons.push(`endBalance=${m.endBalance}<${MIN_END_BALANCE}`);
  if (m.tradesCount === 0) reasons.push("no_trades");
  return reasons;
};

export const evaluateMaxVolume10DD = (
  result: StrategyBacktestResult,
  rangeStart: number,
  rangeEnd: number,
  startBalance: number
): MaxVolume10DDEvaluation => {
  const spanDays = Math.max((rangeEnd - rangeStart) / 86400000, 1);
  const weekly = buildWeeklyNotionalMetrics(result.trades, rangeStart, rangeEnd, startBalance);
  const fullWeeks = weekly.filter((w) => w.isFullWeek);
  const weeksForAvg = fullWeeks.length > 0 ? fullWeeks : weekly;

  const totalNotionalVolume = result.metrics.totalNotional;
  const totalMonthlyNotionalVolume = r(totalNotionalVolume * (MONTHLY_NORMALIZE_DAYS / spanDays));
  const averageWeeklyNotionalVolume =
    weeksForAvg.length > 0
      ? r(weeksForAvg.reduce((s, w) => s + w.notionalVolumeUsdc, 0) / weeksForAvg.length)
      : 0;
  const averageDailyNotionalVolume = r(totalNotionalVolume / spanDays);

  const rejectReasons = getRiskRejectReasons(result.metrics);
  const passesRiskConstraint = rejectReasons.length === 0;
  const maxVolumeWithRiskScore = computeMaxVolumeWithRiskScore(
    totalNotionalVolume,
    result.metrics.maxDrawdownPct,
    result.metrics.endBalance
  );

  return {
    strategyName: result.strategyName,
    params: result.params,
    metrics: result.metrics,
    weekly,
    totalNotionalVolume,
    totalMonthlyNotionalVolume,
    averageWeeklyNotionalVolume,
    averageDailyNotionalVolume,
    maxVolumeWithRiskScore,
    passesRiskConstraint,
    hardRejected: !passesRiskConstraint,
    rejectReasons,
  };
};

export const shouldPromoteMaxVolumeFamily = (ev: MaxVolume10DDEvaluation): { promote: boolean; reason: string } => {
  if (ev.passesRiskConstraint) return { promote: true, reason: "passes_10dd_risk" };
  if (ev.metrics.maxDrawdownPct > 25) return { promote: false, reason: "drawdown>25" };
  if (ev.metrics.endBalance < 70) return { promote: false, reason: "endBalance<70" };
  if (ev.totalMonthlyNotionalVolume >= 20_000 && ev.metrics.maxDrawdownPct <= 15)
    return { promote: true, reason: "high_volume_near_risk_cap" };
  if (ev.totalMonthlyNotionalVolume >= 8_000 && ev.metrics.maxDrawdownPct <= 12)
    return { promote: true, reason: "volume_candidate" };
  if (ev.metrics.tradesCount < 5) return { promote: false, reason: "trades<5" };
  return { promote: false, reason: "low_volume_or_risk" };
};

export const maxVolumeSummary = (ev: MaxVolume10DDEvaluation) => ({
  strategyName: ev.strategyName,
  params: ev.params,
  maxVolumeWithRiskScore: ev.maxVolumeWithRiskScore,
  passesRiskConstraint: ev.passesRiskConstraint,
  hardRejected: ev.hardRejected,
  rejectReasons: ev.rejectReasons,
  metrics: {
    totalMonthlyNotionalVolume: ev.totalMonthlyNotionalVolume,
    averageWeeklyNotionalVolume: ev.averageWeeklyNotionalVolume,
    averageDailyNotionalVolume: ev.averageDailyNotionalVolume,
    totalNotionalVolume: ev.totalNotionalVolume,
    endBalance: ev.metrics.endBalance,
    netPnL: ev.metrics.netPnL,
    netPnLPct: ev.metrics.netPnLPct,
    maxDrawdownPct: ev.metrics.maxDrawdownPct,
    totalFees: ev.metrics.totalFees,
    grossPnL: ev.metrics.grossPnL,
    tradesCount: ev.metrics.tradesCount,
    tradesPerDay: ev.metrics.tradesPerDay,
    winRate: ev.metrics.winRate,
    profitFactor: ev.metrics.profitFactor,
    feesToVolumeRatio: ev.metrics.feesToVolumeRatio,
  },
  weekly: ev.weekly,
});
