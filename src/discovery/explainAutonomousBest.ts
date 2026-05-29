import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { loadOrDownloadO1MinuteCandles, CacheMissingError } from "../backtest/fetchO1Candles.js";
import { filterCandlesByRange, resolveStrategyCandles } from "../backtest/candleTimeframe.js";
import { buildDiscoveryIndicatorCache } from "./indicatorCache.js";
import { mergeParams } from "./grids.js";
import { ALL_STRATEGIES } from "./strategies/registry.js";
import { COMMON_DEFAULTS } from "./strategies/phasedGrids.js";
import { exportArtifacts } from "./progressive/output.js";
import {
  evaluateAutonomousVariant,
  buildTargetCheck,
  formatTargetCheckLine,
  evaluationSummary,
  type AutonomousEvaluation,
} from "./weeklyVolumeEvaluation.js";
import type { DiscoveryTrade } from "./types.js";

const num = (v: string | undefined, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const bool = (v: string | undefined, fb: boolean) =>
  !v ? fb : v === "1" || v.toLowerCase() === "true";

type PartialCandidate = ReturnType<typeof evaluationSummary> & {
  weeklyVolumeTargetScore?: number;
};

type PartialFile = {
  generatedAt: string;
  status: string;
  targetRequirements: Record<string, unknown>;
  progress: {
    bestStrategy: string;
    bestParams: Record<string, number | string>;
    bestWeeklyVolume: number;
    bestNetPnL: number;
    bestDrawdown: number;
    stableWeeks: string;
    targetAchieved: boolean;
    tested: number;
    maxVariants: number;
    progressPct: number;
  };
  currentBestTargetCheck?: import("./weeklyVolumeEvaluation.js").TargetCheck | null;
  topOverall: PartialCandidate[];
  topHighVolume: PartialCandidate[];
  topStable: PartialCandidate[];
  topFeeEfficient: PartialCandidate[];
  topFallback: PartialCandidate[];
};

const paramsMatch = (
  a: Record<string, number | string>,
  b: Record<string, number | string>
): boolean => JSON.stringify(a) === JSON.stringify(b);

const findCandidate = (
  lists: PartialCandidate[][],
  strategyName: string,
  params?: Record<string, number | string>
): PartialCandidate | undefined => {
  for (const list of lists) {
    for (const c of list) {
      if (c.strategyName !== strategyName) continue;
      if (!params || paramsMatch(c.params, params)) return c;
    }
  }
  return undefined;
};

const buildDailyMetrics = (trades: DiscoveryTrade[]) => {
  const byDay = new Map<
    string,
    {
      date: string;
      tradesCount: number;
      notionalVolumeUsdc: number;
      grossPnL: number;
      totalFees: number;
      netPnL: number;
      wins: number;
      losses: number;
    }
  >();
  for (const t of trades) {
    const date = new Date(t.entryTime).toISOString().slice(0, 10);
    const row = byDay.get(date) ?? {
      date,
      tradesCount: 0,
      notionalVolumeUsdc: 0,
      grossPnL: 0,
      totalFees: 0,
      netPnL: 0,
      wins: 0,
      losses: 0,
    };
    row.tradesCount += 1;
    row.notionalVolumeUsdc += t.qty * t.entryPrice + t.qty * t.exitPrice;
    row.grossPnL += t.grossPnL;
    row.totalFees += t.fees;
    row.netPnL += t.netPnL;
    if (t.netPnL > 0) row.wins += 1;
    else row.losses += 1;
    byDay.set(date, row);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => ({
      ...v,
      notionalVolumeUsdc: Math.round(v.notionalVolumeUsdc * 1e6) / 1e6,
      grossPnL: Math.round(v.grossPnL * 1e6) / 1e6,
      totalFees: Math.round(v.totalFees * 1e6) / 1e6,
      netPnL: Math.round(v.netPnL * 1e6) / 1e6,
    }));
};

const tradeSummary = (t: DiscoveryTrade) => ({
  direction: t.direction,
  entryTime: new Date(t.entryTime).toISOString(),
  exitTime: new Date(t.exitTime).toISOString(),
  entryPrice: t.entryPrice,
  exitPrice: t.exitPrice,
  qty: t.qty,
  notionalUsdc: Math.round((t.qty * t.entryPrice + t.qty * t.exitPrice) * 1e6) / 1e6,
  grossPnL: t.grossPnL,
  fees: t.fees,
  netPnL: t.netPnL,
  exitReason: t.exitReason,
  durationCandles: t.durationCandles,
});

const enrichCandidate = (
  partial: PartialCandidate,
  evaluation: AutonomousEvaluation,
  trades: DiscoveryTrade[],
  paths: { tradeHistoryPath: string; equityCurvePath: string },
  rangeStart: number,
  rangeEnd: number
) => {
  const sorted = [...trades].sort((a, b) => b.netPnL - a.netPnL);
  const targetCheck = buildTargetCheck(evaluation);
  return {
    strategyName: partial.strategyName,
    params: partial.params,
    sourcePartial: {
      weeklyVolumeTargetScore: partial.weeklyVolumeTargetScore,
      passesHardTarget: partial.passesHardTarget,
      passesFallbackTarget: partial.passesFallbackTarget,
      hardTargetFailures: partial.hardTargetFailures,
      rejected: partial.rejected,
      rejectReasons: partial.rejectReasons,
    },
    targetAchieved: targetCheck.finalTargetAchieved,
    targetAchievedFalseReason: targetCheck.finalTargetAchieved
      ? null
      : targetCheck.failedReasons.join("; "),
    targetCheck,
    targetCheckConsoleLine: formatTargetCheckLine(targetCheck),
    metrics: evaluation.metrics,
    summary: {
      totalNotionalVolumeUsdc: evaluation.metrics.totalNotional,
      averageWeeklyNotionalVolume: evaluation.averageWeeklyNotionalVolume,
      averageTradesPerDay: evaluation.averageTradesPerDay,
      grossPnL: evaluation.metrics.grossPnL,
      totalFees: evaluation.metrics.totalFees,
      netPnL: evaluation.metrics.netPnL,
      netPnLPct: evaluation.metrics.netPnLPct,
      profitFactor: evaluation.metrics.profitFactor,
      maxDrawdownPct: evaluation.metrics.maxDrawdownPct,
      maxWeeklyDrawdownPct: evaluation.maxWeeklyDrawdownPct,
      winRate: evaluation.metrics.winRate,
      tradesCount: evaluation.metrics.tradesCount,
      tradesPerDay: evaluation.metrics.tradesPerDay,
      profitableWeeks: evaluation.profitableWeeks,
      losingWeeks: evaluation.losingWeeks,
      nearBreakevenOrProfitableWeeks: evaluation.nearBreakevenOrProfitableWeeks,
      weeklyVolumeTargetScore: evaluation.weeklyVolumeTargetScore,
    },
    weekly: evaluation.weekly,
    daily: buildDailyMetrics(trades),
    bestTrades: sorted.slice(0, 5).map(tradeSummary),
    worstTrades: sorted.slice(-5).reverse().map(tradeSummary),
    tradeHistoryPath: paths.tradeHistoryPath,
    equityCurvePath: paths.equityCurvePath,
    diagnosticsNote:
      "Full trade list in tradeHistoryPath. Recomputed on export from cached 30d candles.",
    candleRange: {
      start: new Date(rangeStart).toISOString(),
      end: new Date(rangeEnd - 1).toISOString(),
    },
  };
};

const mdSection = (title: string, body: string) => `## ${title}\n\n${body}\n`;

const main = async () => {
  const outputDir = path.resolve(process.env.BACKTEST_OUTPUT_DIR ?? "data/results");
  const partialPath = path.join(outputDir, "autonomous-weekly-volume-search.partial.json");
  const mdPath = path.join(outputDir, "best-autonomous-candidate-summary.md");
  const jsonPath = path.join(outputDir, "best-autonomous-candidate-full.json");

  if (!fs.existsSync(partialPath)) {
    console.error(`Missing ${partialPath} — run autonomous-search first.`);
    process.exit(1);
  }

  const partial = JSON.parse(fs.readFileSync(partialPath, "utf8")) as PartialFile;
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

  const primaryPartial =
    findCandidate(
      [partial.topOverall],
      partial.progress.bestStrategy,
      partial.progress.bestParams
    ) ?? partial.topOverall[0];

  if (!primaryPartial) {
    console.error("No candidates in partial file.");
    process.exit(1);
  }

  const highVolPartial =
    partial.topHighVolume.find((c) => c.strategyName === "BOLLINGER_MEAN_REVERSION") ??
    partial.topHighVolume[0];

  const runExport = (candidate: PartialCandidate) => {
    const strategy = ALL_STRATEGIES.find((s) => s.strategyName === candidate.strategyName)!;
    const params = mergeParams(strategy.defaults, COMMON_DEFAULTS, candidate.params);
    const cache = buildDiscoveryIndicatorCache(candles, strategy.indicatorReq);
    const result = strategy.run({
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
    const evaluation = evaluateAutonomousVariant(result, rangeStart, rangeEnd, startBalance);
    const paths = exportArtifacts(result, outputDir);
    return enrichCandidate(candidate, evaluation, result.trades, paths, rangeStart, rangeEnd);
  };

  const primary = runExport(primaryPartial);
  const highVolumeVariant =
    highVolPartial && !paramsMatch(highVolPartial.params, primaryPartial.params)
      ? runExport(highVolPartial)
      : null;

  const payload = {
    exportedAt: new Date().toISOString(),
    partialSource: {
      path: partialPath,
      generatedAt: partial.generatedAt,
      status: partial.status,
      searchProgress: partial.progress,
      targetRequirements: partial.targetRequirements,
    },
    primaryBest: primary,
    highVolumeBollingerVariant: highVolumeVariant,
    allTopListsCounts: {
      topOverall: partial.topOverall.length,
      topHighVolume: partial.topHighVolume.length,
      topStable: partial.topStable.length,
      topFeeEfficient: partial.topFeeEfficient.length,
      topFallback: partial.topFallback.length,
    },
    note:
      "progress.bestWeeklyVolume may reflect topHighVolume leader, not primaryBest (score-ranked). Both are exported when they differ.",
  };

  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));

  const md = [
    "# Best Autonomous Search Candidate Export",
    "",
    `Exported: ${payload.exportedAt}`,
    `Partial snapshot: ${partial.generatedAt} (${partial.status}, ${partial.progress.tested}/${partial.progress.maxVariants} variants)`,
    "",
    mdSection(
      "Primary best (overall score)",
      [
        `**Strategy:** ${primary.strategyName}`,
        `**Target achieved:** ${primary.targetAchieved}`,
        `**Why not achieved:** ${primary.targetAchievedFalseReason ?? "n/a"}`,
        "",
        "```",
        primary.targetCheckConsoleLine,
        "```",
        "",
        "### Params",
        "```json",
        JSON.stringify(primary.params, null, 2),
        "```",
        "",
        "### Key metrics",
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Avg weekly notional (USDC) | ${primary.summary.averageWeeklyNotionalVolume.toLocaleString()} |`,
        `| Total notional (USDC) | ${primary.summary.totalNotionalVolumeUsdc.toLocaleString()} |`,
        `| Net PnL | ${primary.summary.netPnL} USDC (${primary.summary.netPnLPct}%) |`,
        `| Gross PnL | ${primary.summary.grossPnL} |`,
        `| Total fees | ${primary.summary.totalFees} |`,
        `| Profit factor | ${primary.summary.profitFactor} |`,
        `| Max drawdown | ${primary.summary.maxDrawdownPct}% |`,
        `| Win rate | ${primary.summary.winRate}% |`,
        `| Trades | ${primary.summary.tradesCount} (${primary.summary.tradesPerDay.toFixed(2)}/day) |`,
        `| Stable weeks | ${primary.summary.nearBreakevenOrProfitableWeeks} profitable/near-breakeven |`,
        "",
        "### Failed requirements",
        primary.targetCheck.failedReasons.length
          ? primary.targetCheck.failedReasons.map((r) => `- ${r}`).join("\n")
          : "_None — all hard targets passed._",
        "",
        "### Weekly breakdown",
        primary.weekly
          .map(
            (w) =>
              `- **W${w.weekIndex}** ${w.startTime.slice(0, 10)} → ${w.endTime.slice(0, 10)}: ` +
              `trades=${w.tradesCount} notional=${w.notionalVolumeUsdc.toFixed(0)} net=${w.netPnL.toFixed(2)} fees=${w.totalFees.toFixed(2)} dd=${w.maxDrawdownPct.toFixed(1)}%`
          )
          .join("\n"),
        "",
        "### Artifacts",
        `- Trades: \`${primary.tradeHistoryPath}\``,
        `- Equity: \`${primary.equityCurvePath}\``,
      ].join("\n")
    ),
  ];

  if (highVolumeVariant) {
    md.push(
      mdSection(
        "BOLLINGER high-weekly-volume variant (topHighVolume #1)",
        [
          `**Note:** This variant drives \`progress.bestWeeklyVolume=${partial.progress.bestWeeklyVolume.toFixed(0)}\` but has poor PnL.`,
          `**Net PnL:** ${highVolumeVariant.summary.netPnL} | **PF:** ${highVolumeVariant.summary.profitFactor}`,
          "",
          "```",
          highVolumeVariant.targetCheckConsoleLine,
          "```",
          "",
          `Failed: ${highVolumeVariant.targetAchievedFalseReason}`,
        ].join("\n")
      )
    );
  }

  md.push(
    mdSection("Full data", `See \`${jsonPath}\` for complete metrics, daily breakdown, best/worst trades, and targetCheck.`)
  );

  fs.writeFileSync(mdPath, md.join("\n"));

  console.log("\n=== BEST AUTONOMOUS CANDIDATE EXPORT ===\n");
  console.log(`Primary: ${primary.strategyName}`);
  console.log(`  avgWeeklyNotional=${primary.summary.averageWeeklyNotionalVolume.toFixed(0)} USDC`);
  console.log(`  totalNotional=${primary.summary.totalNotionalVolumeUsdc.toFixed(0)} USDC`);
  console.log(`  netPnL=${primary.summary.netPnL} | gross=${primary.summary.grossPnL} | fees=${primary.summary.totalFees}`);
  console.log(`  PF=${primary.summary.profitFactor} | DD=${primary.summary.maxDrawdownPct}% | trades=${primary.summary.tradesCount}`);
  console.log(`  targetAchieved=${primary.targetAchieved}`);
  console.log(`  ${primary.targetCheckConsoleLine}`);
  if (highVolumeVariant) {
    console.log(`\nHigh-volume BOLLINGER variant (different params):`);
    console.log(`  avgWeeklyNotional=${highVolumeVariant.summary.averageWeeklyNotionalVolume.toFixed(0)} USDC`);
    console.log(`  netPnL=${highVolumeVariant.summary.netPnL} | ${highVolumeVariant.targetCheckConsoleLine}`);
  }
  console.log(`\n  ${mdPath}`);
  console.log(`  ${jsonPath}\n`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
