import { computeMetrics } from "./metrics.js";
import { tradeNotionalUsdc } from "./weeklyVolumeEvaluation.js";
import type { DiscoveryMetrics, DiscoveryTrade, StrategyBacktestResult } from "./types.js";

const r = (v: number) => Math.round(v * 1e6) / 1e6;

export const TARGET_MONTHLY_PNL_PCT = 10;
export const MAX_FULL_DD_PCT = 20;
export const MAX_MONTHLY_DD_PCT = 15;
export const MIN_PROFIT_FACTOR = 1.2;
export const MIN_TRADES_PER_MONTH = 30;
export const MAX_ONE_MONTH_DOMINANCE_PCT = 40;
export const REQUIRED_FULL_MONTHS = 6;

export type MonthlyProfitMetrics = {
  monthIndex: number;
  monthKey: string;
  startTime: string;
  endTime: string;
  startBalance: number;
  endBalance: number;
  netPnL: number;
  netPnLPct: number;
  grossPnL: number;
  fees: number;
  tradesCount: number;
  winRate: number;
  profitFactor: number;
  maxDrawdownPct: number;
  volume: number;
  averageTradePnL: number;
  isFullMonth: boolean;
};

export type TargetRequirementCheck = {
  id: string;
  label: string;
  required: string;
  actual: string;
  passed: boolean;
};

export type StableProfitEvaluation = {
  strategyName: string;
  params: Record<string, number | string>;
  metrics: DiscoveryMetrics;
  monthly: MonthlyProfitMetrics[];
  fullMonths: MonthlyProfitMetrics[];
  profitableMonths: number;
  losingMonths: number;
  monthsMeetingTargetPct: number;
  averageMonthlyPnLPct: number;
  worstMonthlyPnLPct: number;
  bestMonthlyPnLPct: number;
  monthlyPnLStdDev: number;
  monthlyConsistencyScore: number;
  stableMonthlyProfitScore: number;
  oneMonthDominancePct: number;
  passesHardTarget: boolean;
  hardTargetFailures: string[];
  dominanceRejected: boolean;
  targetCheck: TargetRequirementCheck[];
};

export const calendarMonthsInRange = (
  rangeStart: number,
  rangeEnd: number
): { monthKey: string; start: number; end: number }[] => {
  const out: { monthKey: string; start: number; end: number }[] = [];
  const d = new Date(rangeStart);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  if (d.getTime() < rangeStart) {
    // keep first partial month starting at rangeStart
  }
  while (d.getTime() < rangeEnd) {
    const monthStart = Math.max(d.getTime(), rangeStart);
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    const monthEnd = Math.min(next.getTime(), rangeEnd);
    if (monthEnd > monthStart) {
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      out.push({ monthKey: key, start: monthStart, end: monthEnd });
    }
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
};

export const buildMonthlyProfitMetrics = (
  trades: DiscoveryTrade[],
  rangeStart: number,
  rangeEnd: number,
  initialBalance: number
): MonthlyProfitMetrics[] => {
  const months = calendarMonthsInRange(rangeStart, rangeEnd);
  let balanceBefore = initialBalance;
  const chunks: MonthlyProfitMetrics[] = [];

  for (let i = 0; i < months.length; i++) {
    const { monthKey, start, end } = months[i]!;
    const span = end - start;
    const calStart = new Date(Date.UTC(new Date(start).getUTCFullYear(), new Date(start).getUTCMonth(), 1)).getTime();
    const calEnd = new Date(
      Date.UTC(new Date(start).getUTCFullYear(), new Date(start).getUTCMonth() + 1, 1)
    ).getTime();
    const isFullMonth = start <= calStart + 86400000 && end >= calEnd - 86400000 && span >= 28 * 86400000;

    const slice = trades.filter((t) => t.entryTime >= start && t.entryTime < end);
    const m = computeMetrics(slice, balanceBefore, span);

    let peak = balanceBefore;
    let maxDd = 0;
    let equity = balanceBefore;
    for (const t of slice) {
      equity = t.balanceAfter;
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
      if (dd > maxDd) maxDd = dd;
    }

    const monthStartBal = balanceBefore;
    const monthEndBal = slice.length ? slice[slice.length - 1]!.balanceAfter : balanceBefore;
    const net = monthEndBal - monthStartBal;
    const netPct = monthStartBal > 0 ? (net / monthStartBal) * 100 : 0;

    chunks.push({
      monthIndex: i + 1,
      monthKey,
      startTime: new Date(start).toISOString(),
      endTime: new Date(end - 1).toISOString(),
      startBalance: r(monthStartBal),
      endBalance: r(monthEndBal),
      netPnL: r(net),
      netPnLPct: r(netPct),
      grossPnL: m.grossPnL,
      fees: m.totalFees,
      tradesCount: slice.length,
      winRate: m.winRate,
      profitFactor: m.profitFactor,
      maxDrawdownPct: r(maxDd),
      volume: r(slice.reduce((s, t) => s + tradeNotionalUsdc(t), 0)),
      averageTradePnL: slice.length ? r(net / slice.length) : 0,
      isFullMonth,
    });

    balanceBefore = monthEndBal;
  }
  return chunks;
};

const stdDev = (values: number[]): number => {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((s, x) => s + (x - mean) ** 2, 0) / values.length;
  return Math.sqrt(v);
};

export const computeStableMonthlyProfitScore = (input: {
  averageMonthlyPnLPct: number;
  worstMonthlyPnLPct: number;
  profitableMonths: number;
  losingMonths: number;
  maxDrawdownPct: number;
  monthlyPnLStdDev: number;
  totalFees: number;
}): number =>
  r(
    input.averageMonthlyPnLPct * 5 +
      input.worstMonthlyPnLPct * 10 +
      input.profitableMonths * 500 -
      input.losingMonths * 1000 -
      input.maxDrawdownPct * 20 -
      input.monthlyPnLStdDev * 10 -
      input.totalFees * 0.5
  );

export const buildTargetCheck = (ev: StableProfitEvaluation): TargetRequirementCheck[] => {
  const fm = ev.fullMonths;
  const allMonthsPassTarget = fm.length >= REQUIRED_FULL_MONTHS && fm.every((m) => m.netPnLPct >= TARGET_MONTHLY_PNL_PCT);
  const allProfitable = fm.length >= REQUIRED_FULL_MONTHS && fm.every((m) => m.netPnL > 0);
  const allTrades = fm.every((m) => m.tradesCount >= MIN_TRADES_PER_MONTH);
  const monthlyDdOk = fm.every((m) => m.maxDrawdownPct <= MAX_MONTHLY_DD_PCT);
  const pfOk = ev.metrics.profitFactor >= MIN_PROFIT_FACTOR;
  const fullDdOk = ev.metrics.maxDrawdownPct <= MAX_FULL_DD_PCT;
  const dominanceOk = !ev.dominanceRejected;

  return [
    {
      id: "full_months_count",
      label: "Full calendar months",
      required: `>= ${REQUIRED_FULL_MONTHS}`,
      actual: String(fm.length),
      passed: fm.length >= REQUIRED_FULL_MONTHS,
    },
    {
      id: "all_months_profitable",
      label: "All months profitable",
      required: `${REQUIRED_FULL_MONTHS}/${REQUIRED_FULL_MONTHS}`,
      actual: `${ev.profitableMonths}/${fm.length}`,
      passed: allProfitable,
    },
    {
      id: "monthly_pnl_pct",
      label: "Each month net PnL %",
      required: `>= ${TARGET_MONTHLY_PNL_PCT}% every month`,
      actual: `worst=${ev.worstMonthlyPnLPct}% best=${ev.bestMonthlyPnLPct}%`,
      passed: allMonthsPassTarget,
    },
    {
      id: "full_period_dd",
      label: "Full-period max drawdown",
      required: `<= ${MAX_FULL_DD_PCT}%`,
      actual: `${ev.metrics.maxDrawdownPct}%`,
      passed: fullDdOk,
    },
    {
      id: "monthly_dd",
      label: "Per-month max drawdown",
      required: `<= ${MAX_MONTHLY_DD_PCT}% each month`,
      actual: fm.length ? `${Math.max(...fm.map((m) => m.maxDrawdownPct))}% max` : "n/a",
      passed: monthlyDdOk,
    },
    {
      id: "profit_factor",
      label: "Profit factor",
      required: `>= ${MIN_PROFIT_FACTOR}`,
      actual: String(ev.metrics.profitFactor),
      passed: pfOk,
    },
    {
      id: "trades_per_month",
      label: "Trades per month",
      required: `>= ${MIN_TRADES_PER_MONTH} each full month`,
      actual: fm.length ? `min=${Math.min(...fm.map((m) => m.tradesCount))}` : "0",
      passed: allTrades,
    },
    {
      id: "one_month_dominance",
      label: "One-month profit dominance",
      required: `<= ${MAX_ONE_MONTH_DOMINANCE_PCT}%`,
      actual: `${ev.oneMonthDominancePct}%`,
      passed: dominanceOk,
    },
  ];
};

export const evaluateStableProfit = (
  result: StrategyBacktestResult,
  rangeStart: number,
  rangeEnd: number,
  startBalance: number
): StableProfitEvaluation => {
  const monthly = buildMonthlyProfitMetrics(result.trades, rangeStart, rangeEnd, startBalance);
  const fullMonths = monthly.filter((m) => m.isFullMonth);
  const monthsForStats = fullMonths.length >= REQUIRED_FULL_MONTHS ? fullMonths : monthly;

  const pnls = monthsForStats.map((m) => m.netPnLPct);
  const profitableMonths = monthsForStats.filter((m) => m.netPnL > 0).length;
  const losingMonths = monthsForStats.filter((m) => m.netPnL < 0).length;
  const monthsMeetingTargetPct = monthsForStats.filter((m) => m.netPnLPct >= TARGET_MONTHLY_PNL_PCT).length;
  const averageMonthlyPnLPct = pnls.length ? r(pnls.reduce((a, b) => a + b, 0) / pnls.length) : 0;
  const worstMonthlyPnLPct = pnls.length ? r(Math.min(...pnls)) : 0;
  const bestMonthlyPnLPct = pnls.length ? r(Math.max(...pnls)) : 0;
  const monthlyPnLStdDev = r(stdDev(pnls));

  const totalNet = result.metrics.netPnL;
  const bestMonthNet = monthsForStats.length
    ? Math.max(...monthsForStats.map((m) => m.netPnL))
    : 0;
  const oneMonthDominancePct =
    totalNet > 0 && bestMonthNet > 0 ? r((bestMonthNet / totalNet) * 100) : 0;
  const dominanceRejected = totalNet > 0 && oneMonthDominancePct > MAX_ONE_MONTH_DOMINANCE_PCT;

  const stableMonthlyProfitScore = computeStableMonthlyProfitScore({
    averageMonthlyPnLPct,
    worstMonthlyPnLPct,
    profitableMonths,
    losingMonths,
    maxDrawdownPct: result.metrics.maxDrawdownPct,
    monthlyPnLStdDev,
    totalFees: result.metrics.totalFees,
  });

  const monthlyConsistencyScore = r(
    monthsMeetingTargetPct * 100 + profitableMonths * 50 - monthlyPnLStdDev * 5
  );

  const hardTargetFailures: string[] = [];
  if (fullMonths.length < REQUIRED_FULL_MONTHS) hardTargetFailures.push("insufficient_full_months");
  if (profitableMonths < REQUIRED_FULL_MONTHS) hardTargetFailures.push("not_all_months_profitable");
  if (monthsMeetingTargetPct < REQUIRED_FULL_MONTHS) hardTargetFailures.push("monthly_pnl_below_10pct");
  if (result.metrics.maxDrawdownPct > MAX_FULL_DD_PCT) hardTargetFailures.push("full_dd_too_high");
  if (fullMonths.some((m) => m.maxDrawdownPct > MAX_MONTHLY_DD_PCT))
    hardTargetFailures.push("monthly_dd_too_high");
  if (result.metrics.profitFactor < MIN_PROFIT_FACTOR) hardTargetFailures.push("profit_factor_low");
  if (fullMonths.some((m) => m.tradesCount < MIN_TRADES_PER_MONTH))
    hardTargetFailures.push("trades_per_month_low");
  if (dominanceRejected) hardTargetFailures.push("one_month_dominance");

  const ev: StableProfitEvaluation = {
    strategyName: result.strategyName,
    params: result.params,
    metrics: result.metrics,
    monthly,
    fullMonths,
    profitableMonths,
    losingMonths,
    monthsMeetingTargetPct,
    averageMonthlyPnLPct,
    worstMonthlyPnLPct,
    bestMonthlyPnLPct,
    monthlyPnLStdDev,
    monthlyConsistencyScore,
    stableMonthlyProfitScore,
    oneMonthDominancePct,
    passesHardTarget: false,
    hardTargetFailures,
    dominanceRejected,
    targetCheck: [],
  };
  ev.targetCheck = buildTargetCheck(ev);
  ev.passesHardTarget = ev.targetCheck.every((t) => t.passed);
  return ev;
};

export const stableProfitSummary = (ev: StableProfitEvaluation) => ({
  strategyName: ev.strategyName,
  params: ev.params,
  stableMonthlyProfitScore: ev.stableMonthlyProfitScore,
  monthlyConsistencyScore: ev.monthlyConsistencyScore,
  passesHardTarget: ev.passesHardTarget,
  hardTargetFailures: ev.hardTargetFailures,
  dominanceRejected: ev.dominanceRejected,
  oneMonthDominancePct: ev.oneMonthDominancePct,
  profitableMonths: ev.profitableMonths,
  losingMonths: ev.losingMonths,
  monthsMeetingTargetPct: ev.monthsMeetingTargetPct,
  averageMonthlyPnLPct: ev.averageMonthlyPnLPct,
  worstMonthlyPnLPct: ev.worstMonthlyPnLPct,
  bestMonthlyPnLPct: ev.bestMonthlyPnLPct,
  monthlyPnLStdDev: ev.monthlyPnLStdDev,
  targetCheck: ev.targetCheck,
  fullPeriod: {
    totalNetPnL: ev.metrics.netPnL,
    totalNetPnLPct: ev.metrics.netPnLPct,
    totalFees: ev.metrics.totalFees,
    grossPnL: ev.metrics.grossPnL,
    tradesCount: ev.metrics.tradesCount,
    winRate: ev.metrics.winRate,
    profitFactor: ev.metrics.profitFactor,
    maxDrawdownPct: ev.metrics.maxDrawdownPct,
    averageMonthlyPnLPct: ev.averageMonthlyPnLPct,
    worstMonthlyPnLPct: ev.worstMonthlyPnLPct,
    bestMonthlyPnLPct: ev.bestMonthlyPnLPct,
    monthlyConsistencyScore: ev.monthlyConsistencyScore,
  },
  monthly: ev.monthly,
});

export const formatTargetCheckLine = (ev: StableProfitEvaluation): string => {
  const failed = ev.targetCheck.filter((t) => !t.passed).map((t) => t.id);
  return failed.length ? `[CHECK] FAIL: ${failed.join(", ")}` : "[CHECK] all hard requirements passed";
};

export const shouldPromoteStableProfitFamily = (
  ev: StableProfitEvaluation
): { promote: boolean; reason: string } => {
  if (ev.metrics.tradesCount < 20) return { promote: false, reason: "trades<20" };
  if (ev.passesHardTarget) return { promote: true, reason: "passes_hard_target" };
  if (ev.profitableMonths >= 4 && ev.worstMonthlyPnLPct > -5)
    return { promote: true, reason: "mostly_profitable" };
  if (ev.averageMonthlyPnLPct >= 3 && ev.metrics.maxDrawdownPct <= 25)
    return { promote: true, reason: "decent_monthly_avg" };
  if (ev.metrics.profitFactor >= 1.1 && ev.metrics.netPnL > 0)
    return { promote: true, reason: "positive_pf" };
  if (ev.stableMonthlyProfitScore > -500) return { promote: true, reason: "score_candidate" };
  return { promote: false, reason: "weak" };
};
