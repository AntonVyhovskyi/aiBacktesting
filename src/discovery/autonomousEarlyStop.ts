import type { DiscoveryMetrics } from "./types.js";
import type { AutonomousEvaluation } from "./weeklyVolumeEvaluation.js";

export type AutonomousEarlyStop = { stop: boolean; reason: string | null };

export const shouldEarlyStopVariant = (
  metrics: DiscoveryMetrics,
  weekCount: number,
  weeksWithTrades: number
): AutonomousEarlyStop => {
  if (metrics.tradesCount === 0) return { stop: true, reason: "no_trades" };
  if (metrics.maxDrawdownPct > 55) return { stop: true, reason: "huge_drawdown" };
  if (metrics.netPnL < -metrics.startBalance * 0.2)
    return { stop: true, reason: "deep_loss" };
  if (metrics.grossPnL > 0 && metrics.totalFees > metrics.grossPnL * 4)
    return { stop: true, reason: "obvious_fee_death" };
  if (metrics.grossPnL <= 0 && metrics.totalFees > metrics.startBalance * 0.35)
    return { stop: true, reason: "fee_death_negative_gross" };
  if (metrics.tradesCount > 400 && metrics.averagePnLPerTrade < -0.5)
    return { stop: true, reason: "overtrading" };
  if (weekCount >= 2 && weeksWithTrades === 0)
    return { stop: true, reason: "dies_in_first_weeks" };
  return { stop: false, reason: null };
};

export const shouldPromoteAutonomousFamily = (ev: AutonomousEvaluation): { promote: boolean; reason: string } => {
  const m = ev.metrics;
  if (m.tradesCount < 6) return { promote: false, reason: "tradesCount<6" };
  if (ev.rejectReasons.includes("severe_fee_death") || ev.rejectReasons.includes("fee_death_negative_gross"))
    return { promote: false, reason: "fee_death" };
  if (m.maxDrawdownPct > 45) return { promote: false, reason: "drawdown>45" };
  if (ev.averageWeeklyNotionalVolume >= 1500)
    return { promote: true, reason: "weekly_volume_potential" };
  if (m.netPnL >= -8 && ev.averageWeeklyNotionalVolume >= 800)
    return { promote: true, reason: "volume_near_breakeven" };
  if (m.profitFactor >= 0.75 && m.tradesCount >= 15 && ev.nearBreakevenOrProfitableWeeks >= 2)
    return { promote: true, reason: "stable_weeks" };
  if (m.totalNotional >= 3000 && m.maxDrawdownPct <= 38)
    return { promote: true, reason: "high_notional_candidate" };
  return { promote: false, reason: "low_volume_or_unstable" };
};
