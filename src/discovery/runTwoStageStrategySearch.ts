import "dotenv/config";
import path from "node:path";
import { loadOrDownloadO1MinuteCandles, CacheMissingError } from "../backtest/fetchO1Candles.js";
import { filterCandlesByRange, resolveStrategyCandles } from "../backtest/candleTimeframe.js";
import type { DiscoveryMode, DiscoveryRunConfig } from "./types.js";
import { buildDiscoveryIndicatorCache } from "./indicatorCache.js";
import { mergeMergedIndicatorReq, countStage1Variants } from "./strategies/registry.js";
import { formatDuration } from "./progressive/logFormat.js";
import { runStage1 } from "./progressive/stage1.js";
import { runStage2ForStrategy, estimateStage2Variants } from "./progressive/stage2.js";
import { createRankings, feedRankings, resolveHighVolumeNearBreakeven } from "./progressive/rankings.js";
import {
  toRanked,
  toHighVolumeNearBreakevenRanked,
  buildBestHighVolumeNearBreakeven,
  writeJson,
} from "./progressive/output.js";

const num = (v: string | undefined, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const bool = (v: string | undefined, fb: boolean) =>
  !v ? fb : v === "1" || v.toLowerCase() === "true";

const main = async () => {
  const mode = (process.env.BACKTEST_DISCOVERY_MODE ?? "fast") as DiscoveryMode;
  const maxCandles = num(process.env.BACKTEST_MAX_CANDLES, 10000);
  const keepTop = num(process.env.STAGE2_KEEP_TOP, 10);
  const progressEvery = num(process.env.PHASE_PROGRESS_EVERY, 25);
  const backtestDays = num(process.env.BACKTEST_DAYS, 30);
  const symbol = process.env.O1_SYMBOL ?? "SOLUSD";
  const marketId = num(process.env.O1_MARKET_ID, 2);

  const cacheDir = path.resolve(process.env.BACKTEST_CACHE_DIR ?? "data/cache");
  const outputDir = path.resolve(process.env.BACKTEST_OUTPUT_DIR ?? "data/results");
  const end = Date.now();
  const start = end - backtestDays * 86400000;

  let load;
  try {
    load = await loadOrDownloadO1MinuteCandles(
      { webServerUrl: process.env.O1_WEB_SERVER_URL ?? "https://zo-mainnet.n1.xyz", symbol, marketId },
      {
        cacheDir,
        startTimeMs: start,
        endTimeMs: end,
        backtestDays,
        countback: 500,
        maxRetries: 5,
        retryDelayMs: 1500,
        forceRefresh: bool(process.env.BACKTEST_FORCE_REFRESH, false),
      }
    );
  } catch (e) {
    if (e instanceof CacheMissingError) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }

  let candles = resolveStrategyCandles(
    filterCandlesByRange(load.candles, start, end),
    process.env.BACKTEST_TIMEFRAME ?? "1m"
  );
  if (maxCandles > 0 && candles.length > maxCandles) candles = candles.slice(-maxCandles);

  const span = (candles[candles.length - 1]?.openTime ?? end) - (candles[0]?.openTime ?? start);
  const config: DiscoveryRunConfig = {
    symbol,
    marketId,
    timeframe: process.env.BACKTEST_TIMEFRAME ?? "1m",
    backtestDays,
    maxCandles,
    initialBalance: num(process.env.BACKTEST_INITIAL_BALANCE, 1000),
    entryMode: process.env.BACKTEST_ENTRY_MODE === "close" ? "close" : "nextOpen",
    feeRate: num(process.env.BACKTEST_FEE_RATE, 0.00035),
    leverage: num(process.env.BACKTEST_LEVERAGE, 5),
    riskPct: num(process.env.BACKTEST_RISK_PCT, 1),
    mode,
    forceRefresh: bool(process.env.BACKTEST_FORCE_REFRESH, false),
    cacheDir,
    outputDir,
    candles,
    backtestMsSpan: span,
  };

  const cache = buildDiscoveryIndicatorCache(candles, mergeMergedIndicatorReq());
  const stage1Total = countStage1Variants(mode);
  const t0 = Date.now();
  let globalTested = 0;

  const partialDiscovery = path.join(outputDir, "strategy-discovery.partial.json");
  const partialProgressive = path.join(outputDir, "progressive-search.partial.json");

  console.log("[SEARCH] Two-stage progressive strategy discovery (volume-first near-breakeven)");
  console.log(`  Priority: max totalVolume | netPnL>=0 preferred | trades>=50 | DD<=35%`);
  console.log(`  Mode: ${mode} | Candles: ${candles.length} | Stage1 variants: ${stage1Total}`);
  console.log(`  Partial: ${partialDiscovery}`);
  console.log(`  Partial: ${partialProgressive}`);
  console.log(`  Final: ${path.join(outputDir, "strategy-discovery-final.json")}`);
  console.log("");

  const savePartials = (extra: Record<string, unknown>) => {
    const elapsedMs = Date.now() - t0;
    const base = {
      generatedAt: new Date().toISOString(),
      status: "running",
      elapsedMs,
      testedVariants: globalTested,
      ...extra,
    };
    writeJson(partialDiscovery, { ...base, file: "strategy-discovery.partial.json" });
    writeJson(partialProgressive, { ...base, file: "progressive-search.partial.json" });
  };

  const rankings = createRankings();

  const stage1 = runStage1(
    config,
    cache,
    mode,
    (p) => {
      globalTested += 1;
      if (globalTested % progressEvery === 0) {
        const pct = stage1Total > 0 ? ((p.globalTested / stage1Total) * 100).toFixed(1) : "0";
        console.log(
          `[STAGE 1] strategy=${p.strategyName} tested=${p.tested}/${p.total} progress=${pct}% | ` +
            `global=${p.globalTested}/${stage1Total} | bestVol=${p.bestVol.toFixed(2)} bestPnL=${p.bestPnL.toFixed(2)} | ` +
            `elapsed=${formatDuration(Date.now() - t0)}`
        );
        savePartials({ currentStage: 1, currentStrategy: p.strategyName, progressPct: Number(pct) });
      }
    },
    (result) => feedRankings(rankings, result)
  );

  console.log(`\n[STAGE 1] Done. Promoted: ${stage1.promoted.join(", ") || "(none)"}`);
  savePartials({ currentStage: 1, status: "stage1_complete", promoted: stage1.promoted });

  const stage2Total = estimateStage2Variants(stage1.promoted, mode, keepTop);
  const phaseResults: Record<string, unknown> = {};

  for (const name of stage1.promoted) {
    console.log(`\n[STAGE 2] Optimizing ${name}...`);
    const { phases, finals } = runStage2ForStrategy(
      name,
      mode,
      config,
      cache,
      keepTop,
      (pp) => {
        const label =
          pp.phase === "ENTRY"
            ? "PHASE 1 ENTRY"
            : pp.phase === "RISK"
              ? "PHASE 2 RISK"
              : pp.phase === "EXIT"
                ? "PHASE 3 EXIT"
                : "PHASE 4 EFFICIENCY";
        console.log(
          `[${label}] strategy=${pp.strategyName} tested=${pp.tested}/${pp.phaseTotal} ` +
            `bestScore=${pp.bestScore.toFixed(2)} bestVol=${pp.bestVolume.toFixed(2)}`
        );
      },
      () => {
        globalTested += 1;
        if (globalTested % progressEvery === 0) {
          const total = stage1Total + stage2Total;
          const pct = total > 0 ? ((globalTested / total) * 100).toFixed(1) : "0";
          const eta = formatDuration(((Date.now() - t0) / globalTested) * (total - globalTested));
          console.log(
            `[GLOBAL] progress=${pct}% tested=${globalTested}/${total} elapsed=${formatDuration(Date.now() - t0)} ETA=${eta}`
          );
          savePartials({
            currentStage: 2,
            currentStrategy: name,
            progressPct: Number(pct),
            promoted: stage1.promoted,
          });
        }
      }
    );

    phaseResults[name] = phases;
    for (const f of finals) {
      feedRankings(rankings, f.result);
    }
    savePartials({ currentStage: 2, currentStrategy: name, phaseResults: phaseResults[name] });
  }

  const { items: hvItems, usedFallback: hvUsedFallback } = resolveHighVolumeNearBreakeven(rankings);
  const topHighVolumeNearBreakeven = toHighVolumeNearBreakevenRanked(hvItems, outputDir, true);
  const bestHighVolumeNearBreakeven = buildBestHighVolumeNearBreakeven(hvItems, hvUsedFallback);

  const exportRankings = (exportFiles: boolean) => ({
    topHighVolumeNearBreakeven,
    topByNetPnL: toRanked(rankings.topByNetPnL.getAll(), (r) => r.metrics.netPnL, outputDir, exportFiles),
    topByVolume: toRanked(rankings.topByVolume.getAll(), (r) => r.metrics.totalVolume, outputDir, exportFiles),
    topByVolumeWithPositivePnL: toRanked(
      rankings.topByVolumeWithPositivePnL.getAll(),
      (r) => r.metrics.totalVolume,
      outputDir,
      exportFiles
    ),
    topBalanced: toRanked(rankings.topBalanced.getAll(), (r) => r.balancedScore, outputDir, exportFiles),
    topLowDrawdown: toRanked(rankings.topLowDrawdown.getAll(), (r) => -r.metrics.maxDrawdownPct, outputDir, exportFiles),
    topLowFees: toRanked(rankings.topLowFees.getAll(), (r) => -r.metrics.totalFees, outputDir, exportFiles),
    topProfitFactor: toRanked(rankings.topProfitFactor.getAll(), (r) => r.metrics.profitFactor, outputDir, exportFiles),
    topClosestToBreakeven: toRanked(rankings.topClosestToBreakeven.getAll(), (r) => -Math.abs(r.metrics.netPnL), outputDir, exportFiles),
    topLowestOvertrading: toRanked(rankings.topLowestOvertrading.getAll(), (r) => r.overtradingScore, outputDir, exportFiles),
  });

  const elapsedMs = Date.now() - t0;
  const finalPayload = {
    generatedAt: new Date().toISOString(),
    status: "completed",
    symbol,
    marketId,
    timeframe: config.timeframe,
    backtestDays,
    maxCandles,
    discoveryMode: mode,
    elapsedMs,
    stage1Summary: {
      totalScreened: stage1.entries.length,
      promoted: stage1.promoted,
      rejected: stage1.rejected,
    },
    promotedStrategies: stage1.promoted,
    phaseResults,
    optimizationPriority: "high_volume_near_breakeven",
    highVolumeNearBreakevenFilters: {
      strict: {
        tradesCountMin: 50,
        totalVolumeMin: 1000,
        maxDrawdownPctMax: 35,
        profitFactorMin: 0.85,
      },
      fallback: {
        netPnLMinPctOfBalance: -3,
        maxDrawdownPctMax: 35,
        sortBy: "totalVolume_desc",
      },
    },
    bestHighVolumeNearBreakeven,
    highVolumeNearBreakevenUsedFallback: hvUsedFallback,
    rankings: exportRankings(true),
  };

  writeJson(path.join(outputDir, "strategy-discovery-final.json"), finalPayload);
  writeJson(path.join(outputDir, "progressive-search-final.json"), finalPayload);

  const r = exportRankings(false);
  const best = bestHighVolumeNearBreakeven;
  console.log("\n[SEARCH] Complete");
  console.log(
    `  Best high-volume near-breakeven: ${best?.strategyName ?? "none"}` +
      (best
        ? ` | vol=${best.totalVolume.toFixed(2)} netPnL=${best.netPnL.toFixed(2)} fees=${best.totalFees.toFixed(2)} ` +
          `DD=${best.maxDrawdownPct.toFixed(2)}% trades=${best.tradesCount} trades/day=${best.tradesPerDay.toFixed(2)} ` +
          `fees/vol=${best.feesToVolumeRatio.toFixed(6)} strict=${best.passedStrictFilters} fallback=${hvUsedFallback}`
        : "")
  );
  console.log(`  Top HV list size: ${r.topHighVolumeNearBreakeven.length}`);
  console.log(`  Best raw volume: ${r.topByVolume[0]?.strategyName ?? "none"} (${r.topByVolume[0]?.metrics.totalVolume ?? 0})`);
  console.log(`  Final: ${path.join(outputDir, "strategy-discovery-final.json")}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
