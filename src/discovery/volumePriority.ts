import type { DiscoveryMetrics, StrategyBacktestResult } from "./types.js";

const r = (v: number) => Math.round(v * 1e4) / 1e4;

/** Primary optimization score: maximize volume while staying near breakeven. */
export const highVolumeBreakevenScore = (m: DiscoveryMetrics): number =>
  r(
    m.totalVolume * 0.01 +
      m.netPnL * 5 -
      m.totalFees * 1.5 -
      m.maxDrawdownPct * 10 -
      Math.abs(Math.min(0, m.netPnL)) * 10
  );

export const volumeScreeningScore = (m: DiscoveryMetrics): number =>
  r(
    m.totalVolume * 0.01 +
      m.netPnL * 3 -
      m.totalFees * 1.5 -
      m.maxDrawdownPct * 8 -
      Math.abs(Math.min(0, m.netPnL)) * 5 -
      (m.tradesCount < 20 ? (20 - m.tradesCount) * 3 : 0)
  );

/** Stage-2 phase selection: volume-first with penalties for low trade count / volume. */
export const phaseOptimizationScore = (result: StrategyBacktestResult): number => {
  const m = result.metrics;
  let score = highVolumeBreakevenScore(m);
  if (m.tradesCount < 50) score -= (50 - m.tradesCount) * 8;
  if (m.totalVolume < 1000) score -= (1000 - m.totalVolume) * 0.02;
  if (m.tradesCount < 10) score -= 500;
  return r(score);
};

export const isFeeDeathSpiral = (m: DiscoveryMetrics): boolean => {
  if (m.grossPnL <= 0) return m.totalFees > 0 && m.netPnL < -m.startBalance * 0.05;
  return m.totalFees > m.grossPnL * 2.5;
};

export const passesHighVolumeHardFilters = (m: DiscoveryMetrics): boolean => {
  if (m.tradesCount < 50) return false;
  if (m.totalVolume < 1000) return false;
  if (m.maxDrawdownPct > 35) return false;
  if (m.profitFactor < 0.85) return false;
  if (isFeeDeathSpiral(m)) return false;
  return true;
};

export const passesFallbackVolumeFilter = (m: DiscoveryMetrics): boolean => {
  const maxLoss = m.startBalance * 0.03;
  if (m.netPnL < -maxLoss) return false;
  if (m.maxDrawdownPct > 35) return false;
  if (isFeeDeathSpiral(m)) return false;
  if (m.tradesCount < 20) return false;
  if (m.totalVolume <= 0) return false;
  return true;
};

export type VolumeSummary = {
  strategyName: string;
  params: Record<string, number | string>;
  highVolumeBreakevenScore: number;
  totalVolume: number;
  netPnL: number;
  totalFees: number;
  maxDrawdownPct: number;
  tradesCount: number;
  tradesPerDay: number;
  feesToVolumeRatio: number;
  netPnLPct: number;
  profitFactor: number;
  passedStrictFilters: boolean;
};

export const toVolumeSummary = (result: StrategyBacktestResult): VolumeSummary => {
  const m = result.metrics;
  return {
    strategyName: result.strategyName,
    params: result.params,
    highVolumeBreakevenScore: highVolumeBreakevenScore(m),
    totalVolume: m.totalVolume,
    netPnL: m.netPnL,
    totalFees: m.totalFees,
    maxDrawdownPct: m.maxDrawdownPct,
    tradesCount: m.tradesCount,
    tradesPerDay: m.tradesPerDay,
    feesToVolumeRatio: m.feesToVolumeRatio,
    netPnLPct: m.netPnLPct,
    profitFactor: m.profitFactor,
    passedStrictFilters: passesHighVolumeHardFilters(m),
  };
};
