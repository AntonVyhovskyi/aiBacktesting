import { fin } from "../../indicatorCache.js";
import { num } from "../../grids.js";
import { buildResult } from "../../resultBuilder.js";
import { closePos, createSim, finalize, runBar, signal } from "../../simulator.js";
import { ctxRisk } from "../strategyCommon.js";
import { COMMON_DEFAULTS } from "../phasedGrids.js";
import { pack, type FamilyStrategyPack } from "./familyKit.js";

const run = (ctx: import("../../types.js").StrategyContext) => {
  const p = ctx.params;
  const dev = num(p, "deviationPct", 0.15) / 100;
  const atr = ctx.cache.atr.get(num(p, "atrPeriod", 14))!;
  const { risk, lev } = ctxRisk(ctx);
  const state = createSim(ctx.initialBalance, p);

  for (let i = 2; i < ctx.candles.length; i++) {
    runBar(state, ctx.candles, i, ctx.entryMode, risk, lev, ctx.feeRate);
    const c = ctx.candles[i]!;
    const vw = ctx.cache.vwap[i]!;
    const pvw = ctx.cache.vwap[i - 1]!;
    const a = atr[i]!;
    if (!fin(vw) || !fin(a)) continue;
    const band = dev * vw;
    if (state.position) {
      if (state.position.direction === "long" && c.close >= vw) closePos(state, c, i, c.close, "exit", ctx.feeRate, "exitsBySignal");
      else if (state.position.direction === "short" && c.close <= vw) closePos(state, c, i, c.close, "exit", ctx.feeRate, "exitsBySignal");
      continue;
    }
    if (c.low <= vw - band && c.close > vw - band && c.close > pvw)
      signal(state, ctx.candles, i, "long", c.close - a * num(p, "atrMult", 1.2), ctx.entryMode, risk, lev, ctx.feeRate);
    else if (c.high >= vw + band && c.close < vw + band && c.close < pvw)
      signal(state, ctx.candles, i, "short", c.close + a * num(p, "atrMult", 1.2), ctx.entryMode, risk, lev, ctx.feeRate);
  }
  finalize(state, ctx.candles, ctx.feeRate);
  return buildResult("VWAP_PULLBACK", p, state, ctx);
};

export const vwapPullbackFamily: FamilyStrategyPack = pack(
  "vwap_pullback",
  "VWAP pullback",
  "VWAP_PULLBACK",
  { ...COMMON_DEFAULTS, deviationPct: 0.15 },
  { vwap: true, atrPeriods: [10, 14, 20] },
  {
    deviationPct: [0.1, 0.15, 0.2],
    atrMult: [1, 1.2],
  },
  run
);
