import { num } from "../../grids.js";
import { buildResult } from "../../resultBuilder.js";
import { closePos, createSim, finalize, runBar, signal } from "../../simulator.js";
import { passMinMoveVsFee, ctxRisk } from "../strategyCommon.js";
import { COMMON_DEFAULTS } from "../phasedGrids.js";
import { pack, type FamilyStrategyPack } from "./familyKit.js";

/** UTC session key: date + optional 8h block for crypto sessions. */
const sessionKey = (t: number, blockHours: number): string => {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const day = d.getUTCDate();
  const block = blockHours > 0 ? Math.floor(d.getUTCHours() / blockHours) : 0;
  return `${y}-${mo}-${day}-b${block}`;
};

const run = (ctx: import("../../types.js").StrategyContext) => {
  const p = ctx.params;
  const rangeMin = num(p, "rangeMinutes", 60);
  const blockHours = num(p, "sessionBlockHours", 0);
  const rangeMs = rangeMin * 60_000;
  const atr = ctx.cache.atr.get(num(p, "atrPeriod", 14))!;
  const { risk, lev } = ctxRisk(ctx);
  const state = createSim(ctx.initialBalance, p);

  let curKey = "";
  let sessionStart = 0;
  let rangeHigh = 0;
  let rangeLow = Infinity;
  let rangeDone = false;

  for (let i = 1; i < ctx.candles.length; i++) {
    runBar(state, ctx.candles, i, ctx.entryMode, risk, lev, ctx.feeRate);
    const c = ctx.candles[i]!;
    const key = sessionKey(c.openTime, blockHours);
    if (key !== curKey) {
      curKey = key;
      sessionStart = c.openTime;
      rangeHigh = c.high;
      rangeLow = c.low;
      rangeDone = false;
    }
    if (!rangeDone) {
      rangeHigh = Math.max(rangeHigh, c.high);
      rangeLow = Math.min(rangeLow, c.low);
      if (c.openTime - sessionStart >= rangeMs) rangeDone = true;
      continue;
    }
    if (state.position) {
      if (state.position.direction === "long" && c.close < rangeLow) closePos(state, c, i, c.close, "or_fail", ctx.feeRate, "exitsByStopLoss");
      else if (state.position.direction === "short" && c.close > rangeHigh) closePos(state, c, i, c.close, "or_fail", ctx.feeRate, "exitsByStopLoss");
      continue;
    }
    const a = atr[i];
    if (!Number.isFinite(a)) continue;
    const stL = c.close - a! * num(p, "atrMult", 1.2);
    const stS = c.close + a! * num(p, "atrMult", 1.2);
    if (c.close > rangeHigh && passMinMoveVsFee(c.close, stL, p, ctx.feeRate))
      signal(state, ctx.candles, i, "long", stL, ctx.entryMode, risk, lev, ctx.feeRate);
    else if (c.close < rangeLow && passMinMoveVsFee(c.close, stS, p, ctx.feeRate))
      signal(state, ctx.candles, i, "short", stS, ctx.entryMode, risk, lev, ctx.feeRate);
  }
  finalize(state, ctx.candles, ctx.feeRate);
  return buildResult("SESSION_OPENING_RANGE", p, state, ctx);
};

export const sessionOpeningRangeFamily: FamilyStrategyPack = pack(
  "session_opening_range",
  "Opening-range / session breakout",
  "SESSION_OPENING_RANGE",
  { ...COMMON_DEFAULTS, rangeMinutes: 60, sessionBlockHours: 0 },
  { atrPeriods: [10, 14, 20] },
  {
    rangeMinutes: [30, 60, 90],
    sessionBlockHours: [0, 8],
    atrMult: [1, 1.2],
  },
  run
);
