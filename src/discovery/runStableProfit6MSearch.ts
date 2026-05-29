import "dotenv/config";
import path from "node:path";
import { loadSixMonthO1MinuteCandles, CacheMissingError } from "../backtest/fetchO1Candles.js";
import { resolveStrategyCandles } from "../backtest/candleTimeframe.js";
import { buildDiscoveryIndicatorCache } from "./indicatorCache.js";
import { writeJson } from "./progressive/output.js";
import { formatDuration } from "./progressive/logFormat.js";
import { StableProfitSearchRunner, mergeMergedIndicatorReq } from "./stableProfitSearchRunner.js";
import { buildStableProfitReportMd } from "./stableProfitReport.js";
import { formatTargetCheckLine } from "./stableProfitEvaluation.js";
import type { DiscoveryRunConfig } from "./types.js";

const num = (v: string | undefined, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const bool = (v: string | undefined, fb: boolean) =>
  !v ? fb : v === "1" || v.toLowerCase() === "true";

const main = async () => {
  const outputDir = path.resolve(process.env.BACKTEST_OUTPUT_DIR ?? "data/results");
  const partialPath = path.join(outputDir, "stable-profit-6m-search.partial.json");
  const finalPath = path.join(outputDir, "stable-profit-6m-search-final.json");
  const reportPath = path.join(outputDir, "stable-profit-6m-search-report.md");

  const symbol = process.env.O1_SYMBOL ?? "SOLUSD";
  const marketId = num(process.env.O1_MARKET_ID, 2);
  const backtestMonths = num(process.env.BACKTEST_MONTHS, 6);
  const startBalance = num(process.env.BACKTEST_INITIAL_BALANCE, 100);
  const maxVariants = num(process.env.STABLE_PROFIT_MAX_VARIANTS, 70_000);
  const maxRuntimeMinutes = num(process.env.STABLE_PROFIT_MAX_RUNTIME_MIN, 80);
  const keepTop = num(process.env.STABLE_PROFIT_KEEP_TOP, 5);
  const maxPromote = num(process.env.STABLE_PROFIT_MAX_PROMOTE, 2);
  const turboMode = process.env.STABLE_PROFIT_TURBO !== "false";
  const forceRefresh = bool(process.env.BACKTEST_FORCE_REFRESH, false);
  const endTimeMs = Date.now();

  let load;
  try {
    load = await loadSixMonthO1MinuteCandles(
      { webServerUrl: process.env.O1_WEB_SERVER_URL ?? "https://zo-mainnet.n1.xyz", symbol, marketId },
      {
        cacheDir: path.resolve(process.env.BACKTEST_CACHE_DIR ?? "data/cache"),
        startTimeMs: 0,
        endTimeMs,
        backtestMonths,
        countback: num(process.env.BACKTEST_COUNTBACK, 500),
        maxRetries: 5,
        retryDelayMs: 1500,
        forceRefresh,
      }
    );
  } catch (e) {
    if (e instanceof CacheMissingError) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }

  const candles = resolveStrategyCandles(load.candles, process.env.BACKTEST_TIMEFRAME ?? "1m");
  const rangeStart = candles[0]!.openTime;
  const rangeEnd = (candles[candles.length - 1]?.closeTime ?? endTimeMs) + 1;

  const config: DiscoveryRunConfig = {
    symbol,
    marketId,
    timeframe: process.env.BACKTEST_TIMEFRAME ?? "1m",
    backtestDays: backtestMonths * 30,
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
  const runner = new StableProfitSearchRunner(
    config,
    cache,
    rangeStart,
    rangeEnd,
    { maxVariants, maxRuntimeMs: maxRuntimeMinutes * 60_000 },
    partialPath,
    num(process.env.STABLE_PROFIT_LOG_EVERY, 25),
    num(process.env.STABLE_PROFIT_SAVE_EVERY, 50),
    keepTop,
    maxPromote,
    turboMode
  );

  console.log("\n=== STABLE PROFIT 6-MONTH SEARCH (TURBO) ===\n");
  console.log(`Symbol: ${symbol} | Candles: ${candles.length} | Balance: ${startBalance} USDC`);
  console.log(`Target: >=+10% net PnL EACH full calendar month | max DD <=20% | PF>=1.2`);
  console.log(`Cache: ${load.cachePath}`);
  console.log(`Turbo: ${turboMode} | Promote top ${maxPromote} families | Keep top ${keepTop}/phase`);
  console.log(`Budget: ${maxVariants} variants | ${maxRuntimeMinutes} min max`);
  console.log(`Partial: ${partialPath}`);
  console.log(`Final:   ${finalPath}`);
  console.log(`Report:  ${reportPath}\n`);

  const t0 = Date.now();
  const stage1 = runner.runStage1();
  console.log(`\n[STAGE 1] Promoted (${stage1.promoted.length}): ${stage1.promoted.join(", ")}`);

  const stage2 = runner.runStage2(stage1.promoted);
  console.log("\n[STAGE 4] Full validation (nearby variants)...");
  const stage4 = runner.runStage4Validation();
  runner.logProgress();

  const finalPayload = runner.buildFinalPayload(stage1, stage2, stage4);
  writeJson(finalPath, finalPayload);
  writeJson(partialPath, { ...finalPayload, status: finalPayload.targetAchieved ? "target_achieved" : "completed" });

  const reportMd = buildStableProfitReportMd(finalPayload, load.cachePath);
  const fs = await import("node:fs");
  fs.writeFileSync(reportPath, reportMd);

  console.log("\n=== STABLE PROFIT SEARCH COMPLETE ===\n");
  console.log(`Target achieved: ${finalPayload.targetAchieved}`);
  console.log(`Tested: ${finalPayload.testedVariants} variants in ${formatDuration(Date.now() - t0)}`);
  if (finalPayload.bestStrategy) {
    const b = finalPayload.bestStrategy;
    console.log(`Best: ${b.strategyName}`);
    console.log(`  avgMonthly=${b.averageMonthlyPnLPct?.toFixed(2)}% worstMonth=${b.worstMonthlyPnLPct?.toFixed(2)}%`);
    console.log(`  netPnL=${b.fullPeriod.totalNetPnL} | DD=${b.fullPeriod.maxDrawdownPct}% | PF=${b.fullPeriod.profitFactor}`);
    console.log(`  profitableMonths=${b.profitableMonths} months>=10%=${b.monthsMeetingTargetPct}`);
    console.log(
      `  ${formatTargetCheckLine({
        targetCheck: b.targetCheck ?? [],
      } as import("./stableProfitEvaluation.js").StableProfitEvaluation)}`
    );
    if (b.rejectionReasons?.length) console.log(`  failures: ${b.rejectionReasons.join("; ")}`);
  }
  console.log(`\nFinal: ${finalPath}\nReport: ${reportPath}\n`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
