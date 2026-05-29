import type { DiscoveryIndicatorCache } from "../indicatorCache.js";
import { fin } from "../indicatorCache.js";
import { num } from "../grids.js";
import type { StrategyContext } from "../types.js";

export const passVolatilityFilter = (
  cache: DiscoveryIndicatorCache,
  i: number,
  params: Record<string, number | string>
): boolean => {
  const minAtr = num(params, "minAtrFilter", 0);
  const atrPeriod = num(params, "atrPeriod", 14);
  if (minAtr <= 0) return true;
  const atr = cache.atr.get(atrPeriod)?.[i];
  return fin(atr) && atr! >= minAtr;
};

/** Minimum ATR as % of price (minAtrPct). */
export const passMinAtrPct = (
  cache: DiscoveryIndicatorCache,
  i: number,
  params: Record<string, number | string>
): boolean => {
  const minPct = num(params, "minAtrPct", 0);
  if (minPct <= 0) return true;
  const atrPeriod = num(params, "atrPeriod", 14);
  const atr = cache.atr.get(atrPeriod)?.[i];
  const c = cache.closes[i];
  if (!fin(atr) || c === undefined || c <= 0) return false;
  return (atr! / c) * 100 >= minPct;
};

export const passVolumeMult = (
  cache: DiscoveryIndicatorCache,
  i: number,
  params: Record<string, number | string>,
  smaPeriod = 20
): boolean => {
  const mult = num(params, "minVolumeMult", 0);
  if (mult <= 0) return true;
  const vsma = cache.volumeSma.get(smaPeriod)?.[i];
  const v = cache.volumes[i];
  if (!fin(vsma) || v === undefined) return false;
  return v >= vsma! * mult;
};

export const passMinMoveVsFee = (
  entry: number,
  stop: number,
  params: Record<string, number | string>,
  feeRate: number
): boolean => {
  const mult = num(params, "minMoveVsFeeMult", 0);
  if (mult <= 0) return true;
  const move = Math.abs(entry - stop);
  return move >= entry * feeRate * mult;
};

export const passEmaDistance = (
  cache: DiscoveryIndicatorCache,
  i: number,
  emaPeriod: number,
  params: Record<string, number | string>
): boolean => {
  const minDist = num(params, "minEmaDistancePct", 0);
  if (minDist <= 0) return true;
  const e = cache.ema.get(emaPeriod)?.[i];
  const c = cache.closes[i];
  if (!fin(e) || c === undefined) return false;
  return (Math.abs(c - e!) / e!) * 100 >= minDist;
};

export const ctxRisk = (ctx: StrategyContext) => ({
  risk: num(ctx.params, "riskPct", ctx.riskPct),
  lev: num(ctx.params, "leverage", ctx.leverage),
});
