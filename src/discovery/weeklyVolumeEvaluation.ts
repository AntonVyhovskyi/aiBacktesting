import { computeMetrics } from "./metrics.js";
import type { DiscoveryMetrics, DiscoveryTrade, StrategyBacktestResult } from "./types.js";

export const TARGET_WEEKLY_NOTIONAL_USDC = 10_000;
export const TARGET_MIN_TRADES_PER_DAY = 2;
export const TARGET_MAX_DRAWDOWN_PCT = 35;
export const TARGET_MAX_WEEKLY_DRAWDOWN_PCT = 25;
export const TARGET_MIN_PROFIT_FACTOR = 0.9;
export const TARGET_MIN_NET_PNL = 0;
export const TARGET_FALLBACK_MIN_NET_PNL = -5;
export const NEAR_BREAKEVEN_WEEKLY_USDC = -1;
export const TARGET_MIN_STABLE_WEEKS = 3;
export const TARGET_MAX_FEES_TO_GROSS_RATIO = 2;

const r = (v: number) => Math.round(v * 1e6) / 1e6;

export type TargetCheckField = {
  value: number | string;
  required: number | string;
  passed: boolean;
};

export type TargetCheck = {
  averageWeeklyNotionalVolume: TargetCheckField;
  averageTradesPerDay: TargetCheckField;
  stableWeeks: TargetCheckField;
  netPnL: TargetCheckField;
  maxDrawdownPct: TargetCheckField;
  maxWeeklyDrawdownPct: TargetCheckField;
  profitFactor: TargetCheckField;
  feesVsGrossProfit: TargetCheckField;
  finalTargetAchieved: boolean;
  failedReasons: string[];
};

export type WeeklyNotionalMetrics = {
  weekIndex: number;
  startTime: string;
  endTime: string;
  tradesCount: number;
  notionalVolumeUsdc: number;
  grossPnL: number;
  totalFees: number;
  netPnL: number;
  maxDrawdownPct: number;
  wins: number;
  losses: number;
  isFullWeek: boolean;
};

export type AutonomousEvaluation = {
  strategyName: string;
  params: Record<string, number | string>;
  metrics: DiscoveryMetrics;
  weekly: WeeklyNotionalMetrics[];
  fullWeeks: WeeklyNotionalMetrics[];
  averageWeeklyNotionalVolume: number;
  averageTradesPerDay: number;
  profitableWeeks: number;
  losingWeeks: number;
  nearBreakevenOrProfitableWeeks: number;
  maxWeeklyDrawdownPct: number;
  weeklyVolumeTargetScore: number;
  rejected: boolean;
  rejectReasons: string[];
  passesHardTarget: boolean;
  hardTargetFailures: string[];
  passesFallbackTarget: boolean;
  dominancePenalty: number;
  feeDeathPenalty: number;
  overtradingPenalty: number;
  unstableWeeklyPenalty: number;
};

export const tradeNotionalUsdc = (t: DiscoveryTrade): number =>
  t.qty * t.entryPrice + t.qty * t.exitPrice;

export const computeNotionalVolume = (trades: DiscoveryTrade[]): number =>
  r(trades.reduce((s, t) => s + tradeNotionalUsdc(t), 0));

export const buildWeeklyNotionalMetrics = (
  trades: DiscoveryTrade[],
  rangeStart: number,
  rangeEnd: number,
  startBalance: number
): WeeklyNotionalMetrics[] => {
  const weekMs = 7 * 86400000;
  const chunks: WeeklyNotionalMetrics[] = [];
  let wStart = rangeStart;
  let idx = 1;
  while (wStart < rangeEnd) {
    const wEnd = Math.min(wStart + weekMs, rangeEnd);
    const span = wEnd - wStart;
    const isFullWeek = span >= weekMs * 0.85;
    const slice = trades.filter((t) => t.entryTime >= wStart && t.entryTime < wEnd);
    const m = computeMetrics(slice, startBalance, span);
    let peak = startBalance;
    let maxDd = 0;
    let equity = startBalance;
    for (const t of slice) {
      equity = t.balanceAfter;
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
      if (dd > maxDd) maxDd = dd;
    }
    chunks.push({
      weekIndex: idx,
      startTime: new Date(wStart).toISOString(),
      endTime: new Date(wEnd - 1).toISOString(),
      tradesCount: slice.length,
      notionalVolumeUsdc: computeNotionalVolume(slice),
      grossPnL: m.grossPnL,
      totalFees: m.totalFees,
      netPnL: m.netPnL,
      maxDrawdownPct: r(maxDd),
      wins: m.wins,
      losses: m.losses,
      isFullWeek,
    });
    wStart = wEnd;
    idx += 1;
  }
  return chunks;
};

const weekNearBreakeven = (w: WeeklyNotionalMetrics): boolean =>
  w.netPnL >= NEAR_BREAKEVEN_WEEKLY_USDC;

export const computeWeeklyVolumeTargetScore = (input: {
  metrics: DiscoveryMetrics;
  averageWeeklyNotionalVolume: number;
  profitableWeeks: number;
  losingWeeks: number;
  dominancePenalty: number;
  feeDeathPenalty: number;
  overtradingPenalty: number;
  unstableWeeklyPenalty: number;
}): number => {
  const m = input.metrics;
  if (m.tradesCount === 0) return -1e9;
  return r(
    input.averageWeeklyNotionalVolume * 0.02 +
      m.netPnL * 10 -
      m.totalFees * 3 -
      m.maxDrawdownPct * 10 +
      input.profitableWeeks * 200 -
      input.losingWeeks * 250 -
      input.dominancePenalty -
      input.feeDeathPenalty -
      input.overtradingPenalty -
      input.unstableWeeklyPenalty
  );
};

const computePenalties = (
  metrics: DiscoveryMetrics,
  _weekly: WeeklyNotionalMetrics[],
  fullWeeks: WeeklyNotionalMetrics[]
): {
  dominancePenalty: number;
  feeDeathPenalty: number;
  overtradingPenalty: number;
  unstableWeeklyPenalty: number;
} => {
  let dominancePenalty = 0;
  if (metrics.netPnL > 0 && fullWeeks.length > 0) {
    const best = fullWeeks.reduce((a, b) => (b.netPnL > a.netPnL ? b : a), fullWeeks[0]!);
    if (best.netPnL / metrics.netPnL > 0.55) dominancePenalty = 200;
  }

  let feeDeathPenalty = 0;
  if (metrics.grossPnL > 0 && metrics.totalFees > metrics.grossPnL * 1.25) feeDeathPenalty = 300;
  else if (metrics.grossPnL <= 0 && metrics.totalFees > metrics.startBalance * 0.15)
    feeDeathPenalty = 250;

  let overtradingPenalty = 0;
  if (metrics.tradesPerDay > 50) overtradingPenalty = 150;
  else if (metrics.tradesPerDay > 35) overtradingPenalty = 80;

  let unstableWeeklyPenalty = 0;
  if (fullWeeks.length >= 2) {
    const nets = fullWeeks.map((w) => w.netPnL);
    const mean = nets.reduce((a, b) => a + b, 0) / nets.length;
    const variance = nets.reduce((a, b) => a + (b - mean) ** 2, 0) / nets.length;
    const std = Math.sqrt(variance);
    if (std > Math.max(5, Math.abs(mean) * 3)) unstableWeeklyPenalty = 120;
  }

  return { dominancePenalty, feeDeathPenalty, overtradingPenalty, unstableWeeklyPenalty };
};

export const buildTargetCheck = (
  ev: Omit<AutonomousEvaluation, "passesHardTarget" | "hardTargetFailures" | "passesFallbackTarget">
): TargetCheck => {
  const m = ev.metrics;
  const fullWeekCount = ev.fullWeeks.length;
  const feesRatio =
    m.grossPnL > 0 ? r(m.totalFees / m.grossPnL) : m.totalFees > 0 ? Infinity : 0;
  const feesPassed = !(m.totalFees > m.grossPnL * TARGET_MAX_FEES_TO_GROSS_RATIO && m.grossPnL > 0);

  const checks: TargetCheck = {
    averageWeeklyNotionalVolume: {
      value: ev.averageWeeklyNotionalVolume,
      required: TARGET_WEEKLY_NOTIONAL_USDC,
      passed: ev.averageWeeklyNotionalVolume >= TARGET_WEEKLY_NOTIONAL_USDC,
    },
    averageTradesPerDay: {
      value: ev.averageTradesPerDay,
      required: TARGET_MIN_TRADES_PER_DAY,
      passed: ev.averageTradesPerDay >= TARGET_MIN_TRADES_PER_DAY,
    },
    stableWeeks: {
      value: `${ev.nearBreakevenOrProfitableWeeks}/${fullWeekCount}`,
      required: `>=${TARGET_MIN_STABLE_WEEKS}_of_${fullWeekCount || 4}`,
      passed: ev.nearBreakevenOrProfitableWeeks >= TARGET_MIN_STABLE_WEEKS,
    },
    netPnL: {
      value: m.netPnL,
      required: TARGET_MIN_NET_PNL,
      passed: m.netPnL >= TARGET_MIN_NET_PNL,
    },
    maxDrawdownPct: {
      value: m.maxDrawdownPct,
      required: TARGET_MAX_DRAWDOWN_PCT,
      passed: m.maxDrawdownPct <= TARGET_MAX_DRAWDOWN_PCT,
    },
    maxWeeklyDrawdownPct: {
      value: ev.maxWeeklyDrawdownPct,
      required: TARGET_MAX_WEEKLY_DRAWDOWN_PCT,
      passed: ev.maxWeeklyDrawdownPct <= TARGET_MAX_WEEKLY_DRAWDOWN_PCT,
    },
    profitFactor: {
      value: m.profitFactor,
      required: TARGET_MIN_PROFIT_FACTOR,
      passed: m.profitFactor >= TARGET_MIN_PROFIT_FACTOR,
    },
    feesVsGrossProfit: {
      value:
        m.grossPnL > 0
          ? `${feesRatio} (fees=${m.totalFees} gross=${m.grossPnL})`
          : `fees=${m.totalFees} gross=${m.grossPnL}`,
      required: `fees<=${TARGET_MAX_FEES_TO_GROSS_RATIO}x_gross`,
      passed: feesPassed,
    },
    finalTargetAchieved: false,
    failedReasons: [],
  };

  const failedReasons: string[] = [];
  if (!checks.averageWeeklyNotionalVolume.passed)
    failedReasons.push(
      `averageWeeklyNotionalVolume=${ev.averageWeeklyNotionalVolume} < ${TARGET_WEEKLY_NOTIONAL_USDC}`
    );
  if (!checks.averageTradesPerDay.passed)
    failedReasons.push(
      `averageTradesPerDay=${ev.averageTradesPerDay} < ${TARGET_MIN_TRADES_PER_DAY}`
    );
  if (!checks.stableWeeks.passed)
    failedReasons.push(
      `stableWeeks=${ev.nearBreakevenOrProfitableWeeks}/${fullWeekCount} < ${TARGET_MIN_STABLE_WEEKS}`
    );
  if (!checks.netPnL.passed)
    failedReasons.push(`netPnL=${m.netPnL} < ${TARGET_MIN_NET_PNL}`);
  if (!checks.maxDrawdownPct.passed)
    failedReasons.push(`maxDrawdownPct=${m.maxDrawdownPct} > ${TARGET_MAX_DRAWDOWN_PCT}`);
  if (!checks.maxWeeklyDrawdownPct.passed)
    failedReasons.push(
      `maxWeeklyDrawdownPct=${ev.maxWeeklyDrawdownPct} > ${TARGET_MAX_WEEKLY_DRAWDOWN_PCT}`
    );
  if (!checks.profitFactor.passed)
    failedReasons.push(`profitFactor=${m.profitFactor} < ${TARGET_MIN_PROFIT_FACTOR}`);
  if (!checks.feesVsGrossProfit.passed) {
    if (m.grossPnL > 0) {
      failedReasons.push(
        `feesVsGrossProfit=${feesRatio} > ${TARGET_MAX_FEES_TO_GROSS_RATIO} (fees=${m.totalFees} gross=${m.grossPnL})`
      );
    } else {
      failedReasons.push(`feesVsGrossProfit=fees ${m.totalFees} with gross ${m.grossPnL} <= 0`);
    }
  }
  if (m.tradesCount < 20) failedReasons.push(`tradesCount=${m.tradesCount} < 20`);

  checks.failedReasons = failedReasons;
  checks.finalTargetAchieved = failedReasons.length === 0;
  return checks;
};

/** Console one-liner for failed hard-target checks. */
export const formatTargetCheckLine = (check: TargetCheck): string => {
  if (check.finalTargetAchieved) return "[CHECK] all hard targets passed";
  return `[CHECK] failed: ${check.failedReasons.join(", ")}`;
};

export const getHardTargetFailures = (ev: Omit<AutonomousEvaluation, "passesHardTarget" | "hardTargetFailures" | "passesFallbackTarget">): string[] => {
  const reasons: string[] = [];
  if (ev.averageWeeklyNotionalVolume < TARGET_WEEKLY_NOTIONAL_USDC)
    reasons.push(`avgWeeklyNotional<${TARGET_WEEKLY_NOTIONAL_USDC}`);
  if (ev.averageTradesPerDay < TARGET_MIN_TRADES_PER_DAY)
    reasons.push(`avgTradesPerDay<${TARGET_MIN_TRADES_PER_DAY}`);
  if (ev.nearBreakevenOrProfitableWeeks < 3) reasons.push("stableWeeks<3_of_4");
  if (ev.metrics.netPnL < TARGET_MIN_NET_PNL) reasons.push("netPnL<0");
  if (ev.metrics.maxDrawdownPct > TARGET_MAX_DRAWDOWN_PCT)
    reasons.push(`maxDrawdownPct>${TARGET_MAX_DRAWDOWN_PCT}`);
  if (ev.metrics.profitFactor < TARGET_MIN_PROFIT_FACTOR)
    reasons.push(`profitFactor<${TARGET_MIN_PROFIT_FACTOR}`);
  if (ev.maxWeeklyDrawdownPct > TARGET_MAX_WEEKLY_DRAWDOWN_PCT)
    reasons.push(`weeklyDrawdown>${TARGET_MAX_WEEKLY_DRAWDOWN_PCT}%`);
  if (ev.metrics.totalFees > ev.metrics.grossPnL * 2 && ev.metrics.grossPnL > 0)
    reasons.push("fees>2x_gross");
  if (ev.metrics.tradesCount < 20) reasons.push("tradesCount<20");
  return reasons;
};

export const getRejectReasons = (
  metrics: DiscoveryMetrics,
  losingWeeks: number,
  maxWeeklyDrawdownPct: number
): string[] => {
  const reasons: string[] = [];
  if (metrics.tradesCount === 0) reasons.push("no_trades");
  if (metrics.maxDrawdownPct > 50) reasons.push("catastrophic_drawdown");
  if (metrics.totalFees > metrics.grossPnL * 3 && metrics.grossPnL > 0) reasons.push("severe_fee_death");
  if (metrics.grossPnL <= 0 && metrics.totalFees > metrics.startBalance * 0.25)
    reasons.push("fee_death_negative_gross");
  if (losingWeeks > 3) reasons.push("too_many_losing_weeks");
  if (maxWeeklyDrawdownPct > 40) reasons.push("weekly_dd>40");
  return reasons;
};

export const evaluateAutonomousVariant = (
  result: StrategyBacktestResult,
  rangeStart: number,
  rangeEnd: number,
  startBalance: number
): AutonomousEvaluation => {
  const weekly = buildWeeklyNotionalMetrics(result.trades, rangeStart, rangeEnd, startBalance);
  const fullWeeks = weekly.filter((w) => w.isFullWeek);
  const weeksForAvg = fullWeeks.length > 0 ? fullWeeks : weekly;
  const averageWeeklyNotionalVolume =
    weeksForAvg.length > 0
      ? r(weeksForAvg.reduce((s, w) => s + w.notionalVolumeUsdc, 0) / weeksForAvg.length)
      : 0;
  const spanDays = Math.max((rangeEnd - rangeStart) / 86400000, 1);
  const averageTradesPerDay = r(result.metrics.tradesCount / spanDays);
  const profitableWeeks = fullWeeks.filter((w) => w.netPnL > 0).length;
  const losingWeeks = fullWeeks.filter((w) => w.netPnL < NEAR_BREAKEVEN_WEEKLY_USDC).length;
  const nearBreakevenOrProfitableWeeks = fullWeeks.filter(weekNearBreakeven).length;
  const maxWeeklyDrawdownPct = fullWeeks.length
    ? Math.max(...fullWeeks.map((w) => w.maxDrawdownPct))
    : 0;

  const penalties = computePenalties(result.metrics, weekly, fullWeeks);
  const weeklyVolumeTargetScore = computeWeeklyVolumeTargetScore({
    metrics: result.metrics,
    averageWeeklyNotionalVolume,
    profitableWeeks,
    losingWeeks,
    ...penalties,
  });

  const rejectReasons = getRejectReasons(result.metrics, losingWeeks, maxWeeklyDrawdownPct);
  const base = {
    strategyName: result.strategyName,
    params: result.params,
    metrics: result.metrics,
    weekly,
    fullWeeks,
    averageWeeklyNotionalVolume,
    averageTradesPerDay,
    profitableWeeks,
    losingWeeks,
    nearBreakevenOrProfitableWeeks,
    maxWeeklyDrawdownPct: r(maxWeeklyDrawdownPct),
    weeklyVolumeTargetScore,
    rejected: rejectReasons.length > 0,
    rejectReasons,
    dominancePenalty: penalties.dominancePenalty,
    feeDeathPenalty: penalties.feeDeathPenalty,
    overtradingPenalty: penalties.overtradingPenalty,
    unstableWeeklyPenalty: penalties.unstableWeeklyPenalty,
  };
  const hardTargetFailures = getHardTargetFailures(base);
  const passesHardTarget = hardTargetFailures.length === 0;
  const fallbackFailures = hardTargetFailures.filter(
    (x) => x !== "netPnL<0" || result.metrics.netPnL < TARGET_FALLBACK_MIN_NET_PNL
  );
  const passesFallbackTarget =
    fallbackFailures.length === 0 && result.metrics.netPnL >= TARGET_FALLBACK_MIN_NET_PNL;

  return { ...base, passesHardTarget, hardTargetFailures, passesFallbackTarget };
};

export const evaluationSummary = (ev: AutonomousEvaluation) => ({
  strategyName: ev.strategyName,
  params: ev.params,
  weeklyVolumeTargetScore: ev.weeklyVolumeTargetScore,
  passesHardTarget: ev.passesHardTarget,
  passesFallbackTarget: ev.passesFallbackTarget,
  hardTargetFailures: ev.hardTargetFailures,
  targetCheck: buildTargetCheck(ev),
  rejected: ev.rejected,
  rejectReasons: ev.rejectReasons,
  averageWeeklyNotionalVolume: ev.averageWeeklyNotionalVolume,
  averageTradesPerDay: ev.averageTradesPerDay,
  profitableWeeks: ev.profitableWeeks,
  losingWeeks: ev.losingWeeks,
  nearBreakevenOrProfitableWeeks: ev.nearBreakevenOrProfitableWeeks,
  maxWeeklyDrawdownPct: ev.maxWeeklyDrawdownPct,
  metrics: {
    totalNotional: ev.metrics.totalNotional,
    grossPnL: ev.metrics.grossPnL,
    totalFees: ev.metrics.totalFees,
    netPnL: ev.metrics.netPnL,
    netPnLPct: ev.metrics.netPnLPct,
    tradesCount: ev.metrics.tradesCount,
    tradesPerDay: ev.metrics.tradesPerDay,
    winRate: ev.metrics.winRate,
    profitFactor: ev.metrics.profitFactor,
    maxDrawdownPct: ev.metrics.maxDrawdownPct,
  },
  weekly: ev.weekly,
});
