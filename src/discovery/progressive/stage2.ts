import type { DiscoveryIndicatorCache } from "../indicatorCache.js";
import type { DiscoveryMode, DiscoveryRunConfig, PhaseName, StrategyBacktestResult } from "../types.js";
import { checkEarlyStop } from "../earlyStop.js";
import { cartesian, countGrid, mergeParams } from "../grids.js";
import { TopK } from "../topK.js";
import { ALL_STRATEGIES, resolveStrategyGrids } from "../strategies/registry.js";

export type PhaseCandidate = {
  params: Record<string, number | string>;
  result: StrategyBacktestResult;
};

export type PhaseResult = {
  phase: PhaseName;
  strategyName: string;
  tested: number;
  kept: PhaseCandidate[];
};

import { phaseOptimizationScore } from "../volumePriority.js";

const phaseScore = (r: StrategyBacktestResult): number => phaseOptimizationScore(r);

export const runPhase = (
  strategy: (typeof ALL_STRATEGIES)[0],
  _phase: PhaseName,
  grid: import("../types.js").ParamGrid,
  seeds: PhaseCandidate[],
  config: DiscoveryRunConfig,
  cache: DiscoveryIndicatorCache,
  keepTop: number,
  onTested: () => void,
  onScore?: (score: number, volume: number) => void
): { candidates: PhaseCandidate[]; tested: number } => {
  const variants = cartesian(grid);
  const results: PhaseCandidate[] = [];
  let tested = 0;

  const seedList: { params: Record<string, number | string> }[] = seeds.length
    ? seeds
    : [{ params: { ...strategy.defaults } }];

  for (const seed of seedList) {
    for (const variant of variants) {
      tested += 1;
      onTested();
      const params = mergeParams(strategy.defaults, seed.params, variant);
      const result = strategy.run({
        candles: config.candles,
        cache,
        params,
        initialBalance: config.initialBalance,
        entryMode: config.entryMode,
        feeRate: config.feeRate,
        leverage: config.leverage,
        riskPct: config.riskPct,
        backtestMsSpan: config.backtestMsSpan,
      });

      if (result.earlyStopped && checkEarlyStop(result.metrics).stop) continue;

      results.push({ params, result });
      onScore?.(phaseScore(result), result.metrics.totalVolume);
    }
  }

  const top = new TopK<PhaseCandidate>(keepTop, (c) => phaseScore(c.result));
  for (const r of results) top.consider(r);

  return { candidates: top.getAll(), tested };
};

export const runStage2ForStrategy = (
  strategyName: string,
  mode: DiscoveryMode,
  config: DiscoveryRunConfig,
  cache: DiscoveryIndicatorCache,
  keepTop: number,
  onPhaseProgress: (info: {
    phase: PhaseName;
    strategyName: string;
    tested: number;
    phaseTotal: number;
    bestScore: number;
    bestVolume: number;
  }) => void,
  onVariant: () => void
): { phases: PhaseResult[]; finals: PhaseCandidate[] } => {
  const strategy = ALL_STRATEGIES.find((s) => s.strategyName === strategyName)!;
  const grids = resolveStrategyGrids(strategy, mode);
  const phases: PhaseResult[] = [];

  const phaseDefs: { name: PhaseName; grid: import("../types.js").ParamGrid }[] = [
    { name: "ENTRY", grid: grids.phase1 },
    { name: "RISK", grid: grids.phase2 },
    { name: "EXIT", grid: grids.phase3 },
    { name: "EFFICIENCY", grid: grids.phase4 },
  ];

  let seeds: PhaseCandidate[] = [];

  for (const pd of phaseDefs) {
    const phaseTotal = (seeds.length || 1) * countGrid(pd.grid);
    let localTested = 0;
    let runningBest = -Infinity;
    let runningBestVol = -Infinity;
    const { candidates, tested } = runPhase(
      strategy,
      pd.name,
      pd.grid,
      seeds,
      config,
      cache,
      keepTop,
      () => {
        localTested += 1;
        onVariant();
      },
      (score, vol) => {
        if (score > runningBest) runningBest = score;
        if (vol > runningBestVol) runningBestVol = vol;
        if (localTested % 5 === 0 || localTested === phaseTotal) {
          onPhaseProgress({
            phase: pd.name,
            strategyName,
            tested: localTested,
            phaseTotal,
            bestScore: runningBest,
            bestVolume: runningBestVol,
          });
        }
      }
    );
    seeds = candidates;
    phases.push({ phase: pd.name, strategyName, tested, kept: candidates });
  }

  return { phases, finals: seeds };
};

export const estimateStage2Variants = (promoted: string[], mode: DiscoveryMode, keepTop: number): number => {
  let t = 0;
  for (const name of promoted) {
    const s = ALL_STRATEGIES.find((x) => x.strategyName === name)!;
    const g = resolveStrategyGrids(s, mode);
    let seeds = 1;
    for (const grid of [g.phase1, g.phase2, g.phase3, g.phase4]) {
      t += seeds * countGrid(grid);
      seeds = keepTop;
    }
  }
  return t;
};
