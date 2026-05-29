import { fin } from "../../indicatorCache.js";
import { num } from "../../grids.js";
import { buildResult } from "../../resultBuilder.js";
import { closePos, createSim, finalize, runBar, signal } from "../../simulator.js";
import { ctxRisk } from "../strategyCommon.js";
import { COMMON_DEFAULTS } from "../phasedGrids.js";
import { pack, type FamilyStrategyPack } from "./familyKit.js";

const run = (ctx: import("../../types.js").StrategyContext) => {
  const p = ctx.params;
  const rsi = ctx.cache.rsi.get(num(p, "rsiPeriod", 14))!;
  const atr = ctx.cache.atr.get(num(p, "atrPeriod", 14))!;
  const { risk, lev } = ctxRisk(ctx);
  const state = createSim(ctx.initialBalance, p);
  const os = num(p, "oversold", 30);
  const ob = num(p, "overbought", 70);

  for (let i = 1; i < ctx.candles.length; i++) {
    runBar(state, ctx.candles, i, ctx.entryMode, risk, lev, ctx.feeRate);
    const c = ctx.candles[i]!;
    const r = rsi[i]!, pr = rsi[i - 1]!, a = atr[i]!;
    if (state.position) {
      if (state.position.direction === "long" && fin(r) && r >= 50) closePos(state, c, i, c.close, "exit", ctx.feeRate, "exitsBySignal");
      else if (state.position.direction === "short" && fin(r) && r <= 50) closePos(state, c, i, c.close, "exit", ctx.feeRate, "exitsBySignal");
      continue;
    }
    if (!fin(r) || !fin(pr) || !fin(a)) continue;
    if (pr < os && r >= os) signal(state, ctx.candles, i, "long", c.close - a * num(p, "atrMult", 1.2), ctx.entryMode, risk, lev, ctx.feeRate);
    else if (pr > ob && r <= ob) signal(state, ctx.candles, i, "short", c.close + a * num(p, "atrMult", 1.2), ctx.entryMode, risk, lev, ctx.feeRate);
  }
  finalize(state, ctx.candles, ctx.feeRate);
  return buildResult("RSI_MEAN_REVERSION", p, state, ctx);
};

export const rsiMeanReversionFamily: FamilyStrategyPack = pack(
  "rsi_mean_reversion",
  "RSI mean reversion",
  "RSI_MEAN_REVERSION",
  { ...COMMON_DEFAULTS, rsiPeriod: 14, oversold: 30, overbought: 70 },
  { rsiPeriods: [7, 10, 14, 21], atrPeriods: [10, 14, 20] },
  {
    rsiPeriod: [7, 14],
    oversold: [25, 30],
    overbought: [70, 75],
    atrMult: [1, 1.2],
  },
  run
);
