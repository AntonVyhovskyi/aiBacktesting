import { fin } from "../../indicatorCache.js";
import { num } from "../../grids.js";
import { buildResult } from "../../resultBuilder.js";
import { createSim, finalize, runBar, signal } from "../../simulator.js";
import { passMinMoveVsFee, passVolatilityFilter, ctxRisk } from "../strategyCommon.js";
import { COMMON_DEFAULTS } from "../phasedGrids.js";
import { pack, type FamilyStrategyPack } from "./familyKit.js";

const run = (ctx: import("../../types.js").StrategyContext) => {
  const p = ctx.params;
  const ef = num(p, "emaFast", 12);
  const es = num(p, "emaSlow", 34);
  const f = ctx.cache.ema.get(ef)!;
  const s = ctx.cache.ema.get(es)!;
  const atr = ctx.cache.atr.get(num(p, "atrPeriod", 14))!;
  const { risk, lev } = ctxRisk(ctx);
  const state = createSim(ctx.initialBalance, p);
  const pb = num(p, "pullbackPct", 0.3) / 100;
  const atrM = num(p, "atrMult", 1.2);

  for (let i = 2; i < ctx.candles.length; i++) {
    runBar(state, ctx.candles, i, ctx.entryMode, risk, lev, ctx.feeRate);
    if (state.position) continue;
    if (!passVolatilityFilter(ctx.cache, i, p)) continue;
    const c = ctx.candles[i]!;
    const fa = f[i]!, sa = s[i]!, a = atr[i]!;
    if (!fin(fa) || !fin(sa) || !fin(a)) continue;
    const up = fa > sa && c.close > sa;
    const dn = fa < sa && c.close < sa;
    if (up && c.low <= fa * (1 + pb) && c.close > fa) {
      const st = c.close - a * atrM;
      if (passMinMoveVsFee(c.close, st, p, ctx.feeRate)) signal(state, ctx.candles, i, "long", st, ctx.entryMode, risk, lev, ctx.feeRate);
    } else if (dn && c.high >= fa * (1 - pb) && c.close < fa) {
      const st = c.close + a * atrM;
      if (passMinMoveVsFee(c.close, st, p, ctx.feeRate)) signal(state, ctx.candles, i, "short", st, ctx.entryMode, risk, lev, ctx.feeRate);
    }
  }
  finalize(state, ctx.candles, ctx.feeRate);
  return buildResult("EMA_TREND_CONTINUATION", p, state, ctx);
};

export const emaTrendContinuationFamily: FamilyStrategyPack = pack(
  "ema_trend",
  "EMA trend continuation",
  "EMA_TREND_CONTINUATION",
  { ...COMMON_DEFAULTS, emaFast: 12, emaSlow: 34, pullbackPct: 0.3 },
  { emaPeriods: [8, 12, 16, 26, 34, 50], atrPeriods: [10, 14, 20] },
  {
    emaFast: [8, 12],
    emaSlow: [26, 34],
    pullbackPct: [0.2, 0.35],
    atrMult: [1, 1.2],
  },
  run
);
