import type { DiscoveryMode, PhasedStrategyDefinition } from "../types.js";
import { gridForMode, countGrid, cartesian, mergeParams } from "../grids.js";
import type { IndicatorRequirements } from "../indicatorCache.js";
import { commonPhase2, commonPhase3, commonPhase4 } from "./phasedGrids.js";
import { emaCrossoverAtr } from "./emaCrossoverAtr.js";
import { emaTrendContinuation } from "./emaTrendContinuation.js";
import { rsiMeanReversion } from "./rsiMeanReversion.js";
import { rsiAdxTrend } from "./rsiAdxTrend.js";
import { bollingerMeanReversion } from "./bollingerMeanReversion.js";
import { donchianBreakout } from "./donchianBreakout.js";
import { atrVolatilityBreakout } from "./atrVolatilityBreakout.js";
import { emaVolumeSpike } from "./emaVolumeSpike.js";
import { vwapBounce } from "./vwapBounce.js";
import { rangeBreakoutRetest } from "./rangeBreakoutRetest.js";

export const ALL_STRATEGIES: PhasedStrategyDefinition[] = [
  emaCrossoverAtr,
  emaTrendContinuation,
  rsiMeanReversion,
  rsiAdxTrend,
  bollingerMeanReversion,
  donchianBreakout,
  atrVolatilityBreakout,
  emaVolumeSpike,
  vwapBounce,
  rangeBreakoutRetest,
];

export const resolveStrategyGrids = (s: PhasedStrategyDefinition, mode: DiscoveryMode) => ({
  screen: gridForMode(s.screenGrids.quick, s.screenGrids.fast, s.screenGrids.full, mode),
  phase1: gridForMode(s.phase1EntryGrids.quick, s.phase1EntryGrids.fast, s.phase1EntryGrids.full, mode),
  phase2: commonPhase2(mode),
  phase3: commonPhase3(mode),
  phase4: commonPhase4(mode),
});

export const countStage1Variants = (mode: DiscoveryMode): number =>
  ALL_STRATEGIES.reduce((n, s) => n + countGrid(resolveStrategyGrids(s, mode).screen), 0);

export const mergeMergedIndicatorReq = (): IndicatorRequirements => {
  const reqs = ALL_STRATEGIES.map((s) => s.indicatorReq);
  const u = (a: number[] = [], b: number[] = []) => [...new Set([...a, ...b])];
  return reqs.reduce<IndicatorRequirements>(
    (acc, r) => ({
      emaPeriods: u(acc.emaPeriods, r.emaPeriods),
      atrPeriods: u(acc.atrPeriods, r.atrPeriods),
      rsiPeriods: u(acc.rsiPeriods, r.rsiPeriods),
      adxPeriods: u(acc.adxPeriods, r.adxPeriods),
      bbPeriods: u(acc.bbPeriods, r.bbPeriods),
      donchianPeriods: u(acc.donchianPeriods, r.donchianPeriods),
      volumeSmaPeriods: u(acc.volumeSmaPeriods, r.volumeSmaPeriods),
      vwap: acc.vwap || r.vwap,
    }),
    {}
  );
};

export { mergeParams, cartesian, countGrid };
