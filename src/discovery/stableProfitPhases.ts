import type { DiscoveryMode, ParamGrid } from "./types.js";
import { gridForMode } from "./grids.js";
import { commonPhase2, commonPhase3, commonPhase4 } from "./strategies/phasedGrids.js";

/** Minimal Stage-1 screen — one representative combo per family. */
export const stableProfitTurboScreenGrid = (): ParamGrid => ({
  riskPct: [0.5],
  leverage: [3],
  maxTradesPerDay: [20],
});

/** Conservative screening (non-turbo). */
const SCREEN_Q: ParamGrid = {
  riskPct: [0.25, 0.5, 1],
  leverage: [2, 3, 5],
  maxTradesPerDay: [10, 20, 30],
};

const SCREEN_F: ParamGrid = {
  riskPct: [0.25, 0.5, 0.75, 1, 1.5],
  leverage: [2, 3, 5],
  maxTradesPerDay: [8, 15, 25, 40],
};

const PHASE2_TURBO: ParamGrid = {
  atrMult: [0.8, 1, 1.2, 1.5],
  riskPct: [0.5, 0.75, 1, 1.5],
  leverage: [2, 3, 5],
  cooldownCandles: [0, 1, 2, 3],
  minMoveVsFeeMult: [0, 1, 2],
  minAtrPct: [0, 0.05, 0.1],
};

const PHASE3_TURBO: ParamGrid = {
  trailStart: [0.15, 0.25, 0.35, 0.5],
  trailGap: [0.25, 0.35, 0.45],
  takeProfitPct: [0, 0.3, 0.5, 0.8],
  breakEvenPct: [0, 0.2, 0.3, 0.5],
  maxHoldCandles: [0, 90],
};

const PHASE4_TURBO: ParamGrid = {
  cooldownCandles: [0, 2, 4],
  maxTradesPerDay: [10, 20, 35],
  minMoveVsFeeMult: [1, 2, 3],
  minVolumeMult: [0, 1, 1.2],
};

const MONTHLY_TURBO: ParamGrid = {
  riskPct: [0.5, 0.75, 1],
  maxTradesPerDay: [8, 15, 25],
  cooldownCandles: [1, 3, 5],
  minMoveVsFeeMult: [2, 3],
  takeProfitPct: [0.3, 0.5, 0.8, 1],
  trailStart: [0.2, 0.3, 0.45],
  trailGap: [0.25, 0.35, 0.45],
  breakEvenPct: [0.15, 0.25, 0.4],
};

/** Phase 5 — monthly consistency / lower churn. */
const MONTHLY_Q: ParamGrid = {
  riskPct: [0.25, 0.5, 0.75],
  maxTradesPerDay: [8, 15, 25],
  cooldownCandles: [1, 2, 3, 5],
  minMoveVsFeeMult: [1, 2, 3],
  takeProfitPct: [0.3, 0.5, 0.8, 1],
  trailStart: [0.2, 0.3, 0.5],
  breakEvenPct: [0.2, 0.3, 0.5],
};

const MONTHLY_F: ParamGrid = {
  riskPct: [0.25, 0.5, 0.75, 1],
  maxTradesPerDay: [5, 10, 15, 25, 40],
  cooldownCandles: [1, 2, 3, 5, 8],
  minMoveVsFeeMult: [1, 2, 3, 4],
  minVolumeMult: [0, 1, 1.2],
  takeProfitPct: [0.2, 0.3, 0.5, 0.8, 1, 1.5],
  trailStart: [0.15, 0.2, 0.3, 0.5],
  trailGap: [0.2, 0.3, 0.4, 0.5],
  breakEvenPct: [0.15, 0.2, 0.3, 0.5],
};

export const stableProfitScreenGrid = (mode: DiscoveryMode): ParamGrid =>
  gridForMode(SCREEN_Q, SCREEN_F, SCREEN_F, mode);

export const stableProfitPhase2 = (mode: DiscoveryMode, turbo = false): ParamGrid =>
  turbo ? PHASE2_TURBO : commonPhase2(mode);

export const stableProfitPhase3 = (mode: DiscoveryMode, turbo = false): ParamGrid =>
  turbo ? PHASE3_TURBO : commonPhase3(mode);

export const stableProfitPhase4 = (mode: DiscoveryMode, turbo = false): ParamGrid =>
  turbo ? PHASE4_TURBO : commonPhase4(mode);

export const stableProfitPhase5Monthly = (mode: DiscoveryMode, turbo = false): ParamGrid =>
  turbo ? MONTHLY_TURBO : gridForMode(MONTHLY_Q, MONTHLY_F, MONTHLY_F, mode);

export type StableProfitPhaseName =
  | "ENTRY"
  | "RISK"
  | "EXIT"
  | "EFFICIENCY"
  | "MONTHLY_CONSISTENCY";

export const STABLE_PROFIT_PHASE_LABEL: Record<StableProfitPhaseName, string> = {
  ENTRY: "PHASE 1 ENTRY",
  RISK: "PHASE 2 RISK",
  EXIT: "PHASE 3 EXIT",
  EFFICIENCY: "PHASE 4 FEE EFFICIENCY",
  MONTHLY_CONSISTENCY: "PHASE 5 MONTHLY CONSISTENCY",
};
