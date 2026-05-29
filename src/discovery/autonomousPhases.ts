import type { DiscoveryMode, ParamGrid } from "./types.js";
import { gridForMode } from "./grids.js";
import { commonPhase2, commonPhase3, commonPhase4 } from "./strategies/phasedGrids.js";

/** Stage-1 cheap screening grids (small). */
const SCREEN_Q: ParamGrid = {
  riskPct: [0.5, 1, 1.5],
  leverage: [3, 5],
  maxTradesPerDay: [30, 60, 999],
};

/** Phase 5 — walk-forward / weekly stability tuning. */
const WALK_Q: ParamGrid = {
  cooldownCandles: [0, 1, 2, 3],
  maxTradesPerDay: [20, 30, 40, 60],
  minMoveVsFeeMult: [0, 1, 2, 3],
  minVolumeMult: [0, 1, 1.2],
  minAtrPct: [0, 0.05, 0.1],
};

const WALK_F: ParamGrid = {
  cooldownCandles: [0, 1, 2, 3, 5],
  maxTradesPerDay: [15, 25, 35, 50, 70, 999],
  minMoveVsFeeMult: [0, 1, 2, 3, 4],
  minVolumeMult: [0, 0.8, 1, 1.2, 1.5],
  minAtrPct: [0, 0.05, 0.1, 0.15],
  minEmaDistancePct: [0, 0.1, 0.2],
};

export const autonomousScreenGrid = (_mode: DiscoveryMode): ParamGrid => SCREEN_Q;

export const autonomousPhase2 = (mode: DiscoveryMode) => commonPhase2(mode);
export const autonomousPhase3 = (mode: DiscoveryMode) => commonPhase3(mode);
export const autonomousPhase4 = (mode: DiscoveryMode) => commonPhase4(mode);
export const autonomousPhase5 = (mode: DiscoveryMode) =>
  gridForMode(WALK_Q, WALK_F, WALK_F, mode);

export type AutonomousPhaseName =
  | "ENTRY"
  | "RISK"
  | "EXIT"
  | "EFFICIENCY"
  | "WALK_FORWARD";

export const AUTONOMOUS_PHASE_LABEL: Record<AutonomousPhaseName, string> = {
  ENTRY: "PHASE 1 ENTRY",
  RISK: "PHASE 2 RISK",
  EXIT: "PHASE 3 EXIT",
  EFFICIENCY: "PHASE 4 FEE EFFICIENCY",
  WALK_FORWARD: "PHASE 5 WALK-FORWARD",
};
