import { fin } from "../../indicatorCache.js";
import { num } from "../../grids.js";
import { buildResult } from "../../resultBuilder.js";
import { closePos, createSim, finalize, runBar, signal } from "../../simulator.js";
import { ctxRisk } from "../strategyCommon.js";
import { COMMON_DEFAULTS } from "../phasedGrids.js";
import { pack, type FamilyStrategyPack } from "./familyKit.js";

const run = (ctx: import("../../types.js").StrategyContext) => {
  const p = ctx.params;
  const ch = num(p, "channelPeriod", 20);
  const dh = ctx.cache.donchianHigh.get(ch)!;
  const dl = ctx.cache.donchianLow.get(ch)!;
  const atr = ctx.cache.atr.get(num(p, "atrPeriod", 14))!;
  const { risk, lev } = ctxRisk(ctx);
  const state = createSim(ctx.initialBalance, p);

  for (let i = 2; i < ctx.candles.length; i++) {
    runBar(state, ctx.candles, i, ctx.entryMode, risk, lev, ctx.feeRate);
    const c = ctx.candles[i]!;
    const ph = dh[i - 1]!, pl = dl[i - 1]!, a = atr[i]!;
    if (state.position) {
      if (state.position.direction === "long" && fin(pl) && c.close < pl) closePos(state, c, i, c.close, "exit", ctx.feeRate, "exitsBySignal");
      else if (state.position.direction === "short" && fin(ph) && c.close > ph) closePos(state, c, i, c.close, "exit", ctx.feeRate, "exitsBySignal");
      continue;
    }
    if (!fin(ph) || !fin(pl) || !fin(a)) continue;
    if (c.close > ph) signal(state, ctx.candles, i, "long", c.close - a * num(p, "atrMult", 1.2), ctx.entryMode, risk, lev, ctx.feeRate);
    else if (c.close < pl) signal(state, ctx.candles, i, "short", c.close + a * num(p, "atrMult", 1.2), ctx.entryMode, risk, lev, ctx.feeRate);
  }
  finalize(state, ctx.candles, ctx.feeRate);
  return buildResult("DONCHIAN_BREAKOUT", p, state, ctx);
};

export const donchianBreakoutFamily: FamilyStrategyPack = pack(
  "donchian_breakout",
  "Donchian breakout",
  "DONCHIAN_BREAKOUT",
  { ...COMMON_DEFAULTS, channelPeriod: 20 },
  { donchianPeriods: [15, 20, 30, 40], atrPeriods: [10, 14, 20] },
  {
    channelPeriod: [15, 20, 30],
    atrMult: [1, 1.2],
  },
  run
);
