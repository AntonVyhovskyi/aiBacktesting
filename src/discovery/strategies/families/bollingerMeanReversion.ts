import { bbCacheKey, fin } from "../../indicatorCache.js";
import { num } from "../../grids.js";
import { buildResult } from "../../resultBuilder.js";
import { closePos, createSim, finalize, runBar, signal } from "../../simulator.js";
import { passMinMoveVsFee, passVolatilityFilter, passVolumeMult, ctxRisk } from "../strategyCommon.js";
import { COMMON_DEFAULTS } from "../phasedGrids.js";
import { pack, type FamilyStrategyPack } from "./familyKit.js";

const run = (ctx: import("../../types.js").StrategyContext) => {
  const p = ctx.params;
  const bp = num(p, "bbPeriod", 20);
  const std = num(p, "bbStdDev", 2);
  const bands = ctx.cache.bb.get(bbCacheKey(bp, std))!;
  const atr = ctx.cache.atr.get(num(p, "atrPeriod", 14))!;
  const { risk, lev } = ctxRisk(ctx);
  const state = createSim(ctx.initialBalance, p);

  for (let i = 1; i < ctx.candles.length; i++) {
    runBar(state, ctx.candles, i, ctx.entryMode, risk, lev, ctx.feeRate);
    const c = ctx.candles[i]!;
    const u = bands.upper[i]!, l = bands.lower[i]!, m = bands.middle[i]!, a = atr[i]!;
    if (state.position) {
      if (state.position.direction === "long" && fin(m) && c.close >= m) closePos(state, c, i, c.close, "exit", ctx.feeRate, "exitsBySignal");
      else if (state.position.direction === "short" && fin(m) && c.close <= m) closePos(state, c, i, c.close, "exit", ctx.feeRate, "exitsBySignal");
      continue;
    }
    if (!fin(u) || !fin(l) || !fin(a)) continue;
    if (!passVolatilityFilter(ctx.cache, i, p) || !passVolumeMult(ctx.cache, i, p)) continue;
    const stL = c.close - a * num(p, "atrMult", 1.2);
    const stS = c.close + a * num(p, "atrMult", 1.2);
    if (c.close < l && passMinMoveVsFee(c.close, stL, p, ctx.feeRate))
      signal(state, ctx.candles, i, "long", stL, ctx.entryMode, risk, lev, ctx.feeRate);
    else if (c.close > u && passMinMoveVsFee(c.close, stS, p, ctx.feeRate))
      signal(state, ctx.candles, i, "short", stS, ctx.entryMode, risk, lev, ctx.feeRate);
  }
  finalize(state, ctx.candles, ctx.feeRate);
  return buildResult("BOLLINGER_MEAN_REVERSION", p, state, ctx);
};

export const bollingerMeanReversionFamily: FamilyStrategyPack = pack(
  "bollinger_mean_reversion",
  "Bollinger mean reversion",
  "BOLLINGER_MEAN_REVERSION",
  { ...COMMON_DEFAULTS, bbPeriod: 20, bbStdDev: 2 },
  {
    bbPeriods: [18, 20],
    bbConfigs: [
      { period: 18, stdDev: 1.8 },
      { period: 18, stdDev: 2 },
      { period: 20, stdDev: 1.8 },
      { period: 20, stdDev: 2 },
    ],
    atrPeriods: [10, 14, 20],
    volumeSmaPeriods: [20],
  },
  {
    bbPeriod: [18, 20],
    bbStdDev: [1.8, 2],
    atrMult: [1, 1.2],
  },
  run
);
