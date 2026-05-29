import type { DiscoveryMode, ParamGrid } from "../types.js";
import { gridForMode } from "../grids.js";

export const COMMON_DEFAULTS: Record<string, number | string> = {
  atrPeriod: 14,
  atrMult: 1.2,
  trailStart: 0.3,
  trailGap: 0.4,
  takeProfitPct: 0,
  breakEvenPct: 0,
  maxHoldCandles: 0,
  exitOnOppositeSignal: 1,
  cooldownCandles: 0,
  minAtrFilter: 0,
  minEmaDistancePct: 0,
  minMoveVsFeeMult: 0,
  minVolumeMult: 1.2,
  maxTradesPerDay: 999,
};

/** Risk phase — looser stops/filters to allow more trades and volume. */
const RISK_Q: ParamGrid = {
  atrMult: [0.8, 1, 1.2, 1.5],
  riskPct: [0.5, 1, 1.5, 2],
  minAtrFilter: [0],
  cooldownCandles: [0, 1, 2],
  minEmaDistancePct: [0],
  minMoveVsFeeMult: [0, 1],
};
const RISK_F: ParamGrid = {
  atrMult: [0.6, 0.8, 1, 1.2, 1.5, 2],
  riskPct: [0.5, 1, 1.5, 2, 2.5],
  leverage: [3, 5, 8],
  minAtrFilter: [0],
  cooldownCandles: [0, 1, 2, 3],
  minEmaDistancePct: [0],
  minMoveVsFeeMult: [0, 1, 2],
};
const RISK_FULL: ParamGrid = {
  ...RISK_F,
  atrMult: [0.5, 0.6, 0.8, 1, 1.2, 1.5, 2, 2.5],
  maxTradesPerDay: [40, 60, 999],
};

/** Exit phase — wider trails, lower TP thresholds to keep positions active. */
const EXIT_Q: ParamGrid = {
  trailStart: [0.1, 0.2, 0.3, 0.5],
  trailGap: [0.25, 0.35, 0.5, 0.7],
  takeProfitPct: [0, 0.3, 0.5, 0.8],
  maxHoldCandles: [0, 90],
};
const EXIT_F: ParamGrid = {
  trailStart: [0.1, 0.15, 0.2, 0.3, 0.5],
  trailGap: [0.2, 0.3, 0.4, 0.5, 0.7, 0.9],
  takeProfitPct: [0, 0.2, 0.3, 0.5, 0.8, 1],
  breakEvenPct: [0, 0.2, 0.3],
  maxHoldCandles: [0, 60, 120, 180],
  exitOnOppositeSignal: [0, 1],
};
const EXIT_FULL = EXIT_F;

/** Efficiency — shorter cooldowns, more trades/day, weaker fee gates. */
const EFF_Q: ParamGrid = {
  cooldownCandles: [0, 1, 2],
  maxTradesPerDay: [40, 60, 999],
  minMoveVsFeeMult: [0, 1],
  minVolumeMult: [0, 1, 1.2],
};
const EFF_F: ParamGrid = {
  cooldownCandles: [0, 1, 2, 3],
  maxTradesPerDay: [30, 40, 60, 80, 999],
  minMoveVsFeeMult: [0, 1, 2],
  minVolumeMult: [0, 1, 1.2, 1.5],
};
const EFF_FULL: ParamGrid = {
  ...EFF_F,
  maxTradesPerDay: [25, 40, 60, 80, 100, 999],
  minVolumeMult: [0, 0.8, 1, 1.2, 1.5],
};

export const commonPhase2 = (mode: DiscoveryMode) => gridForMode(RISK_Q, RISK_F, RISK_FULL, mode);
export const commonPhase3 = (mode: DiscoveryMode) => gridForMode(EXIT_Q, EXIT_F, EXIT_FULL, mode);
export const commonPhase4 = (mode: DiscoveryMode) => gridForMode(EFF_Q, EFF_F, EFF_FULL, mode);
