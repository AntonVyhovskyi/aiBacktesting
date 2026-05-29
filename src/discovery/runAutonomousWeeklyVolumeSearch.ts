import "dotenv/config";
import path from "node:path";
import { loadOrDownloadO1MinuteCandles, CacheMissingError } from "../backtest/fetchO1Candles.js";
import { filterCandlesByRange, resolveStrategyCandles } from "../backtest/candleTimeframe.js";
import { buildDiscoveryIndicatorCache } from "./indicatorCache.js";
import { writeJson } from "./progressive/output.js";
import { formatDuration } from "./progressive/logFormat.js";
import { AutonomousSearchRunner, mergeMergedIndicatorReq } from "./autonomousSearchRunner.js";
import { formatTargetCheckLine } from "./weeklyVolumeEvaluation.js";
import type { DiscoveryRunConfig } from "./types.js";

const num = (v: string | undefined, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const bool = (v: string | undefined, fb: boolean) =>
  !v ? fb : v === "1" || v.toLowerCase() === "true";

const main = async () => {
  const outputDir = path.resolve(process.env.BACKTEST_OUTPUT_DIR ?? "data/results");
  const partialPath = path.join(outputDir, "autonomous-weekly-volume-search.partial.json");
  const finalPath = path.join(outputDir, "autonomous-weekly-volume-search-final.json");

  const symbol = process.env.O1_SYMBOL ?? "SOLUSD";
  const marketId = num(process.env.O1_MARKET_ID, 2);
  const backtestDays = num(process.env.BACKTEST_DAYS, 30);
  const startBalance = num(process.env.BACKTEST_INITIAL_BALANCE, 100);
  const maxVariants = num(process.env.AUTONOMOUS_MAX_VARIANTS, 100_000);
  const maxRuntimeMinutes = num(process.env.AUTONOMOUS_MAX_RUNTIME_MIN, 180);
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
  if (process.env.BACKTEST_MAX_CANDLES && Number(process.env.BACKTEST_MAX_CANDLES) > 0) {
    console.warn(
      `[AUTONOMOUS] Ignoring BACKTEST_MAX_CANDLES — using full ${candles.length} cached candles`
    );
  }

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
  const runner = new AutonomousSearchRunner(
    config,
    cache,
    rangeStart,
    rangeEnd,
    { maxVariants, maxRuntimeMs: maxRuntimeMinutes * 60_000 },
    partialPath,
    num(process.env.AUTONOMOUS_LOG_EVERY, 25),
    num(process.env.AUTONOMOUS_SAVE_EVERY, 50),
    num(process.env.AUTONOMOUS_KEEP_TOP, 15),
    (process.env.AUTONOMOUS_DISCOVERY_MODE as "quick" | "fast") ?? "fast"
  );

  console.log("\n=== AUTONOMOUS WEEKLY USDC VOLUME SEARCH ===\n");
  console.log(`Symbol: ${symbol} | Candles: ${candles.length} | Balance: ${startBalance} USDC`);
  console.log(`Target: >=10,000 USDC avg weekly notional | >=2 trades/day | netPnL>=0 preferred`);
  console.log(`Budget: ${maxVariants} variants | ${maxRuntimeMinutes} min max`);
  console.log(`Partial: ${partialPath}`);
  console.log(`Final:   ${finalPath}\n`);

  const t0 = Date.now();
  const stage1 = runner.runStage1();
  console.log(`\n[STAGE 1] Promoted families (${stage1.promoted.length}): ${stage1.promoted.join(", ")}`);

  const stage2 = runner.runStage2(stage1.promoted);
  runner.logProgress();

  const finalPayload = runner.buildFinalPayload(stage1, stage2);
  writeJson(finalPath, finalPayload);
  writeJson(partialPath, { ...finalPayload, status: finalPayload.targetAchieved ? "target_achieved" : "completed" });

  console.log("\n=== AUTONOMOUS SEARCH COMPLETE ===\n");
  console.log(`Target achieved: ${finalPayload.targetAchieved}`);
  console.log(`Tested: ${finalPayload.testedVariants} variants in ${formatDuration(Date.now() - t0)}`);
  if (finalPayload.bestStrategy) {
    const b = finalPayload.bestStrategy;
    console.log(`Best: ${b.strategyName}`);
    console.log(`  avgWeeklyNotional=${b.averageWeeklyNotionalVolume.toFixed(0)} USDC`);
    console.log(`  netPnL=${b.metrics.netPnL} | fees=${b.metrics.totalFees} | DD=${b.metrics.maxDrawdownPct}%`);
    console.log(`  trades/day=${b.metrics.tradesPerDay} | PF=${b.metrics.profitFactor}`);
    const fullWeeks = b.weekly?.filter((w: { isFullWeek: boolean }) => w.isFullWeek).length ?? 0;
    console.log(`  stable weeks=${b.nearBreakevenOrProfitableWeeks}/${fullWeeks}`);
    console.log(`  passesHardTarget=${b.passesHardTarget}`);
    if (b.targetCheck) console.log(`  ${formatTargetCheckLine(b.targetCheck)}`);
    const issues = (b as { fallbackIssues?: string[] }).fallbackIssues;
    if (issues?.length) console.log(`  issues: ${issues.join(", ")}`);
    if (b.tradeHistoryPath) console.log(`  trades: ${b.tradeHistoryPath}`);
    if (b.equityCurvePath) console.log(`  equity: ${b.equityCurvePath}`);
  } else {
    console.log("No viable strategy found.");
  }
  console.log(`\nFinal: ${finalPath}\n`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
