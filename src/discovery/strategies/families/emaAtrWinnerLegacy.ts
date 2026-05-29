/**
 * Faithful port of max-volume search winner: EMA_CROSSOVER_ATR
 * Source: data/results/max-monthly-volume-10dd-search-final.json (rank #1 under 10% DD)
 * Logic matches src/discovery/strategies/emaCrossoverAtr.ts — exits via shared simulator (BE/trail/SL).
 */
import { fin } from "../../indicatorCache.js";
import { num } from "../../grids.js";
import { buildResult } from "../../resultBuilder.js";
import { createSim, finalize, runBar, signal } from "../../simulator.js";
import { passMinMoveVsFee, passVolatilityFilter, ctxRisk } from "../strategyCommon.js";
import { COMMON_DEFAULTS } from "../phasedGrids.js";
import { pack, type FamilyStrategyPack } from "./familyKit.js";

export const EMA_ATR_WINNER_LEGACY_PARAMS: Record<string, number | string> = {
  ...COMMON_DEFAULTS,
  emaShort: 12,
  emaLong: 21,
  atrPeriod: 14,
  atrMult: 0.8,
  trailStart: 0.1,
  trailGap: 0.4,
  takeProfitPct: 0,
  breakEvenPct: 0.3,
  maxHoldCandles: 0,
  cooldownCandles: 3,
  minAtrFilter: 0,
  minMoveVsFeeMult: 2,
  maxTradesPerDay: 999,
  riskPct: 0.5,
  leverage: 3,
};

/** Params in JSON but not read by emaCrossoverAtr.ts (documented in bot spec). */
export const EMA_ATR_WINNER_INACTIVE_PARAMS = [
  "minVolumeMult",
  "minAtrPct",
  "exitOnOppositeSignal",
  "minEmaDistancePct",
] as const;

const STRATEGY_NAME = "EMA_ATR_WINNER_LEGACY";

const run = (ctx: import("../../types.js").StrategyContext) => {
  const p = ctx.params;
  const es = num(p, "emaShort", 12);
  const el = num(p, "emaLong", 21);
  const atrP = num(p, "atrPeriod", 14);
  const atrM = num(p, "atrMult", 0.8);
  const emaS = ctx.cache.ema.get(es)!;
  const emaL = ctx.cache.ema.get(el)!;
  const atr = ctx.cache.atr.get(atrP)!;
  const { risk, lev } = ctxRisk(ctx);
  const state = createSim(ctx.initialBalance, p);

  for (let i = 1; i < ctx.candles.length; i++) {
    runBar(state, ctx.candles, i, ctx.entryMode, risk, lev, ctx.feeRate);
    if (state.position) continue;
    if (!passVolatilityFilter(ctx.cache, i, p)) continue;
    const ps = emaS[i - 1]!;
    const pl = emaL[i - 1]!;
    const cs = emaS[i]!;
    const cl = emaL[i]!;
    const a = atr[i]!;
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
  return buildResult(STRATEGY_NAME, p, state, ctx);
};

export const emaAtrWinnerLegacyFamily: FamilyStrategyPack = {
  ...pack(
    "ema_atr_winner_legacy",
    "EMA_ATR_WINNER_LEGACY (O1 max-volume winner)",
    STRATEGY_NAME,
    EMA_ATR_WINNER_LEGACY_PARAMS,
    { emaPeriods: [12, 21], atrPeriods: [14] },
    {},
    run
  ),
  searchGrid: {},
};

/** Small safe tweaks — second pass only. */
export const emaAtrWinnerTunedGrid = {
  atrMult: [0.8, 0.9],
  trailGap: [0.35, 0.4],
  cooldownCandles: [2, 3],
  minMoveVsFeeMult: [2, 2.5],
} as const;

export const emaAtrWinnerTunedFamily: FamilyStrategyPack = {
  ...emaAtrWinnerLegacyFamily,
  familyId: "ema_atr_winner_tuned",
  label: "EMA_ATR_WINNER_LEGACY (small tune grid)",
  searchGrid: emaAtrWinnerTunedGrid,
};
