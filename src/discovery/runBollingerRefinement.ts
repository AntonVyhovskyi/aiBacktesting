import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { loadOrDownloadO1MinuteCandles, CacheMissingError } from "../backtest/fetchO1Candles.js";
import { filterCandlesByRange, resolveStrategyCandles } from "../backtest/candleTimeframe.js";
import { buildDiscoveryIndicatorCache } from "./indicatorCache.js";
import { cartesian, countGrid, mergeParams } from "./grids.js";
import { TopK } from "./topK.js";
import { formatDuration } from "./progressive/logFormat.js";
import { bollingerMeanReversion } from "./strategies/bollingerMeanReversion.js";
import { COMMON_DEFAULTS } from "./strategies/phasedGrids.js";
import {
  BASE_BOLLINGER_PARAMS,
  BOLLINGER_REFINEMENT_PHASES,
  evaluateBollingerVariant,
  refinementSummaryRow,
  type RefinementVariantResult,
} from "./bollingerRefinement.js";
import { formatTargetCheckLine } from "./weeklyVolumeEvaluation.js";

const num = (v: string | undefined, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const bool = (v: string | undefined, fb: boolean) =>
  !v ? fb : v === "1" || v.toLowerCase() === "true";

const KEEP_TOP = 25;
const LOG_EVERY = 100;

const loadBaseParams = (outputDir: string): Record<string, number | string> => {
  const fullPath = path.join(outputDir, "best-autonomous-candidate-full.json");
  if (fs.existsSync(fullPath)) {
    const j = JSON.parse(fs.readFileSync(fullPath, "utf8")) as {
      primaryBest?: { params: Record<string, number | string> };
    };
    if (j.primaryBest?.params) return { ...BASE_BOLLINGER_PARAMS, ...j.primaryBest.params };
  }
  return { ...BASE_BOLLINGER_PARAMS };
};

const main = async () => {
  const outputDir = path.resolve(process.env.BACKTEST_OUTPUT_DIR ?? "data/results");
  const finalPath = path.join(outputDir, "bollinger-refinement-final.json");
  const baseParams = loadBaseParams(outputDir);
  const startBalance = num(process.env.BACKTEST_INITIAL_BALANCE, 100);
  const backtestDays = num(process.env.BACKTEST_DAYS, 30);
  const symbol = process.env.O1_SYMBOL ?? "SOLUSD";
  const marketId = num(process.env.O1_MARKET_ID, 2);
  const endTimeMs = Date.now();
  const startTimeMs = endTimeMs - backtestDays * 86400000;

  let load;
  try {
    load = await loadOrDownloadO1MinuteCandles(
      { webServerUrl: process.env.O1_WEB_SERVER_URL ?? "https://zo-mainnet.n1.xyz", symbol, marketId },
      {
        cacheDir: path.resolve(process.env.BACKTEST_CACHE_DIR ?? "data/cache"),
        startTimeMs,
        endTimeMs,
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

  const candles = resolveStrategyCandles(
    filterCandlesByRange(load.candles, startTimeMs, endTimeMs),
    process.env.BACKTEST_TIMEFRAME ?? "1m"
  );
  const rangeStart = candles[0]!.openTime;
  const rangeEnd = (candles[candles.length - 1]?.closeTime ?? endTimeMs) + 1;
  const spanMs = rangeEnd - rangeStart;
  const bbConfigs: { period: number; stdDev: number }[] = [];
  for (const period of [18, 19, 20, 21, 22]) {
    for (const stdDev of [1.8, 1.9, 2, 2.1, 2.2]) {
      bbConfigs.push({ period, stdDev });
    }
  }
  const cache = buildDiscoveryIndicatorCache(candles, {
    ...bollingerMeanReversion.indicatorReq,
    bbConfigs,
  });

  const runCtx = (params: Record<string, number | string>) =>
    bollingerMeanReversion.run({
      candles,
      cache,
      params,
      initialBalance: startBalance,
      entryMode: process.env.BACKTEST_ENTRY_MODE === "close" ? "close" : "nextOpen",
      feeRate: num(process.env.BACKTEST_FEE_RATE, 0.00035),
      leverage: num(process.env.BACKTEST_LEVERAGE, 5),
      riskPct: num(process.env.BACKTEST_RISK_PCT, 1),
      backtestMsSpan: spanMs,
    });

  console.log("\n=== BOLLINGER MEAN REVERSION — LOCAL REFINEMENT ===\n");
  console.log(`Base params: ${JSON.stringify(baseParams)}`);
  console.log(`Goals: netPnL>=0 | trades/day>=2 | PF>=0.9 | weeklyNotional>=10k | DD<=10%\n`);

  const t0 = Date.now();
  let tested = 0;
  let seeds: { params: Record<string, number | string> }[] = [{ params: { ...baseParams } }];
  const phaseLogs: { phase: string; tested: number; kept: number }[] = [];
  const globalTop = new TopK<RefinementVariantResult>(50, (r) => r.closenessScore);
  let targetHit: RefinementVariantResult | null = null;

  const evalParams = (p: Record<string, number | string>) => {
    const merged = mergeParams(bollingerMeanReversion.defaults, COMMON_DEFAULTS, baseParams, p);
    const result = runCtx(merged);
    return evaluateBollingerVariant(result, rangeStart, rangeEnd, startBalance, baseParams, merged);
  };

  const baseline = evalParams(baseParams);
  globalTop.consider(baseline);
  tested += 1;
  console.log(`Baseline: netPnL=${baseline.evaluation.metrics.netPnL} PF=${baseline.evaluation.metrics.profitFactor} trades/day=${baseline.evaluation.averageTradesPerDay.toFixed(2)} weeklyVol=${baseline.evaluation.averageWeeklyNotionalVolume.toFixed(0)}`);
  console.log(`  ${formatTargetCheckLine(baseline.targetCheck).replace("[CHECK]", "[BASELINE]")}\n`);

  for (const phase of BOLLINGER_REFINEMENT_PHASES) {
    const gridSize = countGrid(phase.grid);
    const top = new TopK<RefinementVariantResult>(KEEP_TOP, (r) => r.closenessScore);
    let phaseTested = 0;

    console.log(`--- ${phase.name} (${gridSize} × ${seeds.length} seeds) ---`);

    for (const seed of seeds) {
      for (const variant of cartesian(phase.grid)) {
        phaseTested += 1;
        tested += 1;
        const row = evalParams(mergeParams(seed.params, variant));
        top.consider(row);
        globalTop.consider(row);
        if (row.targetCheck.refinementTargetAchieved && !targetHit) targetHit = row;

        if (tested % LOG_EVERY === 0) {
          const best = globalTop.best();
          console.log(
            `  tested=${tested} | bestScore=${best?.closenessScore.toFixed(1)} netPnL=${best?.evaluation.metrics.netPnL} PF=${best?.evaluation.metrics.profitFactor} vol/wk=${best?.evaluation.averageWeeklyNotionalVolume.toFixed(0)}`
          );
        }
      }
    }

    seeds = top.getAll().map((r) => ({ params: r.params }));
    phaseLogs.push({ phase: phase.name, tested: phaseTested, kept: seeds.length });
    const phaseBest = top.best();
    if (phaseBest) {
      console.log(
        `  kept ${seeds.length} | best netPnL=${phaseBest.evaluation.metrics.netPnL} PF=${phaseBest.evaluation.metrics.profitFactor} trades/day=${phaseBest.evaluation.averageTradesPerDay.toFixed(2)}`
      );
    }
    if (targetHit) {
      console.log(`  TARGET HIT in ${phase.name}`);
      break;
    }
  }

  const top50 = globalTop.getAll();
  const passing = top50.filter((r) => r.targetCheck.refinementTargetAchieved);

  const payload = {
    generatedAt: new Date().toISOString(),
    strategyName: "BOLLINGER_MEAN_REVERSION",
    refinementGoals: {
      netPnLMin: 0,
      tradesPerDayMin: 2,
      profitFactorMin: 0.9,
      averageWeeklyNotionalMin: 10_000,
      maxDrawdownPctMax: 10,
    },
    baseParams,
    baseline: refinementSummaryRow(baseline),
    testedVariants: tested,
    elapsedSec: (Date.now() - t0) / 1000,
    phaseLogs,
    targetAchieved: passing.length > 0,
    bestPassing: passing[0] ? refinementSummaryRow(passing[0]) : null,
    top50ClosestToPass: top50.map(refinementSummaryRow),
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(finalPath, JSON.stringify(payload, null, 2));

  const best = top50[0]!;
  console.log("\n=== REFINEMENT COMPLETE ===\n");
  console.log(`Tested: ${tested} variants in ${formatDuration(Date.now() - t0)}`);
  console.log(`Target achieved: ${payload.targetAchieved} (${passing.length} passing in top 50)`);
  console.log(`\nClosest to pass (#1):`);
  console.log(`  netPnL=${best.evaluation.metrics.netPnL} | PF=${best.evaluation.metrics.profitFactor}`);
  console.log(`  trades/day=${best.evaluation.averageTradesPerDay.toFixed(2)} | weeklyVol=${best.evaluation.averageWeeklyNotionalVolume.toFixed(0)}`);
  console.log(`  DD=${best.evaluation.metrics.maxDrawdownPct}%`);
  console.log(`  ${formatTargetCheckLine(best.targetCheck)}`);
  if (Object.keys(best.paramDiff).length) {
    console.log(`  paramDiff: ${JSON.stringify(best.paramDiff)}`);
  }
  console.log(`\n  ${finalPath}\n`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
