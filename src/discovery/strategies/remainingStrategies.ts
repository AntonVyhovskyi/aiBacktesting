import type { PhasedStrategyDefinition, StrategyContext } from "../types.js";
import { fin } from "../indicatorCache.js";
import { num, boolParam } from "../grids.js";
import { buildResult } from "../resultBuilder.js";
import { closePos, createSim, finalize, runBar, signal } from "../simulator.js";
import { bbCacheKey } from "../indicatorCache.js";
import {
  passMinMoveVsFee,
  passMinAtrPct,
  passVolatilityFilter,
  passVolumeMult,
  ctxRisk,
} from "./strategyCommon.js";
import { COMMON_DEFAULTS } from "./phasedGrids.js";

const mk = (
  NAME: string,
  SCREEN: PhasedStrategyDefinition["screenGrids"],
  P1: PhasedStrategyDefinition["phase1EntryGrids"],
  indicatorReq: PhasedStrategyDefinition["indicatorReq"],
  run: PhasedStrategyDefinition["run"]
): PhasedStrategyDefinition => ({
  strategyName: NAME,
  defaults: { ...COMMON_DEFAULTS },
  screenGrids: SCREEN,
  phase1EntryGrids: P1,
  indicatorReq,
  run,
});

// --- EMA TREND ---
const emaTrendRun = (ctx: StrategyContext) => {
  const p = ctx.params;
  const ef = num(p, "emaFast", 12);
  const es = num(p, "emaSlow", 34);
  const atrP = num(p, "atrPeriod", 14);
  const atrM = num(p, "atrMult", 1.5);
  const pb = num(p, "pullbackPct", 0.3);
  const f = ctx.cache.ema.get(ef)!;
  const s = ctx.cache.ema.get(es)!;
  const atr = ctx.cache.atr.get(atrP)!;
  const { risk, lev } = ctxRisk(ctx);
  const state = createSim(ctx.initialBalance, p);
  for (let i = 2; i < ctx.candles.length; i++) {
    runBar(state, ctx.candles, i, ctx.entryMode, risk, lev, ctx.feeRate);
    if (state.position) continue;
    if (!passVolatilityFilter(ctx.cache, i, p)) continue;
    const c = ctx.candles[i]!;
    const fa = f[i]!,
      sa = s[i]!,
      a = atr[i]!;
    if (!fin(fa) || !fin(sa) || !fin(a)) continue;
    const up = fa > sa && c.close > sa;
    const dn = fa < sa && c.close < sa;
    const pl = up && c.low <= fa * (1 + pb / 100) && c.close > fa;
    const ps = dn && c.high >= fa * (1 - pb / 100) && c.close < fa;
    if (pl) {
      const st = c.close - a * atrM;
      if (passMinMoveVsFee(c.close, st, p, ctx.feeRate)) signal(state, ctx.candles, i, "long", st, ctx.entryMode, risk, lev, ctx.feeRate);
    } else if (ps) {
      const st = c.close + a * atrM;
      if (passMinMoveVsFee(c.close, st, p, ctx.feeRate)) signal(state, ctx.candles, i, "short", st, ctx.entryMode, risk, lev, ctx.feeRate);
    }
  }
  finalize(state, ctx.candles, ctx.feeRate);
  return buildResult("EMA_TREND_CONTINUATION", p, state, ctx);
};

export const emaTrendContinuation = mk(
  "EMA_TREND_CONTINUATION",
  { quick: { emaFast: [8, 12], emaSlow: [34] }, fast: { emaFast: [8, 12], emaSlow: [26, 34] }, full: { emaFast: [8, 12, 16], emaSlow: [26, 34, 50] } },
  { quick: { emaFast: [8, 12], emaSlow: [26, 34], pullbackPct: [0.2, 0.4] }, fast: { emaFast: [8, 12, 16], emaSlow: [26, 34, 50], pullbackPct: [0.2, 0.3, 0.5] }, full: { emaFast: [6, 8, 12, 16], emaSlow: [21, 26, 34, 50], pullbackPct: [0.1, 0.2, 0.3, 0.5] } },
  { emaPeriods: [6, 8, 12, 16, 21, 26, 34, 50], atrPeriods: [10, 14, 20] },
  emaTrendRun
);

// --- RSI MEAN REV ---
const rsiMrRun = (ctx: StrategyContext) => {
  const p = ctx.params;
  const rp = num(p, "rsiPeriod", 14);
  const os = num(p, "oversold", 30);
  const ob = num(p, "overbought", 70);
  const rsi = ctx.cache.rsi.get(rp)!;
  const atr = ctx.cache.atr.get(num(p, "atrPeriod", 14))!;
  const { risk, lev } = ctxRisk(ctx);
  const state = createSim(ctx.initialBalance, p);
  for (let i = 1; i < ctx.candles.length; i++) {
    runBar(state, ctx.candles, i, ctx.entryMode, risk, lev, ctx.feeRate);
    const c = ctx.candles[i]!;
    const r = rsi[i]!,
      pr = rsi[i - 1]!;
    const a = atr[i]!;
    if (state.position) {
      if (state.position.direction === "long" && fin(r) && r >= 50) closePos(state, c, i, c.close, "exit", ctx.feeRate, "exitsBySignal");
      else if (state.position.direction === "short" && fin(r) && r <= 50) closePos(state, c, i, c.close, "exit", ctx.feeRate, "exitsBySignal");
      continue;
    }
    if (!fin(r) || !fin(pr) || !fin(a)) continue;
    if (pr < os && r >= os) {
      const st = c.close - a * num(p, "atrMult", 1.5);
      signal(state, ctx.candles, i, "long", st, ctx.entryMode, risk, lev, ctx.feeRate);
    } else if (pr > ob && r <= ob) {
      const st = c.close + a * num(p, "atrMult", 1.5);
      signal(state, ctx.candles, i, "short", st, ctx.entryMode, risk, lev, ctx.feeRate);
    }
  }
  finalize(state, ctx.candles, ctx.feeRate);
  return buildResult("RSI_MEAN_REVERSION", p, state, ctx);
};

export const rsiMeanReversion = mk(
  "RSI_MEAN_REVERSION",
  { quick: { rsiPeriod: [14], oversold: [30], overbought: [70] }, fast: { rsiPeriod: [7, 14], oversold: [25, 30], overbought: [70, 75] }, full: { rsiPeriod: [7, 14, 21], oversold: [25, 30, 35], overbought: [65, 70, 75] } },
  { quick: { rsiPeriod: [7, 14], oversold: [25, 30, 35], overbought: [65, 70, 75] }, fast: { rsiPeriod: [7, 10, 14], oversold: [20, 25, 30, 35], overbought: [65, 70, 75, 80] }, full: { rsiPeriod: [7, 10, 14, 21], oversold: [20, 25, 30, 35], overbought: [65, 70, 75, 80] } },
  { rsiPeriods: [7, 10, 14, 21], atrPeriods: [10, 14, 20] },
  rsiMrRun
);

// --- RSI ADX ---
const rsiAdxRun = (ctx: StrategyContext) => {
  const p = ctx.params;
  const rp = num(p, "rsiPeriod", 14);
  const ap = num(p, "adxPeriod", 14);
  const adxMin = num(p, "adxMin", 25);
  const rLong = num(p, "rsiLongMin", 55);
  const rShort = num(p, "rsiShortMax", 45);
  const rsi = ctx.cache.rsi.get(rp)!;
  const adx = ctx.cache.adx.get(ap)!;
  const atr = ctx.cache.atr.get(num(p, "atrPeriod", 14))!;
  const { risk, lev } = ctxRisk(ctx);
  const state = createSim(ctx.initialBalance, p);
  for (let i = 2; i < ctx.candles.length; i++) {
    runBar(state, ctx.candles, i, ctx.entryMode, risk, lev, ctx.feeRate);
    const c = ctx.candles[i]!;
    const r = rsi[i]!,
      a = adx[i]!,
      at = atr[i]!;
    if (state.position) {
      if (boolParam(p, "exitOnOppositeSignal")) {
        if (state.position.direction === "long" && fin(r) && r < 45) closePos(state, c, i, c.close, "exit", ctx.feeRate, "exitsBySignal");
        else if (state.position.direction === "short" && fin(r) && r > 55) closePos(state, c, i, c.close, "exit", ctx.feeRate, "exitsBySignal");
      }
      continue;
    }
    if (!fin(r) || !fin(a) || !fin(at) || a < adxMin) continue;
    if (r >= rLong) signal(state, ctx.candles, i, "long", c.close - at * num(p, "atrMult", 1.5), ctx.entryMode, risk, lev, ctx.feeRate);
    else if (r <= rShort) signal(state, ctx.candles, i, "short", c.close + at * num(p, "atrMult", 1.5), ctx.entryMode, risk, lev, ctx.feeRate);
  }
  finalize(state, ctx.candles, ctx.feeRate);
  return buildResult("RSI_ADX_TREND", p, state, ctx);
};

export const rsiAdxTrend = mk(
  "RSI_ADX_TREND",
  { quick: { rsiPeriod: [14], adxMin: [25] }, fast: { rsiPeriod: [10, 14], adxMin: [20, 25, 30] }, full: { rsiPeriod: [7, 10, 14], adxMin: [18, 22, 25, 30] } },
  { quick: { rsiPeriod: [14], adxPeriod: [14], adxMin: [20, 25], rsiLongMin: [55], rsiShortMax: [45] }, fast: { rsiPeriod: [10, 14], adxPeriod: [14], adxMin: [20, 25, 30], rsiLongMin: [50, 55, 60], rsiShortMax: [40, 45, 50] }, full: { rsiPeriod: [7, 10, 14], adxPeriod: [10, 14, 20], adxMin: [18, 22, 25, 30], rsiLongMin: [50, 55, 60], rsiShortMax: [35, 40, 45, 50] } },
  { rsiPeriods: [7, 10, 14], adxPeriods: [10, 14, 20], atrPeriods: [10, 14] },
  rsiAdxRun
);

// --- BOLLINGER ---
const bbStop = (
  direction: "long" | "short",
  entry: number,
  atr: number,
  p: Record<string, number | string>
): number => {
  const stopPct = num(p, "stopLossPct", 0);
  const atrMult = num(p, "atrMult", 1.5);
  if (stopPct > 0) {
    return direction === "long" ? entry * (1 - stopPct / 100) : entry * (1 + stopPct / 100);
  }
  return direction === "long" ? entry - atr * atrMult : entry + atr * atrMult;
};

const passRsiConfirm = (
  cache: import("../indicatorCache.js").DiscoveryIndicatorCache,
  i: number,
  direction: "long" | "short",
  p: Record<string, number | string>
): boolean => {
  const rp = num(p, "rsiConfirmPeriod", 0);
  if (rp <= 0) return true;
  const rsi = cache.rsi.get(rp)?.[i];
  if (!fin(rsi)) return false;
  const os = num(p, "rsiOversold", 35);
  const ob = num(p, "rsiOverbought", 65);
  return direction === "long" ? rsi! <= os : rsi! >= ob;
};

const bbRun = (ctx: StrategyContext) => {
  const p = ctx.params;
  const bp = num(p, "bbPeriod", 20);
  const stdDev = num(p, "bbStdDev", 2);
  const bands = ctx.cache.bb.get(bbCacheKey(bp, stdDev))!;
  const atr = ctx.cache.atr.get(num(p, "atrPeriod", 14))!;
  const { risk, lev } = ctxRisk(ctx);
  const state = createSim(ctx.initialBalance, p);
  for (let i = 1; i < ctx.candles.length; i++) {
    runBar(state, ctx.candles, i, ctx.entryMode, risk, lev, ctx.feeRate);
    const c = ctx.candles[i]!;
    const u = bands.upper[i]!,
      l = bands.lower[i]!,
      m = bands.middle[i]!,
      a = atr[i]!;
    if (state.position) {
      if (state.position.direction === "long" && fin(m) && c.close >= m) closePos(state, c, i, c.close, "exit", ctx.feeRate, "exitsBySignal");
      else if (state.position.direction === "short" && fin(m) && c.close <= m) closePos(state, c, i, c.close, "exit", ctx.feeRate, "exitsBySignal");
      continue;
    }
    if (!fin(u) || !fin(l) || !fin(a)) continue;
    if (!passVolatilityFilter(ctx.cache, i, p) || !passVolumeMult(ctx.cache, i, p)) continue;
    if (c.close < l && passRsiConfirm(ctx.cache, i, "long", p)) {
      const st = bbStop("long", c.close, a, p);
      if (passMinMoveVsFee(c.close, st, p, ctx.feeRate))
        signal(state, ctx.candles, i, "long", st, ctx.entryMode, risk, lev, ctx.feeRate);
    } else if (c.close > u && passRsiConfirm(ctx.cache, i, "short", p)) {
      const st = bbStop("short", c.close, a, p);
      if (passMinMoveVsFee(c.close, st, p, ctx.feeRate))
        signal(state, ctx.candles, i, "short", st, ctx.entryMode, risk, lev, ctx.feeRate);
    }
  }
  finalize(state, ctx.candles, ctx.feeRate);
  return buildResult("BOLLINGER_MEAN_REVERSION", p, state, ctx);
};

export const bollingerMeanReversion = mk(
  "BOLLINGER_MEAN_REVERSION",
  { quick: { bbPeriod: [20] }, fast: { bbPeriod: [15, 20, 25] }, full: { bbPeriod: [10, 15, 20, 25, 30] } },
  { quick: { bbPeriod: [15, 20, 25] }, fast: { bbPeriod: [10, 15, 20, 25, 30] }, full: { bbPeriod: [10, 15, 20, 25, 30] } },
  {
    bbPeriods: [10, 15, 20, 25, 30],
    bbConfigs: [
      { period: 18, stdDev: 1.8 },
      { period: 18, stdDev: 2 },
      { period: 18, stdDev: 2.2 },
      { period: 20, stdDev: 1.8 },
      { period: 20, stdDev: 2 },
      { period: 20, stdDev: 2.2 },
      { period: 22, stdDev: 1.8 },
      { period: 22, stdDev: 2 },
      { period: 22, stdDev: 2.2 },
    ],
    atrPeriods: [10, 12, 14, 16, 20],
    rsiPeriods: [14],
    volumeSmaPeriods: [20],
  },
  bbRun
);

// --- DONCHIAN ---
const donchianRun = (ctx: StrategyContext) => {
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
    const ph = dh[i - 1]!,
      pl = dl[i - 1]!,
      a = atr[i]!;
    if (state.position) {
      if (state.position.direction === "long" && fin(pl) && c.close < pl) closePos(state, c, i, c.close, "exit", ctx.feeRate, "exitsBySignal");
      else if (state.position.direction === "short" && fin(ph) && c.close > ph) closePos(state, c, i, c.close, "exit", ctx.feeRate, "exitsBySignal");
      continue;
    }
    if (!fin(ph) || !fin(pl) || !fin(a)) continue;
    if (c.close > ph) signal(state, ctx.candles, i, "long", c.close - a * num(p, "atrMult", 1.5), ctx.entryMode, risk, lev, ctx.feeRate);
    else if (c.close < pl) signal(state, ctx.candles, i, "short", c.close + a * num(p, "atrMult", 1.5), ctx.entryMode, risk, lev, ctx.feeRate);
  }
  finalize(state, ctx.candles, ctx.feeRate);
  return buildResult("DONCHIAN_BREAKOUT", p, state, ctx);
};

export const donchianBreakout = mk(
  "DONCHIAN_BREAKOUT",
  { quick: { channelPeriod: [20] }, fast: { channelPeriod: [15, 20, 30] }, full: { channelPeriod: [10, 15, 20, 30, 40] } },
  { quick: { channelPeriod: [15, 20, 30] }, fast: { channelPeriod: [10, 15, 20, 30, 40] }, full: { channelPeriod: [10, 15, 20, 30, 40] } },
  { donchianPeriods: [10, 15, 20, 30, 40], atrPeriods: [10, 14, 20] },
  donchianRun
);

// --- ATR VOL ---
const atrVolRun = (ctx: StrategyContext) => {
  const p = ctx.params;
  const atrP = num(p, "atrPeriod", 14);
  const lb = num(p, "lookback", 20);
  const bm = num(p, "breakoutMult", 1.5);
  const atr = ctx.cache.atr.get(atrP)!;
  const { highs, lows } = ctx.cache;
  const { risk, lev } = ctxRisk(ctx);
  const state = createSim(ctx.initialBalance, p);
  for (let i = lb; i < ctx.candles.length; i++) {
    runBar(state, ctx.candles, i, ctx.entryMode, risk, lev, ctx.feeRate);
    if (state.position) continue;
    if (!passVolatilityFilter(ctx.cache, i, p) || !passMinAtrPct(ctx.cache, i, p) || !passVolumeMult(ctx.cache, i, p))
      continue;
    const a = atr[i]!;
    if (!fin(a)) continue;
    const rh = Math.max(...highs.slice(i - lb, i));
    const rl = Math.min(...lows.slice(i - lb, i));
    const c = ctx.candles[i]!;
    const th = a * bm;
    if (c.close > rh + th) {
      const st = c.close - a * num(p, "stopMult", 1.5);
      if (passMinMoveVsFee(c.close, st, p, ctx.feeRate))
        signal(state, ctx.candles, i, "long", st, ctx.entryMode, risk, lev, ctx.feeRate);
    } else if (c.close < rl - th) {
      const st = c.close + a * num(p, "stopMult", 1.5);
      if (passMinMoveVsFee(c.close, st, p, ctx.feeRate))
        signal(state, ctx.candles, i, "short", st, ctx.entryMode, risk, lev, ctx.feeRate);
    }
  }
  finalize(state, ctx.candles, ctx.feeRate);
  return buildResult("ATR_VOLATILITY_BREAKOUT", p, state, ctx);
};

export const atrVolatilityBreakout = mk(
  "ATR_VOLATILITY_BREAKOUT",
  {
    quick: { lookback: [10, 15, 20], breakoutMult: [0.5, 0.8, 1, 1.2] },
    fast: { lookback: [8, 10, 15, 20, 30], breakoutMult: [0.4, 0.6, 0.8, 1, 1.2, 1.5] },
    full: { lookback: [5, 8, 10, 15, 20, 30], breakoutMult: [0.3, 0.4, 0.6, 0.8, 1, 1.2, 1.5] },
  },
  {
    quick: { lookback: [8, 10, 15, 20], breakoutMult: [0.4, 0.6, 0.8, 1], stopMult: [0.8, 1, 1.2] },
    fast: { lookback: [5, 8, 10, 15, 20, 30], breakoutMult: [0.3, 0.4, 0.6, 0.8, 1, 1.2], stopMult: [0.6, 0.8, 1, 1.2, 1.5] },
    full: { lookback: [5, 8, 10, 15, 20, 30, 40], breakoutMult: [0.2, 0.3, 0.4, 0.6, 0.8, 1], stopMult: [0.5, 0.8, 1, 1.2, 1.5] },
  },
  { atrPeriods: [7, 10, 12, 14, 20, 28], volumeSmaPeriods: [20] },
  atrVolRun
);

// --- EMA VOLUME ---
const emaVolRun = (ctx: StrategyContext) => {
  const p = ctx.params;
  const ep = num(p, "emaPeriod", 21);
  const vs = num(p, "volSmaPeriod", 20);
  const vm = num(p, "volMult", num(p, "minVolumeMult", 2) || 2);
  const ema = ctx.cache.ema.get(ep)!;
  const vSma = ctx.cache.volumeSma.get(vs)!;
  const atr = ctx.cache.atr.get(num(p, "atrPeriod", 14))!;
  const { risk, lev } = ctxRisk(ctx);
  const state = createSim(ctx.initialBalance, p);
  for (let i = 2; i < ctx.candles.length; i++) {
    runBar(state, ctx.candles, i, ctx.entryMode, risk, lev, ctx.feeRate);
    if (state.position) continue;
    const c = ctx.candles[i]!;
    const e = ema[i]!,
      v = ctx.cache.volumes[i]!,
      vsma = vSma[i]!,
      a = atr[i]!;
    if (!fin(e) || !fin(vsma) || !fin(a) || v < vsma * vm) {
      if (v < vsma * vm) state.diagnostics.skippedByFilter += 1;
      continue;
    }
    if (c.close > e && c.close > ctx.candles[i - 1]!.close)
      signal(state, ctx.candles, i, "long", c.close - a * num(p, "atrMult", 1.5), ctx.entryMode, risk, lev, ctx.feeRate);
    else if (c.close < e && c.close < ctx.candles[i - 1]!.close)
      signal(state, ctx.candles, i, "short", c.close + a * num(p, "atrMult", 1.5), ctx.entryMode, risk, lev, ctx.feeRate);
  }
  finalize(state, ctx.candles, ctx.feeRate);
  return buildResult("EMA_VOLUME_SPIKE", p, state, ctx);
};

export const emaVolumeSpike = mk(
  "EMA_VOLUME_SPIKE",
  {
    quick: { emaPeriod: [12, 21], volMult: [1, 1.2, 1.5] },
    fast: { emaPeriod: [8, 12, 21], volMult: [0.8, 1, 1.2, 1.5, 2] },
    full: { emaPeriod: [8, 12, 21, 34], volMult: [0.6, 0.8, 1, 1.2, 1.5, 2] },
  },
  {
    quick: { emaPeriod: [8, 12, 21], volSmaPeriod: [10, 20], volMult: [0.8, 1, 1.2, 1.5] },
    fast: { emaPeriod: [8, 12, 21, 34], volSmaPeriod: [10, 20], volMult: [0.6, 0.8, 1, 1.2, 1.5, 2] },
    full: { emaPeriod: [8, 12, 21, 34, 50], volSmaPeriod: [10, 20, 30], volMult: [0.5, 0.8, 1, 1.2, 1.5, 2] },
  },
  { emaPeriods: [8, 12, 21, 34, 50], atrPeriods: [10, 14, 20], volumeSmaPeriods: [10, 20, 30] },
  emaVolRun
);

// --- VWAP ---
const vwapRun = (ctx: StrategyContext) => {
  const p = ctx.params;
  const dev = num(p, "deviationPct", 0.15);
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
    const band = (dev / 100) * vw;
    if (state.position) {
      if (state.position.direction === "long" && c.close >= vw) closePos(state, c, i, c.close, "exit", ctx.feeRate, "exitsBySignal");
      else if (state.position.direction === "short" && c.close <= vw) closePos(state, c, i, c.close, "exit", ctx.feeRate, "exitsBySignal");
      continue;
    }
    if (c.low <= vw - band && c.close > vw - band && c.close > pvw)
      signal(state, ctx.candles, i, "long", c.close - a * num(p, "atrMult", 1.5), ctx.entryMode, risk, lev, ctx.feeRate);
    else if (c.high >= vw + band && c.close < vw + band && c.close < pvw)
      signal(state, ctx.candles, i, "short", c.close + a * num(p, "atrMult", 1.5), ctx.entryMode, risk, lev, ctx.feeRate);
  }
  finalize(state, ctx.candles, ctx.feeRate);
  return buildResult("VWAP_BOUNCE", p, state, ctx);
};

export const vwapBounce = mk(
  "VWAP_BOUNCE",
  { quick: { deviationPct: [0.15] }, fast: { deviationPct: [0.1, 0.15, 0.25] }, full: { deviationPct: [0.05, 0.1, 0.15, 0.2, 0.3] } },
  { quick: { deviationPct: [0.1, 0.15, 0.25] }, fast: { deviationPct: [0.05, 0.1, 0.15, 0.2, 0.3] }, full: { deviationPct: [0.05, 0.1, 0.15, 0.2, 0.3] } },
  { vwap: true, atrPeriods: [10, 14, 20] },
  vwapRun
);

// --- RANGE RETEST ---
const rangeRun = (ctx: StrategyContext) => {
  const p = ctx.params;
  const rp = num(p, "rangePeriod", 30);
  const tol = num(p, "retestTolerancePct", 0.1);
  const dh = ctx.cache.donchianHigh.get(rp)!;
  const dl = ctx.cache.donchianLow.get(rp)!;
  const atr = ctx.cache.atr.get(num(p, "atrPeriod", 14))!;
  const { risk, lev } = ctxRisk(ctx);
  const state = createSim(ctx.initialBalance, p);
  let br: "none" | "bull" | "bear" = "none";
  let lvl = 0;
  for (let i = 2; i < ctx.candles.length; i++) {
    runBar(state, ctx.candles, i, ctx.entryMode, risk, lev, ctx.feeRate);
    if (state.position) continue;
    const c = ctx.candles[i]!;
    const ph = dh[i - 1]!,
      pl = dl[i - 1]!,
      a = atr[i]!;
    if (!fin(ph) || !fin(pl) || !fin(a)) continue;
    const t = tol / 100;
    if (br === "none") {
      if (c.close > ph) {
        br = "bull";
        lvl = ph;
      } else if (c.close < pl) {
        br = "bear";
        lvl = pl;
      }
      continue;
    }
    if (br === "bull") {
      if (c.low <= lvl * (1 + t) && c.close > lvl) {
        signal(state, ctx.candles, i, "long", c.close - a * num(p, "atrMult", 1.5), ctx.entryMode, risk, lev, ctx.feeRate);
        br = "none";
      } else if (c.close < pl) br = "none";
    } else if (br === "bear") {
      if (c.high >= lvl * (1 - t) && c.close < lvl) {
        signal(state, ctx.candles, i, "short", c.close + a * num(p, "atrMult", 1.5), ctx.entryMode, risk, lev, ctx.feeRate);
        br = "none";
      } else if (c.close > ph) br = "none";
    }
  }
  finalize(state, ctx.candles, ctx.feeRate);
  return buildResult("RANGE_BREAKOUT_RETEST", p, state, ctx);
};

export const rangeBreakoutRetest = mk(
  "RANGE_BREAKOUT_RETEST",
  { quick: { rangePeriod: [30] }, fast: { rangePeriod: [20, 30, 40] }, full: { rangePeriod: [15, 20, 30, 40, 60] } },
  { quick: { rangePeriod: [20, 30, 40], retestTolerancePct: [0.05, 0.1, 0.2] }, fast: { rangePeriod: [15, 20, 30, 40, 60], retestTolerancePct: [0.05, 0.1, 0.15, 0.2] }, full: { rangePeriod: [15, 20, 30, 40, 60], retestTolerancePct: [0.05, 0.1, 0.15, 0.2] } },
  { donchianPeriods: [15, 20, 30, 40, 60], atrPeriods: [10, 14, 20] },
  rangeRun
);
