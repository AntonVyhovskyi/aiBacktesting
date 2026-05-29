import { computeMetrics } from "./metrics.js";
import { buildMonthlyProfitMetrics, MAX_ONE_MONTH_DOMINANCE_PCT } from "./stableProfitEvaluation.js";
import type { DiscoveryMetrics, DiscoveryTrade } from "./types.js";

export type EarlyRejectResult = { reject: true; reason: string } | { reject: false };

/** Fast gates before full monthly scoring (saves TopK / ranking work). */
export const quickMetricsReject = (m: DiscoveryMetrics, lax = false): EarlyRejectResult => {
  if (m.tradesCount < (lax ? 8 : 15)) return { reject: true, reason: "trades_too_low" };
  if (m.maxDrawdownPct > 25) return { reject: true, reason: "early_dd>25" };
  if (m.tradesCount >= 10 && m.profitFactor < 0.8) return { reject: true, reason: "early_pf<0.8" };
  if (m.grossPnL > 0 && m.totalFees > m.grossPnL) return { reject: true, reason: "fee_death" };
  if (m.grossPnL <= 0 && m.totalFees > m.startBalance * 0.25)
    return { reject: true, reason: "heavy_fees_negative_gross" };
  return { reject: false };
};

/** Monthly gates after lightweight monthly build. */
export const monthlyEarlyReject = (
  trades: DiscoveryTrade[],
  metrics: DiscoveryMetrics,
  rangeStart: number,
  rangeEnd: number,
  startBalance: number,
  lax = false
): EarlyRejectResult => {
  const quick = quickMetricsReject(metrics, lax);
  if (quick.reject) return quick;
  if (lax) return { reject: false };

  const monthly = buildMonthlyProfitMetrics(trades, rangeStart, rangeEnd, startBalance);
  const full = monthly.filter((m) => m.isFullMonth);
  const use = full.length >= 2 ? full : monthly.slice(0, 2);

  if (use.length >= 2 && use[0]!.netPnL < 0 && use[1]!.netPnL < 0) {
    return { reject: true, reason: "first_2_months_negative" };
  }

  const minMonthTrades = use.length ? Math.min(...use.map((m) => m.tradesCount)) : 0;
  const monthsSpan = Math.max(use.length, 1);
  const avgTradesPerMonth = metrics.tradesCount / monthsSpan;
  if (minMonthTrades < 10 && avgTradesPerMonth < 10) {
    return { reject: true, reason: "trades_per_month<10" };
  }

  if (metrics.netPnL > 0) {
    const bestMonth = Math.max(...monthly.map((m) => m.netPnL));
    const dom = (bestMonth / metrics.netPnL) * 100;
    if (dom > MAX_ONE_MONTH_DOMINANCE_PCT) {
      return { reject: true, reason: "one_month_dominance" };
    }
  }

  return { reject: false };
};

/** Optional: reject on first 60d window only (cheaper than 6 calendar months). */
export const firstTwoMonthsReject = (
  trades: DiscoveryTrade[],
  rangeStart: number,
  startBalance: number
): EarlyRejectResult => {
  const twoMonthMs = 60 * 86400000;
  const end = rangeStart + twoMonthMs;
  const slice = trades.filter((t) => t.entryTime >= rangeStart && t.entryTime < end);
  if (slice.length < 5) return { reject: false };
  const m = computeMetrics(slice, startBalance, twoMonthMs);
  if (m.netPnL < 0 && m.maxDrawdownPct > 15) return { reject: true, reason: "first_60d_negative_dd" };
  return { reject: false };
};
