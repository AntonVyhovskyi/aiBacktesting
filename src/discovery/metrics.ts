import type { DiscoveryMetrics, DiscoveryTrade } from "./types.js";

const r = (v: number) => Math.round(v * 1e6) / 1e6;

export const computeMetrics = (
  trades: DiscoveryTrade[],
  startBalance: number,
  spanMs: number
): DiscoveryMetrics => {
  if (!trades.length) {
    return {
      startBalance,
      endBalance: startBalance,
      grossPnL: 0,
      totalFees: 0,
      netPnL: 0,
      netPnLPct: 0,
      tradesCount: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      totalVolume: 0,
      totalNotional: 0,
      feesToVolumeRatio: 0,
      netPnlToVolumeRatio: 0,
      averageTradeDurationCandles: 0,
      tradesPerDay: 0,
      averagePnLPerTrade: 0,
      averageFeePerTrade: 0,
      biggestWin: 0,
      biggestLoss: 0,
    };
  }
  const gross = trades.reduce((s, t) => s + t.grossPnL, 0);
  const fees = trades.reduce((s, t) => s + t.fees, 0);
  const net = trades.reduce((s, t) => s + t.netPnL, 0);
  const wins = trades.filter((t) => t.netPnL > 0);
  const losses = trades.filter((t) => t.netPnL <= 0);
  const winSum = wins.reduce((s, t) => s + t.netPnL, 0);
  const lossSum = Math.abs(losses.reduce((s, t) => s + t.netPnL, 0));
  let peak = startBalance;
  let maxDd = 0;
  for (const t of trades) {
    if (t.balanceAfter > peak) peak = t.balanceAfter;
    const dd = peak > 0 ? ((peak - t.balanceAfter) / peak) * 100 : 0;
    if (dd > maxDd) maxDd = dd;
  }
  const vol = trades.reduce((s, t) => s + t.qty, 0);
  const notional = trades.reduce((s, t) => s + t.qty * t.entryPrice + t.qty * t.exitPrice, 0);
  const days = Math.max(spanMs / 86400000, 1);
  const avgDur = trades.reduce((s, t) => s + t.durationCandles, 0) / trades.length;
  return {
    startBalance,
    endBalance: r(trades[trades.length - 1]!.balanceAfter),
    grossPnL: r(gross),
    totalFees: r(fees),
    netPnL: r(net),
    netPnLPct: startBalance > 0 ? r((net / startBalance) * 100) : 0,
    tradesCount: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: r((wins.length / trades.length) * 100),
    profitFactor: lossSum > 0 ? r(winSum / lossSum) : winSum > 0 ? 999 : 0,
    maxDrawdown: r(maxDd),
    maxDrawdownPct: r(maxDd),
    totalVolume: r(vol),
    totalNotional: r(notional),
    feesToVolumeRatio: vol > 0 ? r(fees / vol) : 0,
    netPnlToVolumeRatio: vol > 0 ? r(net / vol) : 0,
    averageTradeDurationCandles: r(avgDur),
    tradesPerDay: r(trades.length / days),
    averagePnLPerTrade: r(net / trades.length),
    averageFeePerTrade: r(fees / trades.length),
    biggestWin: wins.length ? r(Math.max(...wins.map((t) => t.netPnL))) : 0,
    biggestLoss: losses.length ? r(Math.min(...losses.map((t) => t.netPnL))) : 0,
  };
};
