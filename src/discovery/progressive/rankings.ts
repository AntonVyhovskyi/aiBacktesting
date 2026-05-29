import type { StrategyBacktestResult } from "../types.js";
import { TopK } from "../topK.js";
import { breakevenScore } from "../scoring.js";
import {
  highVolumeBreakevenScore,
  passesFallbackVolumeFilter,
  passesHighVolumeHardFilters,
} from "../volumePriority.js";

export type RankingStore = {
  topByNetPnL: TopK<StrategyBacktestResult>;
  topByVolume: TopK<StrategyBacktestResult>;
  topByVolumeWithPositivePnL: TopK<StrategyBacktestResult>;
  topBalanced: TopK<StrategyBacktestResult>;
  topLowDrawdown: TopK<StrategyBacktestResult>;
  topLowFees: TopK<StrategyBacktestResult>;
  topProfitFactor: TopK<StrategyBacktestResult>;
  topClosestToBreakeven: TopK<StrategyBacktestResult>;
  topLowestOvertrading: TopK<StrategyBacktestResult>;
  topHighVolumeNearBreakevenStrict: TopK<StrategyBacktestResult>;
  topHighVolumeFallbackPool: TopK<StrategyBacktestResult>;
};

export const createRankings = (): RankingStore => ({
  topByNetPnL: new TopK(50, (r) => r.metrics.netPnL),
  topByVolume: new TopK(50, (r) => r.metrics.totalVolume),
  topByVolumeWithPositivePnL: new TopK(50, (r) => r.metrics.totalVolume),
  topBalanced: new TopK(50, (r) => r.balancedScore),
  topLowDrawdown: new TopK(50, (r) => -r.metrics.maxDrawdownPct),
  topLowFees: new TopK(50, (r) => -r.metrics.totalFees),
  topProfitFactor: new TopK(50, (r) => r.metrics.profitFactor),
  topClosestToBreakeven: new TopK(50, (r) => breakevenScore(r.metrics)),
  topLowestOvertrading: new TopK(50, (r) => r.overtradingScore),
  topHighVolumeNearBreakevenStrict: new TopK(50, (r) => highVolumeBreakevenScore(r.metrics)),
  topHighVolumeFallbackPool: new TopK(200, (r) => r.metrics.totalVolume),
});

export const feedRankings = (store: RankingStore, r: StrategyBacktestResult): void => {
  store.topByVolume.consider(r);
  store.topLowDrawdown.consider(r);
  store.topLowFees.consider(r);
  store.topClosestToBreakeven.consider(r);
  store.topLowestOvertrading.consider(r);

  if (passesFallbackVolumeFilter(r.metrics)) {
    store.topHighVolumeFallbackPool.consider(r);
  }

  if (passesHighVolumeHardFilters(r.metrics)) {
    store.topHighVolumeNearBreakevenStrict.consider(r);
  }

  if (r.metrics.tradesCount >= 50) {
    store.topByNetPnL.consider(r);
    store.topBalanced.consider(r);
    store.topProfitFactor.consider(r);
  }
  if (r.metrics.netPnL > 0 && r.metrics.tradesCount >= 50) {
    store.topByVolumeWithPositivePnL.consider(r);
  }
};

export const resolveHighVolumeNearBreakeven = (
  store: RankingStore
): { items: StrategyBacktestResult[]; usedFallback: boolean } => {
  const strict = store.topHighVolumeNearBreakevenStrict.getAll();
  if (strict.length > 0) {
    return {
      items: [...strict].sort(
        (a, b) => highVolumeBreakevenScore(b.metrics) - highVolumeBreakevenScore(a.metrics)
      ),
      usedFallback: false,
    };
  }
  const fallback = store.topHighVolumeFallbackPool
    .getAll()
    .filter((r) => passesFallbackVolumeFilter(r.metrics))
    .sort((a, b) => b.metrics.totalVolume - a.metrics.totalVolume);
  return { items: fallback.slice(0, 50), usedFallback: true };
};
