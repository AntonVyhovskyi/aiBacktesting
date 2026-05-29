import type { DiscoveryIndicatorCache } from "./indicatorCache.js";
import type { DiscoveryRunConfig, ParamGrid, PhasedStrategyDefinition } from "./types.js";
import { cartesian, countGrid, mergeParams } from "./grids.js";
import { TopK } from "./topK.js";
import { formatDuration } from "./progressive/logFormat.js";
import { writeJson, exportArtifacts } from "./progressive/output.js";
import {
  ALL_STRATEGIES,
  resolveStrategyGrids,
  mergeMergedIndicatorReq,
} from "./strategies/registry.js";
import { COMMON_DEFAULTS } from "./strategies/phasedGrids.js";
import {
  autonomousScreenGrid,
  autonomousPhase2,
  autonomousPhase3,
  autonomousPhase4,
  autonomousPhase5,
  AUTONOMOUS_PHASE_LABEL,
  type AutonomousPhaseName,
} from "./autonomousPhases.js";
import { shouldEarlyStopVariant, shouldPromoteAutonomousFamily } from "./autonomousEarlyStop.js";
import {
  evaluateAutonomousVariant,
  evaluationSummary,
  buildTargetCheck,
  formatTargetCheckLine,
  type AutonomousEvaluation,
} from "./weeklyVolumeEvaluation.js";
import { normalizeAtrDeepParams } from "./atrBreakoutDeepSearch.js";

export type SearchBudget = {
  maxVariants: number;
  maxRuntimeMs: number;
};

export type SearchProgress = {
  tested: number;
  maxVariants: number;
  progressPct: number;
  elapsedMs: number;
  etaMs: number;
  currentStage: string;
  currentStrategy: string;
  currentPhase: string;
  bestWeeklyVolume: number;
  bestNetPnL: number;
  bestDrawdown: number;
  stableWeeks: string;
  bestStrategy: string;
  bestParams: Record<string, number | string> | null;
  targetAchieved: boolean;
};

type Seed = { params: Record<string, number | string> };

const normalizeParams = (params: Record<string, number | string>) => normalizeAtrDeepParams(params);

export class AutonomousSearchRunner {
  private tested = 0;
  private startedAt = Date.now();
  private targetAchieved = false;
  private targetWinner: AutonomousEvaluation | null = null;

  private readonly topOverall = new TopK<AutonomousEvaluation>(30, (e) => e.weeklyVolumeTargetScore);
  private readonly topStable = new TopK<AutonomousEvaluation>(20, (e) =>
    e.passesHardTarget ? e.weeklyVolumeTargetScore + 5000 : e.weeklyVolumeTargetScore
  );
  private readonly topVolume = new TopK<AutonomousEvaluation>(20, (e) => e.averageWeeklyNotionalVolume);
  private readonly topFeeEfficient = new TopK<AutonomousEvaluation>(20, (e) =>
    e.metrics.totalFees > 0 ? e.metrics.netPnL / e.metrics.totalFees : e.metrics.netPnL
  );
  private readonly topFallback = new TopK<AutonomousEvaluation>(20, (e) =>
    e.passesFallbackTarget ? e.weeklyVolumeTargetScore + 3000 : e.weeklyVolumeTargetScore
  );

  private bestWeeklyVolume = 0;
  private bestNetPnL = -Infinity;
  private bestDrawdown = Infinity;
  private bestStableWeeks = "0/0";
  private bestStrategy = "";
  private bestParams: Record<string, number | string> | null = null;

  constructor(
    private readonly config: DiscoveryRunConfig,
    private readonly cache: DiscoveryIndicatorCache,
    private readonly rangeStart: number,
    private readonly rangeEnd: number,
    private readonly budget: SearchBudget,
    private readonly partialPath: string,
    private readonly logEvery: number,
    private readonly saveEvery: number,
    private readonly keepTop: number,
    private readonly discoveryMode: "quick" | "fast" = "fast"
  ) {}

  get progress(): SearchProgress {
    const elapsedMs = Date.now() - this.startedAt;
    const etaMs =
      this.tested > 0 ? (elapsedMs / this.tested) * (this.budget.maxVariants - this.tested) : 0;
    return {
      tested: this.tested,
      maxVariants: this.budget.maxVariants,
      progressPct: this.budget.maxVariants > 0 ? (this.tested / this.budget.maxVariants) * 100 : 0,
      elapsedMs,
      etaMs,
      currentStage: this.currentStageLabel,
      currentStrategy: this.currentStrategyLabel,
      currentPhase: this.currentPhaseLabel,
      bestWeeklyVolume: this.bestWeeklyVolume,
      bestNetPnL: Number.isFinite(this.bestNetPnL) ? this.bestNetPnL : 0,
      bestDrawdown: this.bestDrawdown,
      stableWeeks: this.bestStableWeeks,
      bestStrategy: this.bestStrategy,
      bestParams: this.bestParams,
      targetAchieved: this.targetAchieved,
    };
  }

  private currentStageLabel = "init";
  private currentStrategyLabel = "";
  private currentPhaseLabel = "";

  private budgetExceeded(): boolean {
    if (this.tested >= this.budget.maxVariants) return true;
    if (Date.now() - this.startedAt >= this.budget.maxRuntimeMs) return true;
    return this.targetAchieved;
  }

  private recordEvaluation(ev: AutonomousEvaluation, result: import("./types.js").StrategyBacktestResult): void {
    this.topOverall.consider(ev);
    this.topStable.consider(ev);
    this.topVolume.consider(ev);
    this.topFeeEfficient.consider(ev);
    this.topFallback.consider(ev);

    if (ev.averageWeeklyNotionalVolume > this.bestWeeklyVolume)
      this.bestWeeklyVolume = ev.averageWeeklyNotionalVolume;
    if (ev.metrics.netPnL > this.bestNetPnL) this.bestNetPnL = ev.metrics.netPnL;
    if (ev.metrics.maxDrawdownPct < this.bestDrawdown) this.bestDrawdown = ev.metrics.maxDrawdownPct;

    const fw = ev.fullWeeks.length;
    const stable = fw > 0 ? `${ev.nearBreakevenOrProfitableWeeks}/${fw}` : "0/0";
    if (ev.weeklyVolumeTargetScore >= (this.topOverall.best()?.weeklyVolumeTargetScore ?? -Infinity)) {
      this.bestStrategy = ev.strategyName;
      this.bestParams = ev.params;
      this.bestStableWeeks = stable;
    }

    if (ev.passesHardTarget && !this.targetAchieved) {
      this.targetAchieved = true;
      this.targetWinner = ev;
      exportArtifacts(result, this.config.outputDir);
    }
  }

  private runBacktest(
    strategy: PhasedStrategyDefinition,
    params: Record<string, number | string>
  ): import("./types.js").StrategyBacktestResult {
    return strategy.run({
      candles: this.config.candles,
      cache: this.cache,
      params: normalizeParams(params),
      initialBalance: this.config.initialBalance,
      entryMode: this.config.entryMode,
      feeRate: this.config.feeRate,
      leverage: this.config.leverage,
      riskPct: this.config.riskPct,
      backtestMsSpan: this.config.backtestMsSpan,
    });
  }

  private tick(stage: string, strategy: string, phase: string): void {
    this.currentStageLabel = stage;
    this.currentStrategyLabel = strategy;
    this.currentPhaseLabel = phase;
    if (this.tested % this.logEvery === 0) this.logProgress();
    if (this.tested % this.saveEvery === 0) this.savePartial();
  }

  logProgress(): void {
    const p = this.progress;
    const best = this.topOverall.best();
    const checkLine = best ? formatTargetCheckLine(buildTargetCheck(best)) : "[CHECK] no candidates yet";
    console.log(
      `[AUTONOMOUS SEARCH]\n` +
        `tested=${p.tested}/${p.maxVariants}\n` +
        `progress=${p.progressPct.toFixed(2)}%\n` +
        `elapsed=${formatDuration(p.elapsedMs)}\n` +
        `ETA=${formatDuration(Math.max(0, p.etaMs))}\n` +
        `stage=${p.currentStage} strategy=${p.currentStrategy} phase=${p.currentPhase}\n` +
        `bestWeeklyVolume=${p.bestWeeklyVolume.toFixed(0)} USDC\n` +
        `bestPnL=${p.bestNetPnL >= 0 ? "+" : ""}${p.bestNetPnL.toFixed(2)}\n` +
        `bestDD=${p.bestDrawdown === Infinity ? "—" : p.bestDrawdown.toFixed(1) + "%"}\n` +
        `stableWeeks=${p.stableWeeks}\n` +
        `strategy=${p.bestStrategy || "—"}\n` +
        `targetAchieved=${p.targetAchieved}\n` +
        `${checkLine}\n` +
        (p.bestParams ? `params=${JSON.stringify(p.bestParams)}\n` : "")
    );
  }

  savePartial(extra: Record<string, unknown> = {}): void {
    const p = this.progress;
    const best = this.topOverall.best();
    writeJson(this.partialPath, {
      generatedAt: new Date().toISOString(),
      status: this.targetAchieved ? "target_achieved" : "running",
      targetRequirements: {
        startBalanceUsdc: this.config.initialBalance,
        weeklyNotionalTargetUsdc: 10_000,
        minTradesPerDay: 2,
        maxDrawdownPct: 35,
        profitFactorMin: 0.9,
        stableWeeksMin: 3,
        netPnLPreferred: 0,
        netPnLFallback: -5,
      },
      progress: p,
      currentBestTargetCheck: best ? buildTargetCheck(best) : null,
      testedVariants: this.tested,
      topStable: this.topStable.getAll().map(evaluationSummary),
      topHighVolume: this.topVolume.getAll().map(evaluationSummary),
      topFeeEfficient: this.topFeeEfficient.getAll().map(evaluationSummary),
      topOverall: this.topOverall.getAll().slice(0, 15).map(evaluationSummary),
      topFallback: this.topFallback.getAll().slice(0, 10).map(evaluationSummary),
      targetWinner: this.targetWinner ? evaluationSummary(this.targetWinner) : null,
      ...extra,
    });
  }

  private evaluateStrategy(
    strategy: PhasedStrategyDefinition,
    params: Record<string, number | string>
  ): AutonomousEvaluation | null {
    if (this.budgetExceeded()) return null;
    this.tested += 1;
    this.tick(this.currentStageLabel, strategy.strategyName, this.currentPhaseLabel);

    const result = this.runBacktest(strategy, params);
    const early = shouldEarlyStopVariant(
      result.metrics,
      Math.ceil((this.rangeEnd - this.rangeStart) / (7 * 86400000)),
      result.trades.length > 0 ? 1 : 0
    );
    if (early.stop && result.metrics.tradesCount < 3) {
      return null;
    }

    const ev = evaluateAutonomousVariant(
      result,
      this.rangeStart,
      this.rangeEnd,
      this.config.initialBalance
    );
    this.recordEvaluation(ev, result);
    return ev;
  }

  runStage1(): { promoted: string[]; entries: AutonomousEvaluation[] } {
    this.currentStageLabel = "STAGE_1_SCREENING";
    const entries: AutonomousEvaluation[] = [];
    const familyBest = new Map<string, AutonomousEvaluation>();

    for (const strategy of ALL_STRATEGIES) {
      if (this.budgetExceeded()) break;
      this.currentStrategyLabel = strategy.strategyName;
      const grids = resolveStrategyGrids(strategy, "quick");
      const grid = { ...grids.screen, ...autonomousScreenGrid("quick") };
      for (const variant of cartesian(grid)) {
        if (this.budgetExceeded()) break;
        const params = mergeParams(strategy.defaults, COMMON_DEFAULTS, variant);
        const ev = this.evaluateStrategy(strategy, params);
        if (!ev) continue;
        entries.push(ev);
        const prev = familyBest.get(strategy.strategyName);
        if (!prev || ev.weeklyVolumeTargetScore > prev.weeklyVolumeTargetScore) {
          familyBest.set(strategy.strategyName, ev);
        }
      }
    }

    const promotedSet = new Set<string>();
    for (const [name, ev] of familyBest) {
      const promo = shouldPromoteAutonomousFamily(ev);
      if (promo.promote) promotedSet.add(name);
    }

    const rankedFamilies = [...familyBest.entries()].sort(
      (a, b) => b[1].weeklyVolumeTargetScore - a[1].weeklyVolumeTargetScore
    );
    const promoted = [...promotedSet];
    const minPromote = Math.min(6, rankedFamilies.length);
    if (promoted.length < minPromote) {
      for (const [name] of rankedFamilies.slice(0, minPromote)) {
        if (!promoted.includes(name)) promoted.push(name);
      }
    }

    this.savePartial({ stage1: { promoted, screened: entries.length } });
    return { promoted, entries };
  }

  private runPhase(
    strategy: PhasedStrategyDefinition,
    _phase: AutonomousPhaseName,
    grid: ParamGrid,
    seeds: Seed[]
  ): AutonomousEvaluation[] {
    const variants = cartesian(grid);
    const seedList = seeds.length
      ? seeds
      : [{ params: mergeParams(strategy.defaults, COMMON_DEFAULTS) }];
    const top = new TopK<AutonomousEvaluation>(this.keepTop, (e) => e.weeklyVolumeTargetScore);

    for (const seed of seedList) {
      for (const variant of variants) {
        if (this.budgetExceeded()) break;
        const params = mergeParams(strategy.defaults, COMMON_DEFAULTS, seed.params, variant);
        const ev = this.evaluateStrategy(strategy, params);
        if (ev) top.consider(ev);
      }
    }
    return top.getAll();
  }

  runStage2(promoted: string[]): Record<string, AutonomousEvaluation[]> {
    this.currentStageLabel = "STAGE_2_PROGRESSIVE";
    const phaseResults: Record<string, AutonomousEvaluation[]> = {};
    const mode = this.discoveryMode;

    for (const name of promoted) {
      if (this.budgetExceeded()) break;
      const strategy = ALL_STRATEGIES.find((s) => s.strategyName === name)!;
      const grids = resolveStrategyGrids(strategy, mode);
      const phaseDefs: { phase: AutonomousPhaseName; grid: ParamGrid }[] = [
        { phase: "ENTRY", grid: grids.phase1 },
        { phase: "RISK", grid: { ...autonomousPhase2(mode), minAtrPct: [0, 0.05, 0.1, 0.15] } },
        { phase: "EXIT", grid: autonomousPhase3(mode) },
        { phase: "EFFICIENCY", grid: autonomousPhase4(mode) },
        { phase: "WALK_FORWARD", grid: autonomousPhase5(mode) },
      ];

      let seeds: Seed[] = [];
      let lastCandidates: AutonomousEvaluation[] = [];

      for (const pd of phaseDefs) {
        if (this.budgetExceeded()) break;
        this.currentPhaseLabel = AUTONOMOUS_PHASE_LABEL[pd.phase];
        console.log(`\n[${AUTONOMOUS_PHASE_LABEL[pd.phase]}] ${name} | grid=${countGrid(pd.grid)} seeds=${seeds.length || 1}`);
        lastCandidates = this.runPhase(strategy, pd.phase, pd.grid, seeds);
        seeds = lastCandidates.map((c) => ({ params: c.params }));
        this.savePartial({
          stage2: { strategy: name, phase: pd.phase, kept: lastCandidates.slice(0, 5).map(evaluationSummary) },
        });
      }

      phaseResults[name] = lastCandidates;
    }

    return phaseResults;
  }

  buildFinalPayload(stage1: { promoted: string[] }, stage2: Record<string, AutonomousEvaluation[]>) {
    const best = this.targetWinner ?? this.topOverall.best() ?? this.topFallback.best();
    let tradeHistoryPath: string | null = null;
    let equityCurvePath: string | null = null;

    if (best) {
      const strategy = ALL_STRATEGIES.find((s) => s.strategyName === best.strategyName)!;
      const result = strategy.run({
        candles: this.config.candles,
        cache: this.cache,
        params: normalizeParams(best.params),
        initialBalance: this.config.initialBalance,
        entryMode: this.config.entryMode,
        feeRate: this.config.feeRate,
        leverage: this.config.leverage,
        riskPct: this.config.riskPct,
        backtestMsSpan: this.config.backtestMsSpan,
      });
      const paths = exportArtifacts(result, this.config.outputDir);
      tradeHistoryPath = paths.tradeHistoryPath;
      equityCurvePath = paths.equityCurvePath;
    }

    const explainFallback = (ev: AutonomousEvaluation) => {
      const issues: string[] = [];
      if (ev.averageWeeklyNotionalVolume < 10_000) issues.push("not_enough_weekly_volume");
      if (ev.metrics.netPnL < 0) issues.push("negative_pnl");
      if (ev.metrics.maxDrawdownPct > 35) issues.push("drawdown_too_high");
      if (ev.metrics.totalFees > ev.metrics.grossPnL * 1.5 && ev.metrics.grossPnL > 0)
        issues.push("fee_death");
      if (ev.averageTradesPerDay < 2) issues.push("not_enough_trades_per_day");
      if (ev.nearBreakevenOrProfitableWeeks < 3) issues.push("unstable_weeks");
      return issues;
    };

    return {
      generatedAt: new Date().toISOString(),
      status: "completed",
      targetAchieved: this.targetAchieved,
      targetRequirements: {
        startBalanceUsdc: 100,
        weeklyNotionalTargetUsdc: 10_000,
        minTradesPerDay: 2,
        maxDrawdownPct: 35,
        profitFactorMin: 0.9,
        stableWeeksMin: 3,
        netPnLPreferred: 0,
        netPnLFallback: -5,
      },
      testedVariants: this.tested,
      elapsedSec: (Date.now() - this.startedAt) / 1000,
      promotedFamilies: stage1.promoted,
      stage2Summary: Object.fromEntries(
        Object.entries(stage2).map(([k, v]) => [k, v.slice(0, 3).map(evaluationSummary)])
      ),
      bestStrategy: best
        ? {
            ...evaluationSummary(best),
            tradeHistoryPath,
            equityCurvePath,
            fallbackIssues: explainFallback(best),
          }
        : null,
      topStableCandidates: this.topStable.getAll().map(evaluationSummary),
      topHighVolumeCandidates: this.topVolume.getAll().map(evaluationSummary),
      topFeeEfficientCandidates: this.topFeeEfficient.getAll().map(evaluationSummary),
      closestFallbackCandidates: this.topFallback
        .getAll()
        .slice(0, 10)
        .map((e) => ({ ...evaluationSummary(e), fallbackIssues: explainFallback(e) })),
    };
  }
}

export { mergeMergedIndicatorReq };
