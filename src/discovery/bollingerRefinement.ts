import type { ParamGrid } from "./types.js";
import {
  buildTargetCheck,
  evaluateAutonomousVariant,
  type AutonomousEvaluation,
  type TargetCheck,
} from "./weeklyVolumeEvaluation.js";
import type { StrategyBacktestResult } from "./types.js";

export const REFINEMENT_MAX_DD_PCT = 10;
export const REFINEMENT_MIN_WEEKLY_NOTIONAL = 10_000;

export const BASE_BOLLINGER_PARAMS: Record<string, number | string> = {
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
  bbStdDev: 2,
  riskPct: 1.5,
  leverage: 5,
  rsiConfirmPeriod: 0,
  rsiOversold: 35,
  rsiOverbought: 65,
  stopLossPct: 0,
};

export type RefinementTargetCheck = TargetCheck & {
  refinementMaxDrawdownPct: { value: number; required: number; passed: boolean };
  refinementTargetAchieved: boolean;
};

export const buildRefinementTargetCheck = (ev: AutonomousEvaluation): RefinementTargetCheck => {
  const base = buildTargetCheck(ev);
  const ddPassed = ev.metrics.maxDrawdownPct <= REFINEMENT_MAX_DD_PCT;
  const failedReasons = base.failedReasons.filter(
    (r) => !r.startsWith("maxDrawdownPct>")
  );
  if (!ddPassed) failedReasons.push(`maxDrawdownPct=${ev.metrics.maxDrawdownPct}>${REFINEMENT_MAX_DD_PCT}`);
  if (ev.averageWeeklyNotionalVolume < REFINEMENT_MIN_WEEKLY_NOTIONAL)
    failedReasons.push(
      `averageWeeklyNotionalVolume=${ev.averageWeeklyNotionalVolume}<${REFINEMENT_MIN_WEEKLY_NOTIONAL}`
    );

  const refinementTargetAchieved =
    ev.metrics.netPnL >= 0 &&
    ev.averageTradesPerDay >= 2 &&
    ev.metrics.profitFactor >= 0.9 &&
    ev.averageWeeklyNotionalVolume >= REFINEMENT_MIN_WEEKLY_NOTIONAL &&
    ddPassed &&
    base.stableWeeks.passed &&
    base.feesVsGrossProfit.passed &&
    ev.metrics.tradesCount >= 20;

  return {
    ...base,
    maxDrawdownPct: {
      value: ev.metrics.maxDrawdownPct,
      required: REFINEMENT_MAX_DD_PCT,
      passed: ddPassed,
    },
    refinementMaxDrawdownPct: {
      value: ev.metrics.maxDrawdownPct,
      required: REFINEMENT_MAX_DD_PCT,
      passed: ddPassed,
    },
    failedReasons,
    finalTargetAchieved: refinementTargetAchieved,
    refinementTargetAchieved,
  };
};

export const closenessToPassScore = (check: RefinementTargetCheck, ev: AutonomousEvaluation): number => {
  if (check.refinementTargetAchieved) return 1e9;
  let s = 0;
  s += Math.min(ev.averageWeeklyNotionalVolume, 50_000) * 0.03;
  s += ev.metrics.netPnL * 80;
  s += (ev.averageTradesPerDay - 2) * 250;
  s += (ev.metrics.profitFactor - 0.9) * 400;
  s -= Math.max(0, REFINEMENT_MAX_DD_PCT - ev.metrics.maxDrawdownPct) * 2;
  s -= Math.max(0, ev.metrics.maxDrawdownPct - REFINEMENT_MAX_DD_PCT) * 40;
  s -= check.failedReasons.length * 120;
  return Math.round(s * 1e4) / 1e4;
};

export const paramDiffFromBase = (
  base: Record<string, number | string>,
  variant: Record<string, number | string>
): Record<string, { from: number | string; to: number | string }> => {
  const diff: Record<string, { from: number | string; to: number | string }> = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(variant)]);
  for (const k of keys) {
    if (base[k] !== variant[k]) diff[k] = { from: base[k] ?? null, to: variant[k] ?? null };
  }
  return diff;
};

export type RefinementVariantResult = {
  params: Record<string, number | string>;
  paramDiff: Record<string, { from: number | string; to: number | string }>;
  targetCheck: RefinementTargetCheck;
  closenessScore: number;
  evaluation: AutonomousEvaluation;
};

export const toRefinementRow = (
  base: Record<string, number | string>,
  ev: AutonomousEvaluation,
  params: Record<string, number | string>
): RefinementVariantResult => {
  const targetCheck = buildRefinementTargetCheck(ev);
  return {
    params,
    paramDiff: paramDiffFromBase(base, params),
    targetCheck,
    closenessScore: closenessToPassScore(targetCheck, ev),
    evaluation: ev,
  };
};

export const refinementSummaryRow = (row: RefinementVariantResult) => ({
  params: row.params,
  paramDiff: row.paramDiff,
  targetCheck: row.targetCheck,
  closenessScore: row.closenessScore,
  refinementTargetAchieved: row.targetCheck.refinementTargetAchieved,
  metrics: {
    averageWeeklyNotionalVolume: row.evaluation.averageWeeklyNotionalVolume,
    averageTradesPerDay: row.evaluation.averageTradesPerDay,
    netPnL: row.evaluation.metrics.netPnL,
    grossPnL: row.evaluation.metrics.grossPnL,
    totalFees: row.evaluation.metrics.totalFees,
    profitFactor: row.evaluation.metrics.profitFactor,
    maxDrawdownPct: row.evaluation.metrics.maxDrawdownPct,
    tradesCount: row.evaluation.metrics.tradesCount,
    winRate: row.evaluation.metrics.winRate,
    totalNotional: row.evaluation.metrics.totalNotional,
  },
  weekly: row.evaluation.weekly,
});

export const BOLLINGER_REFINEMENT_PHASES: { name: string; grid: ParamGrid }[] = [
  {
    name: "ENTRY_BB",
    grid: {
      bbPeriod: [18, 19, 20, 21, 22],
      bbStdDev: [1.8, 1.9, 2, 2.1, 2.2],
      rsiConfirmPeriod: [0, 14],
      rsiOversold: [30, 35, 40],
      rsiOverbought: [60, 65, 70],
    },
  },
  {
    name: "RISK_STOP",
    grid: {
      atrPeriod: [12, 14, 16],
      atrMult: [0.9, 1, 1.2, 1.4, 1.6],
      stopLossPct: [0, 0.5, 0.8, 1, 1.5],
      minMoveVsFeeMult: [0, 1, 2, 3],
    },
  },
  {
    name: "EXIT",
    grid: {
      takeProfitPct: [0, 0.25, 0.4, 0.6, 0.8, 1],
      trailStart: [0, 0.15, 0.25, 0.35, 0.45],
      trailGap: [0.25, 0.35, 0.4, 0.5, 0.6],
      breakEvenPct: [0, 0.2, 0.35],
      maxHoldCandles: [0, 60, 90, 120, 180],
    },
  },
  {
    name: "FREQUENCY",
    grid: {
      cooldownCandles: [0, 1, 2],
      maxTradesPerDay: [26, 28, 30, 32, 35, 40, 50],
      minVolumeMult: [0, 1, 1.2],
    },
  },
];

export const evaluateBollingerVariant = (
  result: StrategyBacktestResult,
  rangeStart: number,
  rangeEnd: number,
  startBalance: number,
  baseParams: Record<string, number | string>,
  params: Record<string, number | string>
): RefinementVariantResult => {
  const ev = evaluateAutonomousVariant(result, rangeStart, rangeEnd, startBalance);
  return toRefinementRow(baseParams, ev, params);
};
