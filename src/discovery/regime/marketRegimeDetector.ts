import type { DiscoveryIndicatorCache } from "../indicatorCache.js";
import { fin, bbCacheKey } from "../indicatorCache.js";
import { num } from "../grids.js";
import type { MarketRegime, RegimeSnapshot } from "./types.js";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Regime at bar `i` uses only data available after candle `i` has closed
 * (indicators at index `i`, decisions emitted for next-bar entry).
 */
export const detectMarketRegime = (
  cache: DiscoveryIndicatorCache,
  i: number,
  params: Record<string, number | string>
): RegimeSnapshot | null => {
  const emaFastP = num(params, "emaFast", 12);
  const emaSlowP = num(params, "emaSlow", 34);
  const adxP = num(params, "adxPeriod", 14);
  const atrP = num(params, "atrPeriod", 14);
  const rsiP = num(params, "rsiPeriod", 14);
  const bbP = num(params, "bbPeriod", 20);
  const bbStd = num(params, "bbStdDev", 2);

  const emaF = cache.ema.get(emaFastP)?.[i];
  const emaS = cache.ema.get(emaSlowP)?.[i];
  const adx = cache.adx.get(adxP)?.[i];
  const atr = cache.atr.get(atrP)?.[i];
  const rsi = cache.rsi.get(rsiP)?.[i];
  const close = cache.closes[i];
  const emaFPrev = cache.ema.get(emaFastP)?.[i - 1];
  const vol = cache.volumes[i];
  const volSma = cache.volumeSma.get(20)?.[i];

  const bb = cache.bb.get(bbCacheKey(bbP, bbStd));
  const bbU = bb?.upper[i];
  const bbL = bb?.lower[i];
  const bbM = bb?.middle[i];

  if (
    !fin(emaF) ||
    !fin(emaS) ||
    !fin(adx) ||
    !fin(atr) ||
    !fin(rsi) ||
    close === undefined ||
    !fin(bbU) ||
    !fin(bbL) ||
    !fin(bbM) ||
    bbM === 0
  ) {
    return null;
  }

  const atrPct = (atr! / close) * 100;
  const bbWidthPct = ((bbU! - bbL!) / bbM!) * 100;
  const emaSlopePct = emaFPrev && emaFPrev > 0 ? ((emaF! - emaFPrev) / emaFPrev) * 100 : 0;
  const volumeRatio = fin(volSma) && volSma! > 0 && vol !== undefined ? vol / volSma! : 1;

  const adxTrendMin = num(params, "adxTrendMin", 25);
  const adxRangeMax = num(params, "adxRangeMax", 20);
  const atrHighPct = num(params, "atrHighPct", 1.2);
  const atrLowPct = num(params, "atrLowPct", 0.35);
  const bbCompressPct = num(params, "bbCompressPct", 1.8);
  const slopeMinPct = num(params, "emaSlopeMinPct", 0.02);

  const trendStrength = clamp01(
    Math.max(0, (adx! - adxTrendMin) / 35) * 0.45 +
      Math.min(Math.abs(emaSlopePct) / Math.max(slopeMinPct * 5, 0.001), 1) * 0.25 +
      Math.min(atrPct / Math.max(atrHighPct, 0.001), 1) * 0.15 +
      Math.min(volumeRatio / 2, 1) * 0.15
  );

  const diagnostics = {
    adx: adx!,
    atrPct,
    bbWidthPct,
    emaFast: emaF!,
    emaSlow: emaS!,
    emaSlopePct,
    trendStrength,
    rsi: rsi!,
    volumeRatio,
    close,
  };

  let regime: MarketRegime = "TRANSITION";
  let confidence = 0.35;

  if (atrPct >= atrHighPct) {
    regime = "HIGH_VOLATILITY";
    confidence = clamp01(0.55 + (atrPct - atrHighPct) / atrHighPct);
  } else if (bbWidthPct <= bbCompressPct && atrPct <= atrLowPct) {
    regime = "LOW_VOLATILITY_COMPRESSION";
    confidence = clamp01(0.5 + (bbCompressPct - bbWidthPct) / bbCompressPct);
  } else if (adx! >= adxTrendMin) {
    if (emaF! > emaS! && emaSlopePct >= slopeMinPct) {
      regime = "TREND_UP";
      confidence = clamp01(0.45 + (adx! - adxTrendMin) / 40 + Math.min(emaSlopePct * 5, 0.25));
    } else if (emaF! < emaS! && emaSlopePct <= -slopeMinPct) {
      regime = "TREND_DOWN";
      confidence = clamp01(0.45 + (adx! - adxTrendMin) / 40 + Math.min(Math.abs(emaSlopePct) * 5, 0.25));
    } else {
      regime = "TRANSITION";
      confidence = 0.4;
    }
  } else if (adx! <= adxRangeMax) {
    regime = "RANGE";
    confidence = clamp01(0.5 + (adxRangeMax - adx!) / adxRangeMax);
  } else {
    regime = "TRANSITION";
    confidence = 0.35;
  }

  const minConf = num(params, "minRegimeConfidence", 0.45);
  if (confidence < minConf && regime !== "HIGH_VOLATILITY") {
    regime = "TRANSITION";
    confidence = confidence * 0.8;
  }

  return { regime, confidence, diagnostics };
};

export const regimeRiskMultiplier = (
  regime: MarketRegime,
  params: Record<string, number | string>,
  diagnostics?: { trendStrength?: number }
): number => {
  switch (regime) {
    case "TREND_UP":
    case "TREND_DOWN":
      return Math.min(
        num(params, "riskMultTrendMax", 1.8),
        num(params, "riskMultTrend", 1) *
          (1 + num(params, "trendStrengthRiskBoost", 0.8) * (diagnostics?.trendStrength ?? 0))
      );
    case "RANGE":
      return num(params, "riskMultRange", 0.75);
    case "HIGH_VOLATILITY":
      return num(params, "riskMultHighVol", 0.35);
    case "LOW_VOLATILITY_COMPRESSION":
      return num(params, "riskMultCompression", 0.6);
    case "TRANSITION":
    default:
      return num(params, "riskMultTransition", 0.25);
  }
};
