import { num } from "../grids.js";
import type { MarketRegime } from "./types.js";

export const isRegimeTradingEnabled = (
  regime: MarketRegime,
  params: Record<string, number | string>
): boolean => {
  switch (regime) {
    case "TREND_UP":
    case "TREND_DOWN":
      return num(params, "tradeTrend", 1) > 0;
    case "RANGE":
      return num(params, "tradeRange", 1) > 0;
    case "HIGH_VOLATILITY":
      return num(params, "tradeHighVol", 0) > 0;
    case "LOW_VOLATILITY_COMPRESSION":
      return num(params, "tradeCompression", 0) > 0;
    case "TRANSITION":
      return num(params, "tradeTransition", 0) > 0;
    default:
      return false;
  }
};
