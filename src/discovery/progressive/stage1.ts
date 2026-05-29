import type { DiscoveryIndicatorCache } from "../indicatorCache.js";
import type {
  DiscoveryMode,
  DiscoveryRunConfig,
  StrategyBacktestResult,
} from "../types.js";
import { shouldPromoteStage1 } from "../earlyStop.js";
import { cartesian, countGrid, mergeParams } from "../grids.js";
import { ALL_STRATEGIES, resolveStrategyGrids } from "../strategies/registry.js";
import { writeJson } from "./output.js";

export type ScreeningEntry = {
  strategyName: string;
  params: Record<string, number | string>;
  screeningScore: number;
  metrics: StrategyBacktestResult["metrics"];
  diagnostics: StrategyBacktestResult["diagnostics"];
  promoted: boolean;
  promotionReason: string;
  earlyStopped: boolean;
};

export type Stage1Result = {
  entries: ScreeningEntry[];
  promoted: string[];
  rejected: { strategyName: string; reason: string }[];
  bestByStrategy: Record<string, ScreeningEntry | null>;
};

export const runStage1 = (
  config: DiscoveryRunConfig,
  cache: DiscoveryIndicatorCache,
  mode: DiscoveryMode,
  onProgress: (info: {
    strategyName: string;
    tested: number;
    total: number;
    globalTested: number;
    globalTotal: number;
    bestPnL: number;
    bestVol: number;
  }) => void,
  onResult?: (result: StrategyBacktestResult) => void
): Stage1Result => {
  const globalTotal = ALL_STRATEGIES.reduce(
    (n, s) => n + countGrid(resolveStrategyGrids(s, mode).screen),
    0
  );
  let globalTested = 0;
  let bestPnL = -Infinity;
  let bestVol = -Infinity;

  const entries: ScreeningEntry[] = [];
  const promotedSet = new Set<string>();
  const rejected: { strategyName: string; reason: string }[] = [];
  const bestByStrategy: Record<string, ScreeningEntry | null> = {};

  for (const strategy of ALL_STRATEGIES) {
    bestByStrategy[strategy.strategyName] = null;
    const grid = resolveStrategyGrids(strategy, mode).screen;
    const variants = cartesian(grid);
    let si = 0;

    for (const variant of variants) {
      si += 1;
      globalTested += 1;
      const params = mergeParams(strategy.defaults, variant);
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

      if (result.metrics.netPnL > bestPnL) bestPnL = result.metrics.netPnL;
      if (result.metrics.totalVolume > bestVol) bestVol = result.metrics.totalVolume;
      onResult?.(result);

      const promo = shouldPromoteStage1(result.metrics);
      const entry: ScreeningEntry = {
        strategyName: strategy.strategyName,
        params,
        screeningScore: result.screeningScore,
        metrics: result.metrics,
        diagnostics: result.diagnostics,
        promoted: promo.promote,
        promotionReason: promo.reason,
        earlyStopped: result.earlyStopped,
      };
      entries.push(entry);

      const prev = bestByStrategy[strategy.strategyName];
      if (!prev || entry.screeningScore > prev.screeningScore) {
        bestByStrategy[strategy.strategyName] = entry;
      }

      if (promo.promote) promotedSet.add(strategy.strategyName);
      else if (si === variants.length && !promotedSet.has(strategy.strategyName)) {
        rejected.push({ strategyName: strategy.strategyName, reason: promo.reason });
      }

      onProgress({
        strategyName: strategy.strategyName,
        tested: si,
        total: variants.length,
        globalTested,
        globalTotal,
        bestPnL: Number.isFinite(bestPnL) ? bestPnL : 0,
        bestVol: Number.isFinite(bestVol) ? bestVol : 0,
      });
    }
  }

  const promoted = [...promotedSet];
  const out = { entries, promoted, rejected, bestByStrategy };
  writeJson(`${config.outputDir}/strategy-screening-results.json`, {
    generatedAt: new Date().toISOString(),
    status: "completed",
    symbol: config.symbol,
    marketId: config.marketId,
    timeframe: config.timeframe,
    backtestDays: config.backtestDays,
    maxCandles: config.maxCandles,
    discoveryMode: mode,
    totalScreened: entries.length,
    promoted,
    rejected,
    bestByStrategy,
    entries: entries.sort((a, b) => b.screeningScore - a.screeningScore).slice(0, 100),
  });
  return out;
};
