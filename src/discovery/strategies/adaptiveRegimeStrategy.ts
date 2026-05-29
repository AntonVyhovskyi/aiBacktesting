import type { PhasedStrategyDefinition, StrategyContext } from "../types.js";
import { bbCacheKey, fin } from "../indicatorCache.js";
import { num } from "../grids.js";
import { buildResult } from "../resultBuilder.js";
import { closePos, createSim, finalize, runBar, signal, type SimState } from "../simulator.js";
import { passMinMoveVsFee } from "./strategyCommon.js";
import { detectMarketRegime, regimeRiskMultiplier } from "../regime/marketRegimeDetector.js";
import { isRegimeTradingEnabled } from "../regime/regimeConfig.js";
import type { MarketRegime } from "../regime/types.js";
import { COMMON_DEFAULTS } from "./phasedGrids.js";

const NAME = "ADAPTIVE_REGIME";

const DEFAULTS: Record<string, number | string> = {
  ...COMMON_DEFAULTS,
  emaFast: 12,
  emaSlow: 34,
  adxPeriod: 14,
  rsiPeriod: 14,
  bbPeriod: 20,
  bbStdDev: 2,
  adxTrendMin: 25,
  adxRangeMax: 20,
  atrHighPct: 1.2,
  atrLowPct: 0.35,
  bbCompressPct: 1.8,
  emaSlopeMinPct: 0.02,
  minRegimeConfidence: 0.5,
  riskPct: 0.5,
  leverage: 3,
  riskMultTrend: 1,
  riskMultRange: 0.7,
  riskMultHighVol: 0,
  riskMultCompression: 0,
  riskMultTransition: 0,
  tradeTrend: 1,
  tradeRange: 1,
  tradeHighVol: 0,
  tradeCompression: 0,
  tradeTransition: 0,
  rsiOversold: 30,
  rsiOverbought: 70,
  pullbackPct: 0.2,
  maxTrendExtensionPct: 1.5,
  rangeVwapDistPct: 0.15,
  rangeTpPct: 0.35,
  trendTrailStart: 0.2,
  trendTrailGap: 0.35,
  trendBreakEvenPct: 0.2,
  maxPortfolioDrawdownPct: 5,
  maxDailyLossPct: 2,
  maxTradesPerDay: 20,
  atrMult: 1,
};

const manageRegimeExits = (
  state: SimState,
  ctx: StrategyContext,
  i: number,
  feeRate: number
): void => {
  const pos = state.position;
  if (!pos?.entryRegime) return;
  const c = ctx.candles[i]!;
  const p = ctx.params;
  const regime = pos.entryRegime as MarketRegime;
  const atr = ctx.cache.atr.get(num(p, "atrPeriod", 14))?.[i];
  if (!fin(atr)) return;

  if (regime === "TREND_UP" || regime === "TREND_DOWN") {
    const emaF = ctx.cache.ema.get(num(p, "emaFast", 12))?.[i];
    if (!fin(emaF)) return;
    if (regime === "TREND_UP" && c.close < emaF!) {
      closePos(state, c, i, c.close, "trend_invalidation", feeRate, "exitsBySignal");
      return;
    }
    if (regime === "TREND_DOWN" && c.close > emaF!) {
      closePos(state, c, i, c.close, "trend_invalidation", feeRate, "exitsBySignal");
      return;
    }
    state.activeParams.trailStart = num(p, "trendTrailStart", 0.2);
    state.activeParams.trailGap = num(p, "trendTrailGap", 0.35);
    state.activeParams.breakEvenPct = num(p, "trendBreakEvenPct", 0.2);
  }

  if (regime === "RANGE") {
    const vwap = ctx.cache.vwap[i];
    const tpPct = num(p, "rangeTpPct", 0.35) / 100;
    if (fin(vwap)) {
      if (pos.direction === "long" && c.close >= vwap! * (1 - tpPct * 0.25)) {
        closePos(state, c, i, c.close, "range_tp_vwap", feeRate, "exitsByTakeProfit");
        return;
      }
      if (pos.direction === "short" && c.close <= vwap! * (1 + tpPct * 0.25)) {
        closePos(state, c, i, c.close, "range_tp_vwap", feeRate, "exitsByTakeProfit");
        return;
      }
    }
    const bb = ctx.cache.bb.get(bbCacheKey(num(p, "bbPeriod", 20), num(p, "bbStdDev", 2)))!;
    const mid = bb.middle[i];
    if (fin(mid)) {
      if (pos.direction === "long" && c.close >= mid! * (1 + tpPct)) {
        closePos(state, c, i, c.close, "range_tp_mid", feeRate, "exitsByTakeProfit");
      } else if (pos.direction === "short" && c.close <= mid! * (1 - tpPct)) {
        closePos(state, c, i, c.close, "range_tp_mid", feeRate, "exitsByTakeProfit");
      }
    }
  }

  if (regime === "LOW_VOLATILITY_COMPRESSION") {
    const entry = pos.entryPrice;
    const failPct = 0.12 / 100;
    if (pos.direction === "long" && c.close < entry * (1 - failPct)) {
      closePos(state, c, i, c.close, "compression_fail", feeRate, "exitsByStopLoss");
    } else if (pos.direction === "short" && c.close > entry * (1 + failPct)) {
      closePos(state, c, i, c.close, "compression_fail", feeRate, "exitsByStopLoss");
    }
  }
};

const tryRegimeEntry = (
  ctx: StrategyContext,
  state: SimState,
  i: number,
  regime: MarketRegime,
  snap: NonNullable<ReturnType<typeof detectMarketRegime>>,
  baseRisk: number,
  lev: number
): void => {
  if (!isRegimeTradingEnabled(regime, ctx.params)) return;

  const p = ctx.params;
  const c = ctx.candles[i]!;
  const atr = ctx.cache.atr.get(num(p, "atrPeriod", 14))![i]!;
  const atrM = num(p, "atrMult", 1);
  const rsi = snap.diagnostics.rsi;
  const close = c.close;
  const emaF = snap.diagnostics.emaFast;
  const emaS = snap.diagnostics.emaSlow;
  const vwap = ctx.cache.vwap[i];
  const bb = ctx.cache.bb.get(bbCacheKey(num(p, "bbPeriod", 20), num(p, "bbStdDev", 2)))!;
  const bbU = bb.upper[i]!;
  const bbL = bb.lower[i]!;

  const risk = baseRisk * regimeRiskMultiplier(regime, p);
  if (risk <= 0.05) return;

  let dir: "long" | "short" | null = null;
  let stop = 0;

  if (regime === "HIGH_VOLATILITY") return;

  if (regime === "TREND_UP") {
    const pull = num(p, "pullbackPct", 0.2) / 100;
    const ext = num(p, "maxTrendExtensionPct", 1.5) / 100;
    if (emaS > 0 && (close - emaS) / emaS > ext) return;
    const adxNow = snap.diagnostics.adx;
    const adxPrev = ctx.cache.adx.get(num(p, "adxPeriod", 14))?.[i - 5];
    if (fin(adxPrev) && adxNow < adxPrev!) return;
    if (close <= emaF * (1 + pull) && close >= emaF * (1 - pull * 2) && rsi > 42 && rsi < 58) {
      dir = "long";
      stop = close - atr * atrM;
    }
  } else if (regime === "TREND_DOWN") {
    const pull = num(p, "pullbackPct", 0.2) / 100;
    const ext = num(p, "maxTrendExtensionPct", 1.5) / 100;
    if (emaS > 0 && (emaS - close) / emaS > ext) return;
    const adxNow = snap.diagnostics.adx;
    const adxPrev = ctx.cache.adx.get(num(p, "adxPeriod", 14))?.[i - 5];
    if (fin(adxPrev) && adxNow < adxPrev!) return;
    if (close >= emaF * (1 - pull) && close <= emaF * (1 + pull * 2) && rsi < 58 && rsi > 42) {
      dir = "short";
      stop = close + atr * atrM;
    }
  } else if (regime === "RANGE") {
    if (!fin(vwap)) return;
    const vwapDist = num(p, "rangeVwapDistPct", 0.15) / 100;
    const os = num(p, "rsiOversold", 30);
    const ob = num(p, "rsiOverbought", 70);
    if (rsi <= os && close <= bbL * 1.001 && close < vwap! * (1 - vwapDist)) {
      dir = "long";
      stop = close - atr * atrM;
    } else if (rsi >= ob && close >= bbU * 0.999 && close > vwap! * (1 + vwapDist)) {
      dir = "short";
      stop = close + atr * atrM;
    }
  } else if (regime === "LOW_VOLATILITY_COMPRESSION") {
    return;
  }

  if (!dir) return;
  if (!passMinMoveVsFee(close, stop, p, ctx.feeRate)) return;

  signal(state, ctx.candles, i, dir, stop, ctx.entryMode, risk, lev, ctx.feeRate, {
    entryRegime: regime,
  });
};

const run = (ctx: StrategyContext) => {
  const p = { ...DEFAULTS, ...ctx.params };
  const state = createSim(ctx.initialBalance, p);
  const baseRisk = num(p, "riskPct", ctx.riskPct);
  const lev = num(p, "leverage", ctx.leverage);
  const maxDd = num(p, "maxPortfolioDrawdownPct", 5);
  const maxDailyLoss = num(p, "maxDailyLossPct", 2);

  let peak = ctx.initialBalance;
  let haltUntil = -1;
  let dayStartBal = ctx.initialBalance;
  let dayKey = "";

  for (let i = 2; i < ctx.candles.length; i++) {
    runBar(state, ctx.candles, i, ctx.entryMode, baseRisk, lev, ctx.feeRate);
    if (state.position) manageRegimeExits(state, ctx, i, ctx.feeRate);

    if (state.balance > peak) peak = state.balance;
    const ddPct = peak > 0 ? ((peak - state.balance) / peak) * 100 : 0;
    if (ddPct >= maxDd) haltUntil = ctx.candles.length;

    const dk = new Date(ctx.candles[i]!.openTime).toISOString().slice(0, 10);
    if (dk !== dayKey) {
      dayKey = dk;
      dayStartBal = state.balance;
    }
    const dayLossPct = dayStartBal > 0 ? ((dayStartBal - state.balance) / dayStartBal) * 100 : 0;
    if (dayLossPct >= maxDailyLoss) haltUntil = Math.max(haltUntil, i + 48);

    if (state.position || i < haltUntil || i < state.cooldownUntil) continue;

    const snap = detectMarketRegime(ctx.cache, i, p);
    if (!snap || snap.confidence < num(p, "minRegimeConfidence", 0.5)) continue;

    tryRegimeEntry(ctx, state, i, snap.regime, snap, baseRisk, lev);
  }

  finalize(state, ctx.candles, ctx.feeRate);
  return buildResult(NAME, p, state, ctx);
};

const indicatorReq = {
  emaPeriods: [8, 10, 12, 14, 21, 26, 34, 50],
  atrPeriods: [10, 14, 20],
  rsiPeriods: [7, 14, 21],
  adxPeriods: [10, 14, 20],
  bbPeriods: [20],
  bbConfigs: [{ period: 20, stdDev: 2 }, { period: 20, stdDev: 1.8 }],
  volumeSmaPeriods: [20],
  vwap: true,
};

const tiny = { quick: {}, fast: {}, full: {} };

export const adaptiveRegimeStrategy: PhasedStrategyDefinition = {
  strategyName: NAME,
  defaults: DEFAULTS,
  screenGrids: {
    quick: { riskPct: [0.5], adxTrendMin: [25], tradeCompression: [0] },
    fast: { riskPct: [0.5, 0.75], adxTrendMin: [22, 25, 28], tradeCompression: [0] },
    full: { riskPct: [0.25, 0.5, 0.75], adxTrendMin: [20, 25, 28], tradeCompression: [0] },
  },
  phase1EntryGrids: tiny,
  indicatorReq,
  run,
};
