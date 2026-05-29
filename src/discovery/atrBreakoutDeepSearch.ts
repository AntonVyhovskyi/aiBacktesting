import type { DiscoveryTrade, DiscoveryMetrics, ParamGrid, PhaseName } from "./types.js";
import { computeMetrics } from "./metrics.js";
import type { StrategyBacktestResult } from "./types.js";

export type WeekMetrics = {
  weekIndex: number;
  startTime: string;
  endTime: string;
  tradesCount: number;
  totalVolume: number;
  grossPnL: number;
  totalFees: number;
  netPnL: number;
  maxDrawdownPct: number;
};

export type AtrDeepVariantResult = {
  params: Record<string, number | string>;
  metrics: DiscoveryMetrics;
  weekly: WeekMetrics[];
  profitableWeeks: number;
  losingWeeks: number;
  atrDeepScore: number;
  rejected: boolean;
  rejectReasons: string[];
};

const r = (v: number) => Math.round(v * 1e6) / 1e6;

/** Map user-facing param names to simulator keys. */
export const normalizeAtrDeepParams = (
  params: Record<string, number | string>
): Record<string, number | string> => {
  const out = { ...params };
  if (out.trailingStartPct !== undefined) out.trailStart = out.trailingStartPct;
  if (out.trailingGapPct !== undefined) out.trailGap = out.trailingGapPct;
  if (out.breakEvenActivationPct !== undefined) out.breakEvenPct = out.breakEvenActivationPct;
  if (out.maxHoldingCandles !== undefined) out.maxHoldCandles = out.maxHoldingCandles;
  return out;
};

export const buildWeeklyChunks = (
  trades: DiscoveryTrade[],
  rangeStart: number,
  rangeEnd: number,
  startBalance: number
): WeekMetrics[] => {
  const weekMs = 7 * 86400000;
  const chunks: WeekMetrics[] = [];
  let wStart = rangeStart;
  let idx = 1;
  while (wStart < rangeEnd) {
    const wEnd = Math.min(wStart + weekMs, rangeEnd);
    const slice = trades.filter((t) => t.entryTime >= wStart && t.entryTime < wEnd);
    const m = computeMetrics(slice, startBalance, wEnd - wStart);
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
      totalVolume: m.totalVolume,
      grossPnL: m.grossPnL,
      totalFees: m.totalFees,
      netPnL: m.netPnL,
      maxDrawdownPct: maxDd,
    });
    wStart = wEnd;
    idx += 1;
  }
  return chunks;
};

export const computeAtrDeepScore = (
  m: DiscoveryMetrics,
  profitableWeeks: number,
  losingWeeks: number
): number => {
  if (m.tradesCount === 0) return -1e9;
  return r(
    m.totalVolume * 0.01 +
      m.netPnL * 5 -
      m.totalFees * 2 -
      m.maxDrawdownPct * 15 +
      profitableWeeks * 200 -
      losingWeeks * 300
  );
};

export const getRejectReasons = (m: DiscoveryMetrics, losingWeeks: number): string[] => {
  const reasons: string[] = [];
  if (m.tradesCount < 50) reasons.push("tradesCount<50");
  if (m.maxDrawdownPct > 35) reasons.push("maxDrawdownPct>35");
  if (m.profitFactor < 0.85) reasons.push("profitFactor<0.85");
  if (m.totalFees > m.grossPnL * 2) reasons.push("fees>2x_gross");
  if (losingWeeks > 2) reasons.push("losingWeeks>2");
  return reasons;
};

export const evaluateAtrDeepVariant = (
  result: StrategyBacktestResult,
  rangeStart: number,
  rangeEnd: number,
  startBalance: number
): AtrDeepVariantResult => {
  const weekly = buildWeeklyChunks(result.trades, rangeStart, rangeEnd, startBalance);
  const profitableWeeks = weekly.filter((w) => w.netPnL > 0).length;
  const losingWeeks = weekly.filter((w) => w.netPnL < 0).length;
  const rejectReasons = getRejectReasons(result.metrics, losingWeeks);
  const rejected = rejectReasons.length > 0;
  const atrDeepScore = computeAtrDeepScore(result.metrics, profitableWeeks, losingWeeks);
  return {
    params: result.params,
    metrics: result.metrics,
    weekly,
    profitableWeeks,
    losingWeeks,
    atrDeepScore,
    rejected,
    rejectReasons,
  };
};

export type PhaseProgressSnapshot = {
  phase: PhaseName;
  tested: number;
  total: number;
  progressPct: number;
  bestNetPnL: number;
  bestVolume: number;
  bestDrawdown: number;
  bestProfitableWeeks: number;
  bestParams: Record<string, number | string> | null;
  bestScore: number;
};

export const snapshotFromCandidates = (
  phase: PhaseName,
  tested: number,
  total: number,
  candidates: AtrDeepVariantResult[]
): PhaseProgressSnapshot => {
  if (!candidates.length) {
    return {
      phase,
      tested,
      total,
      progressPct: total > 0 ? r((tested / total) * 100) : 0,
      bestNetPnL: -Infinity,
      bestVolume: 0,
      bestDrawdown: Infinity,
      bestProfitableWeeks: 0,
      bestParams: null,
      bestScore: -Infinity,
    };
  }
  const pool = candidates;
  const bestByScore = pool[0] ?? null;
  const bestNet = pool.reduce((a, b) => (b.metrics.netPnL > a.metrics.netPnL ? b : a), pool[0]!);
  const bestVol = pool.reduce((a, b) => (b.metrics.totalVolume > a.metrics.totalVolume ? b : a), pool[0]!);
  const bestDd = pool.reduce(
    (a, b) => (b.metrics.maxDrawdownPct < a.metrics.maxDrawdownPct ? b : a),
    pool[0]!
  );
  const bestWeeks = pool.reduce(
    (a, b) => (b.profitableWeeks > a.profitableWeeks ? b : a),
    pool[0]!
  );
  return {
    phase,
    tested,
    total,
    progressPct: total > 0 ? r((tested / total) * 100) : 0,
    bestNetPnL: bestNet?.metrics.netPnL ?? -Infinity,
    bestVolume: bestVol?.metrics.totalVolume ?? 0,
    bestDrawdown: bestDd?.metrics.maxDrawdownPct ?? Infinity,
    bestProfitableWeeks: bestWeeks?.profitableWeeks ?? 0,
    bestParams: bestByScore?.params ?? null,
    bestScore: bestByScore?.atrDeepScore ?? -Infinity,
  };
};

export const variantSummary = (v: AtrDeepVariantResult) => ({
  params: v.params,
  atrDeepScore: v.atrDeepScore,
  rejected: v.rejected,
  rejectReasons: v.rejectReasons,
  profitableWeeks: v.profitableWeeks,
  losingWeeks: v.losingWeeks,
  metrics: {
    totalVolume: v.metrics.totalVolume,
    grossPnL: v.metrics.grossPnL,
    totalFees: v.metrics.totalFees,
    netPnL: v.metrics.netPnL,
    netPnLPct: v.metrics.netPnLPct,
    tradesCount: v.metrics.tradesCount,
    winRate: v.metrics.winRate,
    profitFactor: v.metrics.profitFactor,
    maxDrawdownPct: v.metrics.maxDrawdownPct,
    feesToVolumeRatio: v.metrics.feesToVolumeRatio,
    tradesPerDay: v.metrics.tradesPerDay,
  },
  weekly: v.weekly,
});

export const estimatePhaseVariants = (
  seeds: number,
  grids: { grid: ParamGrid }[],
  keepTop: number
): number => {
  let total = 0;
  let s = Math.max(seeds, 1);
  for (const g of grids) {
    const n = Object.values(g.grid).reduce((a, arr) => a * arr.length, 1);
    total += s * n;
    s = keepTop;
  }
  return total;
};
