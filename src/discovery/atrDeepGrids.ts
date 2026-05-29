import type { ParamGrid } from "./types.js";

/** Phase 1 — entry */
export const ATR_DEEP_PHASE1: ParamGrid = {
  lookback: [8, 10, 15, 20, 25, 30],
  breakoutMult: [0.4, 0.6, 0.8, 1.0, 1.2, 1.5],
  atrPeriod: [10, 14, 20],
};

/** Phase 2 — risk & entry filters */
export const ATR_DEEP_PHASE2: ParamGrid = {
  stopMult: [0.8, 1.0, 1.2, 1.5, 2.0],
  riskPct: [0.5, 1.0, 1.5, 2.0],
  leverage: [3, 5, 8],
  minAtrPct: [0, 0.08, 0.15, 0.25],
  minMoveVsFeeMult: [0, 1, 2, 4],
};

/** Phase 3 — exits (aliases normalized in atrBreakoutDeepSearch) */
export const ATR_DEEP_PHASE3: ParamGrid = {
  takeProfitPct: [0, 0.4, 0.8, 1.2, 2.0],
  trailingStartPct: [0, 0.1, 0.2, 0.35, 0.5],
  trailingGapPct: [0.25, 0.35, 0.5, 0.7, 0.9],
  breakEvenActivationPct: [0, 0.25, 0.5],
  maxHoldingCandles: [0, 90, 180, 360],
};

/** Phase 4 — trade frequency / volume gate */
export const ATR_DEEP_PHASE4: ParamGrid = {
  cooldownCandles: [0, 1, 2, 4],
  maxTradesPerDay: [15, 25, 40, 60, 999],
  minVolumeMult: [0, 1.0, 1.5, 2.0],
};

export const ATR_DEEP_PHASES = [
  { name: "ENTRY" as const, grid: ATR_DEEP_PHASE1 },
  { name: "RISK" as const, grid: ATR_DEEP_PHASE2 },
  { name: "EXIT" as const, grid: ATR_DEEP_PHASE3 },
  { name: "EFFICIENCY" as const, grid: ATR_DEEP_PHASE4 },
];
