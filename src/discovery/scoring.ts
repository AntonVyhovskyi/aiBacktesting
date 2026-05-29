import type { DiscoveryMetrics } from "./types.js";

const r = (v: number) => Math.round(v * 1e4) / 1e4;

export { highVolumeBreakevenScore, volumeScreeningScore, phaseOptimizationScore } from "./volumePriority.js";

/** @deprecated Use volumeScreeningScore — kept for compatibility */
export const screeningScore = (m: DiscoveryMetrics): number =>
  r(m.totalVolume * 0.01 + m.netPnL * 3 - m.totalFees * 1.5 - m.maxDrawdownPct * 8);

export const balancedScore = (m: DiscoveryMetrics): number =>
  r(m.netPnL * 3 + m.totalVolume * 0.00001 - m.totalFees * 2 - m.maxDrawdownPct * 5 - Math.abs(m.tradesCount - 100) * 2);

export const volumeProfitScore = (m: DiscoveryMetrics): number =>
  r(m.netPnL * 2 + m.totalVolume * 0.00005 - m.totalFees * 2 - m.maxDrawdownPct * 4);

export const overtradingScore = (m: DiscoveryMetrics): number =>
  r(m.netPnL - m.totalFees * 2 - m.tradesCount * 5 - m.tradesPerDay * 20 - m.maxDrawdownPct * 2);

export const breakevenScore = (m: DiscoveryMetrics): number => r(-Math.abs(m.netPnL));
