import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { loadOrDownloadO1MinuteCandles, CacheMissingError } from "../backtest/fetchO1Candles.js";
import { filterCandlesByRange, resolveStrategyCandles } from "../backtest/candleTimeframe.js";
import { buildDiscoveryIndicatorCache } from "./indicatorCache.js";
import { cartesian, countGrid, mergeParams } from "./grids.js";
import { atrVolatilityBreakout } from "./strategies/atrVolatilityBreakout.js";
import { COMMON_DEFAULTS } from "./strategies/phasedGrids.js";
import { TopK } from "./topK.js";
import { ATR_DEEP_PHASES } from "./atrDeepGrids.js";
import {
  evaluateAtrDeepVariant,
  normalizeAtrDeepParams,
  snapshotFromCandidates,
  variantSummary,
  estimatePhaseVariants,
  type AtrDeepVariantResult,
} from "./atrBreakoutDeepSearch.js";
import type { DiscoveryRunConfig, PhaseName } from "./types.js";

const num = (v: string | undefined, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const bool = (v: string | undefined, fb: boolean) =>
  !v ? fb : v === "1" || v.toLowerCase() === "true";

const KEEP_TOP = 20;
const LOG_EVERY = 25;

type Seed = { params: Record<string, number | string> };

const runPhase = (
  phase: PhaseName,
  grid: import("./types.js").ParamGrid,
  seeds: Seed[],
  config: DiscoveryRunConfig,
  cache: ReturnType<typeof buildDiscoveryIndicatorCache>,
  rangeStart: number,
  rangeEnd: number,
  onProgress: (info: ReturnType<typeof snapshotFromCandidates>) => void,
  onPartial: (payload: object) => void
): { candidates: AtrDeepVariantResult[]; tested: number; passingKept: AtrDeepVariantResult[] } => {
  const variants = cartesian(grid);
  const seedList = seeds.length ? seeds : [{ params: mergeParams(atrVolatilityBreakout.defaults, COMMON_DEFAULTS) }];
  const phaseTotal = seedList.length * variants.length;
  /** Rank all variants for phase-to-phase seeds (including rejected). */
  const top = new TopK<AtrDeepVariantResult>(KEEP_TOP, (v) => v.atrDeepScore);
  /** Best variants that pass hard reject filters. */
  const passingTop = new TopK<AtrDeepVariantResult>(KEEP_TOP, (v) => v.atrDeepScore);
  let tested = 0;

  for (const seed of seedList) {
    for (const variant of variants) {
      tested += 1;
      const raw = mergeParams(atrVolatilityBreakout.defaults, COMMON_DEFAULTS, seed.params, variant);
      const params = normalizeAtrDeepParams(raw);

      const result = atrVolatilityBreakout.run({
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

      const evaluated = evaluateAtrDeepVariant(result, rangeStart, rangeEnd, config.initialBalance);
      top.consider(evaluated);
      if (!evaluated.rejected) passingTop.consider(evaluated);

      if (tested % LOG_EVERY === 0 || tested === phaseTotal) {
        const snap = snapshotFromCandidates(phase, tested, phaseTotal, top.getAll());
        onProgress(snap);
      }
    }
  }

  const candidates = top.getAll();
  const passingKept = passingTop.getAll();
  onPartial({
    phase,
    tested,
    kept: candidates.map(variantSummary),
    passingKept: passingKept.map(variantSummary),
  });
  return { candidates, tested, passingKept };
};

const main = async () => {
  const outputDir = path.resolve(process.env.BACKTEST_OUTPUT_DIR ?? "data/results");
  const partialPath = path.join(outputDir, "atr-breakout-deep-search.partial.json");
  const finalPath = path.join(outputDir, "atr-breakout-deep-search-final.json");

  const symbol = process.env.O1_SYMBOL ?? "SOLUSD";
  const marketId = num(process.env.O1_MARKET_ID, 2);
  const backtestDays = num(process.env.BACKTEST_DAYS, 30);
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

  let candles = resolveStrategyCandles(
    filterCandlesByRange(load.candles, startTimeMs, endTimeMs),
    process.env.BACKTEST_TIMEFRAME ?? "1m"
  );
  const maxCandlesEnv = process.env.BACKTEST_MAX_CANDLES;
  if (maxCandlesEnv && Number(maxCandlesEnv) > 0) {
    console.warn(`[ATR_DEEP] Ignoring BACKTEST_MAX_CANDLES=${maxCandlesEnv} — using all ${candles.length} candles`);
  }

  const rangeStart = candles[0]!.openTime;
  const rangeEnd = (candles[candles.length - 1]?.closeTime ?? endTimeMs) + 1;
  const spanMs = rangeEnd - rangeStart;

  const config: DiscoveryRunConfig = {
    symbol,
    marketId,
    timeframe: process.env.BACKTEST_TIMEFRAME ?? "1m",
    backtestDays,
    maxCandles: 0,
    initialBalance: num(process.env.BACKTEST_INITIAL_BALANCE, 1000),
    entryMode: process.env.BACKTEST_ENTRY_MODE === "close" ? "close" : "nextOpen",
    feeRate: num(process.env.BACKTEST_FEE_RATE, 0.00035),
    leverage: num(process.env.BACKTEST_LEVERAGE, 5),
    riskPct: num(process.env.BACKTEST_RISK_PCT, 1),
    mode: "full",
    forceRefresh: bool(process.env.BACKTEST_FORCE_REFRESH, false),
    cacheDir: path.resolve(process.env.BACKTEST_CACHE_DIR ?? "data/cache"),
    outputDir,
    candles,
    backtestMsSpan: spanMs,
  };

  const cache = buildDiscoveryIndicatorCache(candles, atrVolatilityBreakout.indicatorReq);
  const totalEstimate = estimatePhaseVariants(1, ATR_DEEP_PHASES, KEEP_TOP);

  console.log("\n=== ATR VOLATILITY BREAKOUT — DEEP 30D SEARCH ===\n");
  console.log(`Symbol: ${symbol} | Candles: ${candles.length} | Est. variants: ~${totalEstimate}`);
  console.log(`Keep top ${KEEP_TOP} per phase | Reject: trades<50, DD>35%, PF<0.85, fees>2×gross, losingWeeks>2\n`);

  fs.mkdirSync(outputDir, { recursive: true });

  const phaseResults: {
    phase: PhaseName;
    tested: number;
    gridSize: number;
    top: ReturnType<typeof variantSummary>[];
    topPassing: ReturnType<typeof variantSummary>[];
  }[] = [];

  let seeds: Seed[] = [];
  let globalTested = 0;
  const startedAt = Date.now();

  const writePartial = (extra: object = {}) => {
    const payload = {
      generatedAt: new Date().toISOString(),
      status: "in_progress",
      symbol,
      candleCount: candles.length,
      backtestDays,
      phasesCompleted: phaseResults.length,
      globalTested,
      phaseResults,
      ...extra,
    };
    fs.writeFileSync(partialPath, JSON.stringify(payload, null, 2));
  };

  for (const pd of ATR_DEEP_PHASES) {
    const gridSize = countGrid(pd.grid);
    const phaseStart = Date.now();
    console.log(`\n--- Phase ${pd.name} (${gridSize} combos × ${seeds.length || 1} seeds) ---`);

    const { candidates, tested, passingKept } = runPhase(
      pd.name,
      pd.grid,
      seeds,
      config,
      cache,
      rangeStart,
      rangeEnd,
      (snap) => {
        console.log(
          `[${snap.phase}] ${snap.tested}/${snap.total} (${snap.progressPct}%) | ` +
            `bestScore=${Number.isFinite(snap.bestScore) ? snap.bestScore.toFixed(2) : "—"} ` +
            `netPnL=${Number.isFinite(snap.bestNetPnL) ? snap.bestNetPnL.toFixed(2) : "—"} ` +
            `vol=${snap.bestVolume.toFixed(0)} ` +
            `dd=${snap.bestDrawdown === Infinity ? "—" : snap.bestDrawdown.toFixed(2) + "%"} ` +
            `profWeeks=${snap.bestProfitableWeeks}`
        );
        if (snap.bestParams) console.log(`  best params: ${JSON.stringify(snap.bestParams)}`);
      },
      (chunk) => writePartial({ lastPhaseChunk: chunk })
    );

    globalTested += tested;
    seeds = candidates.map((c) => ({ params: c.params }));
    const topSummaries = candidates.map(variantSummary);
    phaseResults.push({
      phase: pd.name,
      tested,
      gridSize,
      top: topSummaries,
      topPassing: passingKept.map(variantSummary),
    });

    writePartial();
    console.log(
      `Phase ${pd.name} done in ${((Date.now() - phaseStart) / 1000).toFixed(1)}s | kept ${candidates.length} | ` +
        `best netPnL=${candidates[0]?.metrics.netPnL ?? "n/a"} score=${candidates[0]?.atrDeepScore ?? "n/a"}`
    );
  }

  const finals = phaseResults[phaseResults.length - 1]?.top ?? [];
  const best = finals[0] ?? null;
  const passed =
    phaseResults.flatMap((p) => p.topPassing).length > 0
      ? phaseResults.flatMap((p) => p.topPassing).filter((f) => !f.rejected)
      : finals.filter((f) => !f.rejected && f.metrics.tradesCount > 0);

  const finalPayload = {
    generatedAt: new Date().toISOString(),
    status: "complete",
    symbol,
    marketId,
    timeframe: config.timeframe,
    backtestDays,
    candleCount: candles.length,
    candleRange: {
      start: new Date(rangeStart).toISOString(),
      end: new Date(candles[candles.length - 1]!.openTime).toISOString(),
    },
    execution: {
      initialBalance: config.initialBalance,
      entryMode: config.entryMode,
      feeRate: config.feeRate,
      leverage: config.leverage,
      riskPct: config.riskPct,
    },
    searchConfig: {
      keepTop: KEEP_TOP,
      phases: ATR_DEEP_PHASES.map((p) => ({ name: p.name, gridKeys: Object.keys(p.grid) })),
      scoring: "totalVolume*0.01 + netPnL*5 - totalFees*2 - maxDrawdownPct*15 + profitableWeeks*200 - losingWeeks*300",
      rejectRules: [
        "tradesCount<50",
        "maxDrawdownPct>35",
        "profitFactor<0.85",
        "fees>gross*2",
        "losingWeeks>2",
      ],
    },
    globalTested,
    elapsedSec: (Date.now() - startedAt) / 1000,
    phaseResults,
    bestOverall: best,
    bestPassingFilters: passed[0] ?? null,
    topPassing: passed.slice(0, 10),
  };

  fs.writeFileSync(finalPath, JSON.stringify(finalPayload, null, 2));
  fs.writeFileSync(partialPath, JSON.stringify({ ...finalPayload, status: "complete" }, null, 2));

  console.log("\n=== DEEP SEARCH COMPLETE ===\n");
  if (best) {
    console.log(`Best score: ${best.atrDeepScore} | rejected: ${best.rejected}`);
    console.log(`  netPnL=${best.metrics.netPnL} volume=${best.metrics.totalVolume} DD=${best.metrics.maxDrawdownPct}%`);
    console.log(`  gross=${best.metrics.grossPnL} fees=${best.metrics.totalFees} PF=${best.metrics.profitFactor}`);
    console.log(`  weeks: +${best.profitableWeeks} / -${best.losingWeeks}`);
    console.log(`  params: ${JSON.stringify(best.params)}`);
  } else {
    console.log("No candidates retained.");
  }
  if (passed.length) {
    console.log(`\nBest passing all hard filters: score=${passed[0]!.atrDeepScore} netPnL=${passed[0]!.metrics.netPnL}`);
  } else {
    console.log("\nNo variant passed all hard reject filters on full 30d.");
  }
  console.log(`\nPartial: ${partialPath}`);
  console.log(`Final:   ${finalPath}\n`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
