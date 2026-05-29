import type { PhasedStrategyDefinition, StrategyContext } from "../../types.js";
import type { IndicatorRequirements } from "../../indicatorCache.js";
import type { ParamGrid } from "../../types.js";

export type FamilyStrategyPack = {
  familyId: string;
  label: string;
  strategy: PhasedStrategyDefinition;
  searchGrid: ParamGrid;
};

export const stubGrids = (): PhasedStrategyDefinition["screenGrids"] => ({
  quick: {},
  fast: {},
  full: {},
});

export const pack = (
  familyId: string,
  label: string,
  strategyName: string,
  defaults: Record<string, number | string>,
  indicatorReq: IndicatorRequirements,
  searchGrid: ParamGrid,
  run: (ctx: StrategyContext) => import("../../types.js").StrategyBacktestResult
): FamilyStrategyPack => ({
  familyId,
  label,
  searchGrid,
  strategy: {
    strategyName,
    defaults,
    screenGrids: stubGrids(),
    phase1EntryGrids: stubGrids(),
    indicatorReq,
    run,
  },
});
