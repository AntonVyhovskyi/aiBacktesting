import "dotenv/config";
import path from "node:path";
import { loadOrDownloadO1MinuteCandles, CacheMissingError } from "../backtest/fetchO1Candles.js";
import { filterCandlesByRange, resolveStrategyCandles } from "../backtest/candleTimeframe.js";
import { buildDiscoveryIndicatorCache } from "./indicatorCache.js";
import { writeJson } from "./progressive/output.js";
import { MaxVolume10DDSearchRunner, mergeMergedIndicatorReq } from "./maxVolume10DDSearchRunner.js";
import type { DiscoveryRunConfig } from "./types.js";

const num = (v: string | undefined, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const bool = (v: string | undefined, fb: boolean) =>
  !v ? fb : v === "1" || v.toLowerCase() === "true";

const main = async () => {
  const outputDir = path.resolve(process.env.BACKTEST_OUTPUT_DIR ?? "data/results");
  const partialPath = path.join(outputDir, "max-monthly-volume-10dd-search.partial.json");
  const finalPath = path.join(outputDir, "max-monthly-volume-10dd-search-final.json");

  const symbol = process.env.O1_SYMBOL ?? "SOLUSD";
  const marketId = num(process.env.O1_MARKET_ID, 2);
  const backtestDays = num(process.env.BACKTEST_DAYS, 30);
  const startBalance = num(process.env.BACKTEST_INITIAL_BALANCE, 100);
  const maxVariants = num(process.env.MAX_VOLUME_MAX_VARIANTS, 100_000);
  const maxRuntimeMinutes = num(process.env.MAX_VOLUME_MAX_RUNTIME_MIN, 180);
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

  const config: DiscoveryRunConfig = {
    symbol,
    marketId,
    timeframe: process.env.BACKTEST_TIMEFRAME ?? "1m",
    backtestDays,
    maxCandles: 0,
    initialBalance: startBalance,
    entryMode: process.env.BACKTEST_ENTRY_MODE === "close" ? "close" : "nextOpen",
    feeRate: num(process.env.BACKTEST_FEE_RATE, 0.00035),
    leverage: num(process.env.BACKTEST_LEVERAGE, 5),
    riskPct: num(process.env.BACKTEST_RISK_PCT, 1),
    mode: "fast",
    forceRefresh: false,
    cacheDir: path.resolve(process.env.BACKTEST_CACHE_DIR ?? "data/cache"),
    outputDir,
    candles,
    backtestMsSpan: rangeEnd - rangeStart,
  };

  const cache = buildDiscoveryIndicatorCache(candles, mergeMergedIndicatorReq());
  const runner = new MaxVolume10DDSearchRunner(
    config,
    cache,
    rangeStart,
    rangeEnd,
    { maxVariants, maxRuntimeMs: maxRuntimeMinutes * 60_000 },
    partialPath,
    num(process.env.MAX_VOLUME_LOG_EVERY, 25),
    num(process.env.MAX_VOLUME_SAVE_EVERY, 50),
    num(process.env.MAX_VOLUME_KEEP_TOP, 20),
    (process.env.MAX_VOLUME_DISCOVERY_MODE as "quick" | "fast") ?? "fast"
  );

  console.log("\n=== MAX MONTHLY NOTIONAL VOLUME (≤10% DD) SEARCH ===\n");
  console.log(`Balance: ${startBalance} USDC | Max loss: 10 USDC | Candles: ${candles.length}`);
  console.log(`Objective: maximize monthly notional | Profit NOT required`);
  console.log(`Partial: ${partialPath}\nFinal: ${finalPath}\n`);

  const t0 = Date.now();
  const stage1 = runner.runStage1();
  console.log(`\n[STAGE 1] Promoted: ${stage1.promoted.join(", ")}`);
  const stage2 = runner.runStage2(stage1.promoted);
  runner.logProgress();

  const finalPayload = runner.buildFinalPayload(stage1, stage2);
  writeJson(finalPath, finalPayload);
  writeJson(partialPath, { ...finalPayload, status: "completed" });

  const best = finalPayload.bestUnderRiskConstraint ?? finalPayload.bestOverallByScore;
  console.log("\n=== SEARCH COMPLETE ===\n");
  console.log(`Tested: ${finalPayload.testedVariants} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(`Passed risk constraint: ${finalPayload.anyPassedRiskConstraint}`);
  if (best) {
    const m = best.metrics;
    console.log(`Best: ${best.strategyName}`);
    console.log(`  monthlyVolume=${m.totalMonthlyNotionalVolume.toFixed(0)} totalNotional=${m.totalNotionalVolume.toFixed(0)}`);
    console.log(`  endBalance=${m.endBalance} netPnL=${m.netPnL} DD=${m.maxDrawdownPct}%`);
    console.log(`  trades=${m.tradesCount} (${m.tradesPerDay.toFixed(1)}/day) PF=${m.profitFactor}`);
    console.log(`  params=${JSON.stringify(best.params)}`);
  }
  console.log(`\n  ${finalPath}\n`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
