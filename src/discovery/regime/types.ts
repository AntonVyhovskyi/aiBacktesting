export type MarketRegime =
  | "TREND_UP"
  | "TREND_DOWN"
  | "RANGE"
  | "HIGH_VOLATILITY"
  | "LOW_VOLATILITY_COMPRESSION"
  | "TRANSITION";

export const ALL_REGIMES: MarketRegime[] = [
  "TREND_UP",
  "TREND_DOWN",
  "RANGE",
  "HIGH_VOLATILITY",
  "LOW_VOLATILITY_COMPRESSION",
  "TRANSITION",
];

export type RegimeDiagnostics = {
  adx: number;
  atrPct: number;
  bbWidthPct: number;
  emaFast: number;
  emaSlow: number;
  emaSlopePct: number;
  trendStrength: number;
  rsi: number;
  volumeRatio: number;
  close: number;
};

export type RegimeSnapshot = {
  regime: MarketRegime;
  confidence: number;
  diagnostics: RegimeDiagnostics;
};
