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
import {
  evaluateMaxVolume10DD,
  maxVolumeSummary,
  shouldPromoteMaxVolumeFamily,
  type MaxVolume10DDEvaluation,
} from "./maxVolume10DDEvaluation.js";
import { normalizeAtrDeepParams } from "./atrBreakoutDeepSearch.js";

export type SearchBudget = { maxVariants: number; maxRuntimeMs: number };

type Seed = { params: Record<string, number | string> };

const normalizeParams = (params: Record<string, number | string>) => normalizeAtrDeepParams(params);

export class MaxVolume10DDSearchRunner {
  private tested = 0;
  private startedAt = Date.now();
  private riskWinner: MaxVolume10DDEvaluation | null = null;

  private readonly topMaxMonthlyVolumeUnder10DD = new TopK<MaxVolume10DDEvaluation>(
    30,
    (e) => e.totalMonthlyNotionalVolume
  );
  private readonly topVolumeNearBreakeven = new TopK<MaxVolume10DDEvaluation>(25, (e) => {
    const m = e.metrics;
    return e.totalMonthlyNotionalVolume - Math.abs(m.netPnL) * 50 - m.maxDrawdownPct * 200;
  });
  private readonly topLowDrawdownHighVolume = new TopK<MaxVolume10DDEvaluation>(
    25,
    (e) => e.totalMonthlyNotionalVolume / (e.metrics.maxDrawdownPct + 0.5)
  );
  private readonly topHighestTradesUnder10DD = new TopK<MaxVolume10DDEvaluation>(
    25,
    (e) => (e.passesRiskConstraint ? e.metrics.tradesCount : -1)
  );
  private readonly topOverallScore = new TopK<MaxVolume10DDEvaluation>(30, (e) => e.maxVolumeWithRiskScore);
  private readonly closestFallback = new TopK<MaxVolume10DDEvaluation>(25, (e) => e.maxVolumeWithRiskScore);

  private bestMonthlyVolume = 0;
  private bestDrawdown = Infinity;
  private bestEndBalance = 0;
  private bestStrategy = "";
  private bestParams: Record<string, number | string> | null = null;
  private bestRiskPassed = false;

  private currentStageLabel = "init";
  private currentStrategyLabel = "";
  private currentPhaseLabel = "";

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

  private budgetExceeded(): boolean {
    if (this.tested >= this.budget.maxVariants) return true;
    if (Date.now() - this.startedAt >= this.budget.maxRuntimeMs) return true;
    return false;
  }

  private recordEvaluation(ev: MaxVolume10DDEvaluation, result: import("./types.js").StrategyBacktestResult): void {
    this.topOverallScore.consider(ev);
    this.closestFallback.consider(ev);
    if (ev.passesRiskConstraint) {
      this.topMaxMonthlyVolumeUnder10DD.consider(ev);
      this.topHighestTradesUnder10DD.consider(ev);
      this.topVolumeNearBreakeven.consider(ev);
      this.topLowDrawdownHighVolume.consider(ev);
    }

    if (ev.totalMonthlyNotionalVolume > this.bestMonthlyVolume) {
      this.bestMonthlyVolume = ev.totalMonthlyNotionalVolume;
      this.bestStrategy = ev.strategyName;
      this.bestParams = ev.params;
      this.bestDrawdown = ev.metrics.maxDrawdownPct;
      this.bestEndBalance = ev.metrics.endBalance;
      this.bestRiskPassed = ev.passesRiskConstraint;
    } else if (
      ev.totalMonthlyNotionalVolume === this.bestMonthlyVolume &&
      ev.metrics.maxDrawdownPct < this.bestDrawdown
    ) {
      this.bestDrawdown = ev.metrics.maxDrawdownPct;
      this.bestEndBalance = ev.metrics.endBalance;
      this.bestRiskPassed = ev.passesRiskConstraint;
    }

    if (ev.passesRiskConstraint && !this.riskWinner) {
      this.riskWinner = ev;
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

  private tick(): void {
    if (this.tested % this.logEvery === 0) this.logProgress();
    if (this.tested % this.saveEvery === 0) this.savePartial();
  }

  logProgress(): void {
    const elapsedMs = Date.now() - this.startedAt;
    const etaMs = this.tested > 0 ? (elapsedMs / this.tested) * (this.budget.maxVariants - this.tested) : 0;
    const pct = this.budget.maxVariants > 0 ? (this.tested / this.budget.maxVariants) * 100 : 0;
    console.log(
      `[MAX VOLUME ≤10% DD]\n` +
        `tested=${this.tested}/${this.budget.maxVariants} progress=${pct.toFixed(2)}%\n` +
        `elapsed=${formatDuration(elapsedMs)} ETA=${formatDuration(Math.max(0, etaMs))}\n` +
        `stage=${this.currentStageLabel} strategy=${this.currentStrategyLabel} phase=${this.currentPhaseLabel}\n` +
        `bestMonthlyVolume=${this.bestMonthlyVolume.toFixed(0)} USDC\n` +
        `bestMaxDrawdownPct=${this.bestDrawdown === Infinity ? "—" : this.bestDrawdown.toFixed(2) + "%"}\n` +
        `bestEndBalance=${this.bestEndBalance.toFixed(2)} USDC\n` +
        `riskConstraintPassed=${this.bestRiskPassed}\n` +
        `strategy=${this.bestStrategy || "—"}\n` +
        (this.bestParams ? `params=${JSON.stringify(this.bestParams)}\n` : "")
    );
  }

  savePartial(extra: Record<string, unknown> = {}): void {
    writeJson(this.partialPath, {
      generatedAt: new Date().toISOString(),
      status: "running",
      optimizationTarget: "max_monthly_notional_under_10pct_dd",
      constraints: {
        startBalanceUsdc: this.config.initialBalance,
        maxDrawdownPct: 10,
        minEndBalance: 90,
        maxLossUsdc: 10,
      },
      progress: {
        tested: this.tested,
        maxVariants: this.budget.maxVariants,
        bestMonthlyVolume: this.bestMonthlyVolume,
        bestMaxDrawdownPct: this.bestDrawdown,
        bestEndBalance: this.bestEndBalance,
        bestRiskPassed: this.bestRiskPassed,
        bestStrategy: this.bestStrategy,
        bestParams: this.bestParams,
      },
      testedVariants: this.tested,
      topMaxMonthlyVolumeUnder10DD: this.topMaxMonthlyVolumeUnder10DD.getAll().map(maxVolumeSummary),
      topVolumeNearBreakeven: this.topVolumeNearBreakeven.getAll().map(maxVolumeSummary),
      topLowDrawdownHighVolume: this.topLowDrawdownHighVolume.getAll().map(maxVolumeSummary),
      topHighestTradesUnder10DD: this.topHighestTradesUnder10DD.getAll().map(maxVolumeSummary),
      closestFallback: this.closestFallback.getAll().slice(0, 15).map(maxVolumeSummary),
      riskWinner: this.riskWinner ? maxVolumeSummary(this.riskWinner) : null,
      ...extra,
    });
  }

  private evaluateStrategy(
    strategy: PhasedStrategyDefinition,
    params: Record<string, number | string>
  ): MaxVolume10DDEvaluation | null {
    if (this.budgetExceeded()) return null;
    this.tested += 1;
    this.tick();

    const result = this.runBacktest(strategy, params);
    if (result.metrics.tradesCount === 0 && result.metrics.maxDrawdownPct > 50) return null;

    const ev = evaluateMaxVolume10DD(result, this.rangeStart, this.rangeEnd, this.config.initialBalance);
    this.recordEvaluation(ev, result);
    return ev;
  }

  runStage1(): { promoted: string[] } {
    this.currentStageLabel = "STAGE_1_SCREENING";
    const familyBest = new Map<string, MaxVolume10DDEvaluation>();

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
        const prev = familyBest.get(strategy.strategyName);
        if (!prev || ev.maxVolumeWithRiskScore > prev.maxVolumeWithRiskScore) {
          familyBest.set(strategy.strategyName, ev);
        }
      }
    }

    const promotedSet = new Set<string>();
    for (const [name, ev] of familyBest) {
      if (shouldPromoteMaxVolumeFamily(ev).promote) promotedSet.add(name);
    }
    const ranked = [...familyBest.entries()].sort(
      (a, b) => b[1].maxVolumeWithRiskScore - a[1].maxVolumeWithRiskScore
    );
    const promoted = [...promotedSet];
    const minPromote = Math.min(8, ranked.length);
    if (promoted.length < minPromote) {
      for (const [name] of ranked.slice(0, minPromote)) {
        if (!promoted.includes(name)) promoted.push(name);
      }
    }
    this.savePartial({ stage1: { promoted } });
    return { promoted };
  }

  private runPhase(
    strategy: PhasedStrategyDefinition,
    grid: ParamGrid,
    seeds: Seed[]
  ): MaxVolume10DDEvaluation[] {
    const top = new TopK<MaxVolume10DDEvaluation>(this.keepTop, (e) => e.maxVolumeWithRiskScore);
    const seedList = seeds.length ? seeds : [{ params: mergeParams(strategy.defaults, COMMON_DEFAULTS) }];
    for (const seed of seedList) {
      for (const variant of cartesian(grid)) {
        if (this.budgetExceeded()) break;
        const params = mergeParams(strategy.defaults, COMMON_DEFAULTS, seed.params, variant);
        const ev = this.evaluateStrategy(strategy, params);
        if (ev) top.consider(ev);
      }
    }
    return top.getAll();
  }

  runStage2(promoted: string[]): Record<string, MaxVolume10DDEvaluation[]> {
    this.currentStageLabel = "STAGE_2_PROGRESSIVE";
    const phaseResults: Record<string, MaxVolume10DDEvaluation[]> = {};
    const mode = this.discoveryMode;

    for (const name of promoted) {
      if (this.budgetExceeded()) break;
      this.currentStrategyLabel = name;
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
      let last: MaxVolume10DDEvaluation[] = [];

      for (const pd of phaseDefs) {
        if (this.budgetExceeded()) break;
        this.currentPhaseLabel = AUTONOMOUS_PHASE_LABEL[pd.phase];
        console.log(
          `\n[${AUTONOMOUS_PHASE_LABEL[pd.phase]}] ${name} | grid=${countGrid(pd.grid)} seeds=${seeds.length || 1}`
        );
        last = this.runPhase(strategy, pd.grid, seeds);
        seeds = last.map((c) => ({ params: c.params }));
        this.savePartial({ stage2: { strategy: name, phase: pd.phase, kept: last.slice(0, 3).map(maxVolumeSummary) } });
      }
      phaseResults[name] = last;
    }
    return phaseResults;
  }

  buildFinalPayload(stage1: { promoted: string[] }, stage2: Record<string, MaxVolume10DDEvaluation[]>) {
    const best =
      this.riskWinner ??
      this.topMaxMonthlyVolumeUnder10DD.best() ??
      this.topOverallScore.best() ??
      this.closestFallback.best();

    return {
      generatedAt: new Date().toISOString(),
      status: "completed",
      optimizationTarget: "max_monthly_notional_under_10pct_dd",
      constraints: {
        startBalanceUsdc: this.config.initialBalance,
        maxDrawdownPct: 10,
        minEndBalance: 90,
        profitNotRequired: true,
      },
      scoring: "totalNotionalVolume - maxDrawdownPct*10000 - max(0,90-endBalance)*10000",
      testedVariants: this.tested,
      elapsedSec: (Date.now() - this.startedAt) / 1000,
      promotedFamilies: stage1.promoted,
      anyPassedRiskConstraint: this.topMaxMonthlyVolumeUnder10DD.getAll().length > 0,
      bestUnderRiskConstraint: this.riskWinner ? maxVolumeSummary(this.riskWinner) : null,
      bestOverallByScore: best ? maxVolumeSummary(best) : null,
      rankings: {
        topMaxMonthlyVolumeUnder10DD: this.topMaxMonthlyVolumeUnder10DD.getAll().map(maxVolumeSummary),
        topVolumeNearBreakeven: this.topVolumeNearBreakeven.getAll().map(maxVolumeSummary),
        topLowDrawdownHighVolume: this.topLowDrawdownHighVolume.getAll().map(maxVolumeSummary),
        topHighestTradesUnder10DD: this.topHighestTradesUnder10DD.getAll().map(maxVolumeSummary),
        closestFallback: this.closestFallback.getAll().map(maxVolumeSummary),
      },
      stage2Summary: Object.fromEntries(
        Object.entries(stage2).map(([k, v]) => [k, v.slice(0, 2).map(maxVolumeSummary)])
      ),
    };
  }
}

export { mergeMergedIndicatorReq };
