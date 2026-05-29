import type { PhasedStrategyDefinition, StrategyContext } from "../types.js";
import { fin } from "../indicatorCache.js";
import { num } from "../grids.js";
import { buildResult } from "../resultBuilder.js";
import { createSim, finalize, runBar, signal } from "../simulator.js";
import { passMinMoveVsFee, passVolatilityFilter, ctxRisk } from "./strategyCommon.js";
import { COMMON_DEFAULTS } from "./phasedGrids.js";
const NAME = "EMA_CROSSOVER_ATR";

const SCREEN = {
  quick: { emaShort: [8, 12], emaLong: [21, 26] },
  fast: { emaShort: [8, 10, 12], emaLong: [21, 26, 34] },
  full: { emaShort: [6, 8, 10, 12], emaLong: [18, 21, 26, 34] },
};

const P1 = {
  quick: { emaShort: [8, 12], emaLong: [21, 26, 34] },
  fast: { emaShort: [8, 10, 12, 14], emaLong: [18, 21, 26, 34] },
  full: { emaShort: [6, 8, 10, 12, 14], emaLong: [18, 21, 26, 34, 50] },
};

const run = (ctx: StrategyContext) => {
  const p = ctx.params;
  const es = num(p, "emaShort", 12);
  const el = num(p, "emaLong", 26);
  const atrP = num(p, "atrPeriod", 14);
  const atrM = num(p, "atrMult", 1.5);
  const emaS = ctx.cache.ema.get(es)!;
  const emaL = ctx.cache.ema.get(el)!;
  const atr = ctx.cache.atr.get(atrP)!;
  const { risk, lev } = ctxRisk(ctx);
  const state = createSim(ctx.initialBalance, p);

  for (let i = 1; i < ctx.candles.length; i++) {
    runBar(state, ctx.candles, i, ctx.entryMode, risk, lev, ctx.feeRate);
    if (state.position) continue;
    if (!passVolatilityFilter(ctx.cache, i, p)) continue;
    const ps = emaS[i - 1]!,
      pl = emaL[i - 1]!,
      cs = emaS[i]!,
      cl = emaL[i]!,
      a = atr[i]!;
    if (!fin(ps) || !fin(cs) || !fin(a)) continue;
    const bull = ps <= pl && cs > cl;
    const bear = ps >= pl && cs < cl;
    if (bull || bear) state.diagnostics.crossoverCount += 1;
    if (!bull && !bear) continue;
    const c = ctx.candles[i]!;
    const stop = bull ? c.close - a * atrM : c.close + a * atrM;
    if (!passMinMoveVsFee(c.close, stop, p, ctx.feeRate)) continue;
    signal(state, ctx.candles, i, bull ? "long" : "short", stop, ctx.entryMode, risk, lev, ctx.feeRate);
  }
  finalize(state, ctx.candles, ctx.feeRate);
  return buildResult(NAME, p, state, ctx);
};

export const emaCrossoverAtr: PhasedStrategyDefinition = {
  strategyName: NAME,
  defaults: { ...COMMON_DEFAULTS },
  screenGrids: SCREEN,
  phase1EntryGrids: P1,
  indicatorReq: { emaPeriods: [6, 8, 10, 12, 14, 18, 21, 26, 34, 50], atrPeriods: [10, 14, 20] },
  run,
};
