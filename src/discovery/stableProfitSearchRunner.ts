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
  stableProfitTurboScreenGrid,
  stableProfitPhase2,
  stableProfitPhase3,
  stableProfitPhase4,
  stableProfitPhase5Monthly,
  STABLE_PROFIT_PHASE_LABEL,
  type StableProfitPhaseName,
} from "./stableProfitPhases.js";
import {
  evaluateStableProfit,
  stableProfitSummary,
  formatTargetCheckLine,
  type StableProfitEvaluation,
} from "./stableProfitEvaluation.js";
import { monthlyEarlyReject } from "./stableProfitEarlyReject.js";
import { normalizeAtrDeepParams } from "./atrBreakoutDeepSearch.js";

export type SearchBudget = { maxVariants: number; maxRuntimeMs: number };

type Seed = { params: Record<string, number | string> };

const normalizeParams = (params: Record<string, number | string>) => normalizeAtrDeepParams(params);

const familyRankScore = (ev: StableProfitEvaluation): number =>
  ev.stableMonthlyProfitScore + ev.worstMonthlyPnLPct * 8;

const nearbyParamVariants = (
  params: Record<string, number | string>
): Record<string, number | string>[] => {
  const out: Record<string, number | string>[] = [];
  const bump = (key: string, delta: number) => {
    const v = Number(params[key]);
    if (!Number.isFinite(v)) return;
    const next = { ...params, [key]: Math.round((v + delta) * 1000) / 1000 };
    if (!out.some((p) => JSON.stringify(p) === JSON.stringify(next))) out.push(next);
  };
  bump("riskPct", -0.1);
  bump("riskPct", 0.1);
  bump("atrMult", -0.1);
  bump("leverage", -1);
  return out.slice(0, 4);
};

export class StableProfitSearchRunner {
  private tested = 0;
  private earlyRejected = 0;
  private startedAt = Date.now();
  private targetAchieved = false;
  private targetWinner: StableProfitEvaluation | null = null;
  private nearbyPassCount = 0;

  private readonly topStableMonthlyProfit = new TopK<StableProfitEvaluation>(50, (e) => e.stableMonthlyProfitScore);
  private readonly topByWorstMonthPnL = new TopK<StableProfitEvaluation>(50, (e) => e.worstMonthlyPnLPct);
  private readonly topLowDrawdownProfit = new TopK<StableProfitEvaluation>(
    50,
    (e) => e.metrics.netPnL - e.metrics.maxDrawdownPct * 10
  );
  private readonly topProfitFactor = new TopK<StableProfitEvaluation>(50, (e) => e.metrics.profitFactor);
  private readonly topSmoothEquityCurve = new TopK<StableProfitEvaluation>(
    50,
    (e) => e.metrics.netPnL - e.monthlyPnLStdDev * 20
  );
  private readonly topClosestToTarget = new TopK<StableProfitEvaluation>(50, (e) => {
    const failed = e.hardTargetFailures.length;
    return e.stableMonthlyProfitScore + (e.passesHardTarget ? 50_000 : 0) - failed * 2000;
  });
  private readonly topHighProfitButRisky = new TopK<StableProfitEvaluation>(
    50,
    (e) => e.metrics.netPnLPct - e.metrics.maxDrawdownPct * 5
  );
  private readonly fallbackBest = new TopK<StableProfitEvaluation>(50, (e) => e.stableMonthlyProfitScore);

  private bestAvgMonthly = -Infinity;
  private bestWorstMonth = -Infinity;
  private bestDrawdown = Infinity;
  private bestProfitableMonths = 0;
  private bestStrategy = "";
  private bestParams: Record<string, number | string> | null = null;
  private bestFailures: string[] = [];

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
    private readonly maxPromoteFamilies: number,
    private readonly turboMode: boolean
  ) {}

  private budgetExceeded(): boolean {
    if (this.tested >= this.budget.maxVariants) return true;
    if (Date.now() - this.startedAt >= this.budget.maxRuntimeMs) return true;
    return this.targetAchieved;
  }

  private recordEvaluation(ev: StableProfitEvaluation): void {
    if (ev.dominanceRejected && ev.metrics.netPnL > 0) {
      this.topHighProfitButRisky.consider(ev);
      this.fallbackBest.consider(ev);
      return;
    }

    this.topStableMonthlyProfit.consider(ev);
    this.topByWorstMonthPnL.consider(ev);
    this.topLowDrawdownProfit.consider(ev);
    this.topProfitFactor.consider(ev);
    this.topSmoothEquityCurve.consider(ev);
    this.topClosestToTarget.consider(ev);
    this.topHighProfitButRisky.consider(ev);
    this.fallbackBest.consider(ev);

    if (!ev.dominanceRejected) {
      if (ev.averageMonthlyPnLPct > this.bestAvgMonthly) this.bestAvgMonthly = ev.averageMonthlyPnLPct;
      if (ev.worstMonthlyPnLPct > this.bestWorstMonth) this.bestWorstMonth = ev.worstMonthlyPnLPct;
      if (ev.metrics.maxDrawdownPct < this.bestDrawdown) this.bestDrawdown = ev.metrics.maxDrawdownPct;
      if (ev.profitableMonths > this.bestProfitableMonths) this.bestProfitableMonths = ev.profitableMonths;
      if (ev.stableMonthlyProfitScore >= (this.topStableMonthlyProfit.best()?.stableMonthlyProfitScore ?? -Infinity)) {
        this.bestStrategy = ev.strategyName;
        this.bestParams = ev.params;
        this.bestFailures = ev.hardTargetFailures;
      }
    }
  }

  private tryConfirmTarget(ev: StableProfitEvaluation): void {
    if (!ev.passesHardTarget || this.targetAchieved) return;
    const strategy = ALL_STRATEGIES.find((s) => s.strategyName === ev.strategyName)!;
    let nearbyPasses = 0;
    for (const variant of nearbyParamVariants(ev.params)) {
      if (this.budgetExceeded()) break;
      const merged = mergeParams(strategy.defaults, COMMON_DEFAULTS, variant);
      const r = strategy.run({
        candles: this.config.candles,
        cache: this.cache,
        params: normalizeParams(merged),
        initialBalance: this.config.initialBalance,
        entryMode: this.config.entryMode,
        feeRate: this.config.feeRate,
        leverage: this.config.leverage,
        riskPct: this.config.riskPct,
        backtestMsSpan: this.config.backtestMsSpan,
      });
      this.tested += 1;
      const early = monthlyEarlyReject(
        r.trades,
        r.metrics,
        this.rangeStart,
        this.rangeEnd,
        this.config.initialBalance
      );
      if (early.reject) continue;
      const nev = evaluateStableProfit(r, this.rangeStart, this.rangeEnd, this.config.initialBalance);
      if (nev.passesHardTarget && !nev.dominanceRejected) nearbyPasses += 1;
    }
    if (nearbyPasses >= 2) {
      this.targetAchieved = true;
      this.targetWinner = ev;
      this.nearbyPassCount = nearbyPasses;
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
    const best = this.topClosestToTarget.best() ?? this.topStableMonthlyProfit.best();
    console.log(
      `[STABLE PROFIT 6M]\n` +
        `tested=${this.tested}/${this.budget.maxVariants} progress=${pct.toFixed(2)}%\n` +
        `elapsed=${formatDuration(elapsedMs)} ETA=${formatDuration(Math.max(0, etaMs))}\n` +
        `stage=${this.currentStageLabel} strategy=${this.currentStrategyLabel} phase=${this.currentPhaseLabel}\n` +
        `bestAvgMonthlyPnL=${this.bestAvgMonthly === -Infinity ? "—" : this.bestAvgMonthly.toFixed(2) + "%"}\n` +
        `bestWorstMonthPnL=${this.bestWorstMonth === -Infinity ? "—" : this.bestWorstMonth.toFixed(2) + "%"}\n` +
        `bestDrawdown=${this.bestDrawdown === Infinity ? "—" : this.bestDrawdown.toFixed(2) + "%"}\n` +
        `profitableMonths=${this.bestProfitableMonths}\n` +
        `strategy=${this.bestStrategy || "—"}\n` +
        (best ? `${formatTargetCheckLine(best)}\n` : "") +
        (this.bestFailures.length ? `failedRequirements=${this.bestFailures.join(", ")}\n` : "") +
        (this.bestParams ? `params=${JSON.stringify(this.bestParams)}\n` : "") +
        (this.earlyRejected > 0 ? `earlyRejected=${this.earlyRejected}\n` : "")
    );
  }

  savePartial(extra: Record<string, unknown> = {}): void {
    const best = this.topClosestToTarget.best() ?? this.topStableMonthlyProfit.best();
    writeJson(this.partialPath, {
      generatedAt: new Date().toISOString(),
      status: this.targetAchieved ? "target_achieved" : "running",
      optimizationTarget: "stable_monthly_profit_10pct_each_month",
      turboMode: this.turboMode,
      progress: {
        tested: this.tested,
        maxVariants: this.budget.maxVariants,
        progressPct: this.budget.maxVariants > 0 ? (this.tested / this.budget.maxVariants) * 100 : 0,
        elapsedMs: Date.now() - this.startedAt,
        earlyRejected: this.earlyRejected,
        bestAvgMonthlyPnL: this.bestAvgMonthly,
        bestWorstMonthPnL: this.bestWorstMonth,
        bestDrawdown: this.bestDrawdown,
        profitableMonths: this.bestProfitableMonths,
        bestStrategy: this.bestStrategy,
        bestParams: this.bestParams,
      },
      currentBest: best ? stableProfitSummary(best) : null,
      failedRequirementsForBest: best?.hardTargetFailures ?? [],
      testedVariants: this.tested,
      top20Candidates: this.topClosestToTarget.getAll().slice(0, 20).map(stableProfitSummary),
      ...extra,
    });
  }

  private evaluateStrategy(
    strategy: PhasedStrategyDefinition,
    params: Record<string, number | string>,
    checkTarget = true,
    laxEarlyReject = false
  ): StableProfitEvaluation | null {
    if (this.budgetExceeded()) return null;
    this.tested += 1;
    this.tick();

    const result = this.runBacktest(strategy, params);
    if (result.metrics.tradesCount < 5) return null;

    const early = monthlyEarlyReject(
      result.trades,
      result.metrics,
      this.rangeStart,
      this.rangeEnd,
      this.config.initialBalance,
      laxEarlyReject
    );
    if (early.reject) {
      this.earlyRejected += 1;
      return null;
    }

    const ev = evaluateStableProfit(result, this.rangeStart, this.rangeEnd, this.config.initialBalance);
    if (!ev.dominanceRejected) this.recordEvaluation(ev);
    else this.fallbackBest.consider(ev);

    if (checkTarget && ev.passesHardTarget && !ev.dominanceRejected) {
      this.tryConfirmTarget(ev);
    }
    return ev;
  }

  runStage1(): { promoted: string[] } {
    this.currentStageLabel = "STAGE_1_SCREENING";
    const familyBest = new Map<string, StableProfitEvaluation>();
    for (const strategy of ALL_STRATEGIES) {
      if (this.budgetExceeded()) break;
      this.currentStrategyLabel = strategy.strategyName;
      const grids = resolveStrategyGrids(strategy, "quick");
      const grid = this.turboMode
        ? stableProfitTurboScreenGrid()
        : { ...grids.screen, ...stableProfitTurboScreenGrid() };
      for (const variant of cartesian(grid)) {
        if (this.budgetExceeded()) break;
        const params = mergeParams(strategy.defaults, COMMON_DEFAULTS, variant);
        const ev = this.evaluateStrategy(strategy, params, false, true);
        if (!ev) continue;
        const prev = familyBest.get(strategy.strategyName);
        if (!prev || familyRankScore(ev) > familyRankScore(prev)) {
          familyBest.set(strategy.strategyName, ev);
        }
      }
    }

    let ranked = [...familyBest.entries()].sort((a, b) => familyRankScore(b[1]) - familyRankScore(a[1]));
    if (ranked.length < this.maxPromoteFamilies) {
      for (const strategy of ALL_STRATEGIES) {
        if (ranked.length >= this.maxPromoteFamilies) break;
        if (familyBest.has(strategy.strategyName)) continue;
        const params = mergeParams(strategy.defaults, COMMON_DEFAULTS, {
          riskPct: 0.5,
          leverage: 3,
          maxTradesPerDay: 20,
        });
        const result = this.runBacktest(strategy, params);
        this.tested += 1;
        const ev = evaluateStableProfit(result, this.rangeStart, this.rangeEnd, this.config.initialBalance);
        familyBest.set(strategy.strategyName, ev);
      }
      ranked = [...familyBest.entries()].sort((a, b) => familyRankScore(b[1]) - familyRankScore(a[1]));
    }
    const promoted = ranked.slice(0, this.maxPromoteFamilies).map(([name]) => name);

    this.savePartial({ stage1: { promoted, ranked: ranked.slice(0, 5).map(([n, e]) => ({ name: n, score: familyRankScore(e) })) } });
    return { promoted };
  }

  private runPhase(
    strategy: PhasedStrategyDefinition,
    grid: ParamGrid,
    seeds: Seed[]
  ): StableProfitEvaluation[] {
    const top = new TopK<StableProfitEvaluation>(this.keepTop, (e) => e.stableMonthlyProfitScore);
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

  runStage2(promoted: string[]): Record<string, StableProfitEvaluation[]> {
    this.currentStageLabel = "STAGE_2_PROGRESSIVE";
    const phaseResults: Record<string, StableProfitEvaluation[]> = {};
    const mode: "quick" | "fast" = this.turboMode ? "fast" : "fast";

    for (const name of promoted) {
      if (this.budgetExceeded()) break;
      this.currentStrategyLabel = name;
      const strategy = ALL_STRATEGIES.find((s) => s.strategyName === name)!;
      const grids = resolveStrategyGrids(strategy, mode);
      const phaseDefs: { phase: StableProfitPhaseName; grid: ParamGrid }[] = [
        { phase: "ENTRY", grid: grids.phase1 },
        {
          phase: "RISK",
          grid: { ...stableProfitPhase2(mode, this.turboMode), minAtrPct: this.turboMode ? [0, 0.1] : [0, 0.05, 0.1] },
        },
        { phase: "EXIT", grid: stableProfitPhase3(mode, this.turboMode) },
        { phase: "EFFICIENCY", grid: stableProfitPhase4(mode, this.turboMode) },
        { phase: "MONTHLY_CONSISTENCY", grid: stableProfitPhase5Monthly(mode, this.turboMode) },
      ];

      let seeds: Seed[] = [];
      let last: StableProfitEvaluation[] = [];

      for (const pd of phaseDefs) {
        if (this.budgetExceeded()) break;
        this.currentPhaseLabel = STABLE_PROFIT_PHASE_LABEL[pd.phase];
        console.log(
          `\n[${STABLE_PROFIT_PHASE_LABEL[pd.phase]}] ${name} | grid=${countGrid(pd.grid)} seeds=${seeds.length || 1}`
        );
        last = this.runPhase(strategy, pd.grid, seeds);
        seeds = last.map((c) => ({ params: c.params }));
        this.savePartial({
          stage2: { strategy: name, phase: pd.phase, kept: last.slice(0, 3).map(stableProfitSummary) },
        });
      }
      phaseResults[name] = last;
    }
    return phaseResults;
  }

  runStage4Validation(): StableProfitEvaluation[] {
    this.currentStageLabel = "STAGE_4_FULL_VALIDATION";
    const candidates = this.topClosestToTarget.getAll().slice(0, this.turboMode ? 5 : 10);
    const validated: StableProfitEvaluation[] = [];

    for (const c of candidates) {
      if (this.budgetExceeded()) break;
      const strategy = ALL_STRATEGIES.find((s) => s.strategyName === c.strategyName)!;
      this.currentStrategyLabel = c.strategyName;
      this.currentPhaseLabel = "NEARBY_VARIANTS";
      for (const variant of nearbyParamVariants(c.params)) {
        const params = mergeParams(strategy.defaults, COMMON_DEFAULTS, c.params, variant);
        const ev = this.evaluateStrategy(strategy, params, true);
        if (ev) validated.push(ev);
      }
    }
    this.savePartial({ stage4: { validated: validated.slice(0, 5).map(stableProfitSummary) } });
    return validated;
  }

  private exportTopCandidateArtifacts(): Record<string, string | null>[] {
    const seen = new Set<string>();
    const paths: Record<string, string | null>[] = [];
    const candidates = [
      this.targetWinner,
      ...this.topClosestToTarget.getAll().slice(0, 3),
      ...this.topStableMonthlyProfit.getAll().slice(0, 2),
    ].filter(Boolean) as StableProfitEvaluation[];

    for (const ev of candidates) {
      const key = JSON.stringify(ev.params);
      if (seen.has(key)) continue;
      seen.add(key);
      const strategy = ALL_STRATEGIES.find((s) => s.strategyName === ev.strategyName)!;
      const result = strategy.run({
        candles: this.config.candles,
        cache: this.cache,
        params: normalizeParams(ev.params),
        initialBalance: this.config.initialBalance,
        entryMode: this.config.entryMode,
        feeRate: this.config.feeRate,
        leverage: this.config.leverage,
        riskPct: this.config.riskPct,
        backtestMsSpan: this.config.backtestMsSpan,
      });
      const p = exportArtifacts(result, this.config.outputDir);
      paths.push({
        strategyName: ev.strategyName,
        tradeHistoryPath: p.tradeHistoryPath,
        equityCurvePath: p.equityCurvePath,
      });
    }
    return paths;
  }

  buildFinalPayload(
    stage1: { promoted: string[] },
    stage2: Record<string, StableProfitEvaluation[]>,
    stage4: StableProfitEvaluation[]
  ) {
    const best =
      this.targetWinner ??
      this.topClosestToTarget.best() ??
      this.topStableMonthlyProfit.best() ??
      this.fallbackBest.best();

    const artifactExports = this.exportTopCandidateArtifacts();
    const bestArtifacts = artifactExports[0] ?? null;

    const explainFailures = (ev: StableProfitEvaluation) =>
      ev.targetCheck.filter((t) => !t.passed).map((t) => `${t.id}: ${t.actual} (need ${t.required})`);

    return {
      generatedAt: new Date().toISOString(),
      status: "completed",
      turboMode: this.turboMode,
      targetAchieved: this.targetAchieved,
      nearbyVariantsPassing: this.nearbyPassCount,
      earlyRejectedCount: this.earlyRejected,
      targetRequirements: {
        monthlyNetPnLPctMin: 10,
        fullMonthsRequired: 6,
        maxFullDrawdownPct: 20,
        maxMonthlyDrawdownPct: 15,
        profitFactorMin: 1.2,
        minTradesPerMonth: 30,
        maxOneMonthDominancePct: 40,
      },
      testedVariants: this.tested,
      elapsedSec: (Date.now() - this.startedAt) / 1000,
      promotedFamilies: stage1.promoted,
      maxPromoteFamilies: this.maxPromoteFamilies,
      stage4ValidatedCount: stage4.length,
      bestStrategy: best
        ? {
            ...stableProfitSummary(best),
            tradeHistoryPath: bestArtifacts?.tradeHistoryPath ?? null,
            equityCurvePath: bestArtifacts?.equityCurvePath ?? null,
            rejectionReasons: explainFailures(best),
          }
        : null,
      topCandidateArtifacts: artifactExports,
      rankings: {
        topStableMonthlyProfit: this.topStableMonthlyProfit.getAll().map(stableProfitSummary),
        topByWorstMonthPnL: this.topByWorstMonthPnL.getAll().map(stableProfitSummary),
        topLowDrawdownProfit: this.topLowDrawdownProfit.getAll().map(stableProfitSummary),
        topProfitFactor: this.topProfitFactor.getAll().map(stableProfitSummary),
        topSmoothEquityCurve: this.topSmoothEquityCurve.getAll().map(stableProfitSummary),
        topClosestToTarget: this.topClosestToTarget.getAll().map(stableProfitSummary),
        topHighProfitButRisky: this.topHighProfitButRisky.getAll().map(stableProfitSummary),
        fallbackBestCandidates: this.fallbackBest.getAll().map((e) => ({
          ...stableProfitSummary(e),
          rejectionReasons: explainFailures(e),
        })),
      },
      stage2Summary: Object.fromEntries(
        Object.entries(stage2).map(([k, v]) => [k, v.slice(0, 2).map(stableProfitSummary)])
      ),
    };
  }
}

export { mergeMergedIndicatorReq };
