import { fin } from "../../indicatorCache.js";
import { num } from "../../grids.js";
import { buildResult } from "../../resultBuilder.js";
import { createSim, finalize, runBar, signal } from "../../simulator.js";
import { passMinMoveVsFee, passMinAtrPct, passVolatilityFilter, passVolumeMult, ctxRisk } from "../strategyCommon.js";
import { COMMON_DEFAULTS } from "../phasedGrids.js";
import { pack, type FamilyStrategyPack } from "./familyKit.js";

const run = (ctx: import("../../types.js").StrategyContext) => {
  const p = ctx.params;
  const lb = num(p, "lookback", 20);
  const bm = num(p, "breakoutMult", 0.8);
  const atr = ctx.cache.atr.get(num(p, "atrPeriod", 14))!;
  const { highs, lows } = ctx.cache;
  const { risk, lev } = ctxRisk(ctx);
  const state = createSim(ctx.initialBalance, p);

  for (let i = lb; i < ctx.candles.length; i++) {
    runBar(state, ctx.candles, i, ctx.entryMode, risk, lev, ctx.feeRate);
    if (state.position) continue;
    if (!passVolatilityFilter(ctx.cache, i, p) || !passMinAtrPct(ctx.cache, i, p) || !passVolumeMult(ctx.cache, i, p)) continue;
    const a = atr[i]!;
    if (!fin(a)) continue;
    const rh = Math.max(...highs.slice(i - lb, i));
    const rl = Math.min(...lows.slice(i - lb, i));
    const c = ctx.candles[i]!;
    const th = a * bm;
    if (c.close > rh + th) {
      const st = c.close - a * num(p, "stopMult", 1.2);
      if (passMinMoveVsFee(c.close, st, p, ctx.feeRate)) signal(state, ctx.candles, i, "long", st, ctx.entryMode, risk, lev, ctx.feeRate);
    } else if (c.close < rl - th) {
      const st = c.close + a * num(p, "stopMult", 1.2);
      if (passMinMoveVsFee(c.close, st, p, ctx.feeRate)) signal(state, ctx.candles, i, "short", st, ctx.entryMode, risk, lev, ctx.feeRate);
    }
  }
  finalize(state, ctx.candles, ctx.feeRate);
  return buildResult("ATR_VOLATILITY_BREAKOUT", p, state, ctx);
};

export const atrVolatilityBreakoutFamily: FamilyStrategyPack = pack(
  "atr_volatility_breakout",
  "ATR volatility breakout",
  "ATR_VOLATILITY_BREAKOUT",
  { ...COMMON_DEFAULTS, lookback: 20, breakoutMult: 0.8, stopMult: 1.2 },
  { atrPeriods: [10, 14, 20], volumeSmaPeriods: [20] },
  {
    lookback: [15, 20, 30],
    breakoutMult: [0.6, 0.8, 1],
    stopMult: [1, 1.2],
  },
  run
);
