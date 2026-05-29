import type { DiscoveryMetrics } from "./types.js";

export type EarlyStopResult = { stop: boolean; reason: string | null };

import { isFeeDeathSpiral } from "./volumePriority.js";

export const checkEarlyStop = (m: DiscoveryMetrics): EarlyStopResult => {
  if (m.tradesCount === 0) return { stop: true, reason: "no_trades" };
  if (m.maxDrawdownPct > 50) return { stop: true, reason: "maxDrawdownPct>50" };
  if (isFeeDeathSpiral(m)) return { stop: true, reason: "fee_death_spiral" };
  if (m.tradesCount > 300 && m.averagePnLPerTrade < -3)
    return { stop: true, reason: "overtrading_bad_expectancy" };
  if (m.netPnL < -m.startBalance * 0.1) return { stop: true, reason: "netPnL>10pct_loss" };
  return { stop: false, reason: null };
};

/** Stage-1: promote families with meaningful volume potential near breakeven. */
export const shouldPromoteStage1 = (m: DiscoveryMetrics): { promote: boolean; reason: string } => {
  if (m.tradesCount < 8) return { promote: false, reason: "tradesCount<8" };
  if (m.totalVolume < 100) return { promote: false, reason: "totalVolume<100" };
  if (m.maxDrawdownPct > 40) return { promote: false, reason: "maxDrawdownPct>40" };
  if (isFeeDeathSpiral(m)) return { promote: false, reason: "fee_death_spiral" };
  if (m.profitFactor < 0.6) return { promote: false, reason: "profitFactor<0.6" };
  const nearBreakeven = m.netPnL >= -m.startBalance * 0.03;
  const hasVolume = m.totalVolume >= 300;
  if (hasVolume && nearBreakeven) return { promote: true, reason: "volume_near_breakeven" };
  if (m.totalVolume >= 800 && m.maxDrawdownPct <= 35)
    return { promote: true, reason: "high_volume_candidate" };
  return { promote: false, reason: "low_volume_or_loss" };
};
