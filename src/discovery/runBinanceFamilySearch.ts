import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import {
  BINANCE_FUTURES_SOURCE,
  loadBinanceFuturesCandles,
  downloadBinanceFuturesCandles,
  BinanceCacheMissingError,
} from "../backtest/fetchBinanceFuturesCandles.js";
import { resolveStrategyCandles } from "../backtest/candleTimeframe.js";
import { formatQualityReport } from "../backtest/candleValidate.js";
import type { NormalizedCandle } from "../backtest/types.js";
import { buildDiscoveryIndicatorCache } from "./indicatorCache.js";
import { cartesian, mergeParams, countGrid } from "./grids.js";
import { BINANCE_STRATEGY_FAMILIES } from "./families/binanceFamilyRegistry.js";
import { emaAtrWinnerLegacyFamily } from "./strategies/families/emaAtrWinnerLegacy.js";

const ALL_FAMILIES = [...BINANCE_STRATEGY_FAMILIES, emaAtrWinnerLegacyFamily];
import type { FamilyStrategyPack } from "./strategies/families/familyKit.js";
import {
  buildRollingWalkForwardSlices,
  evaluateWalkForwardWindow,
  type WalkForwardWindowResult,
} from "./regime/walkForward.js";
import {
  scoreWalkForwardCandidate,
  classifyCandidate,
  type CandidateScore,
} from "./regime/adaptiveScoring.js";
import { formatMetricsTable } from "./regime/regimeBacktestMetrics.js";
import type { StrategyBacktestResult, StrategyContext } from "./types.js";

const num = (v: string | undefined, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const TARGET_MONTHLY = num(process.env.FAMILY_TARGET_MONTHLY_PCT, 10);
const TARGET_DD = num(process.env.FAMILY_TARGET_MAX_DD_PCT, 5);
const MIN_COVERAGE = num(process.env.BINANCE_MIN_COVERAGE_PCT, 90);
const DEFAULT_SYMBOLS = "SOLUSDT,ETHUSDT";

type VariantResult = {
  familyId: string;
  familyLabel: string;
  symbol: string;
  timeframe: string;
  params: Record<string, number | string>;
  score: CandidateScore;
  bucket: ReturnType<typeof classifyCandidate>;
  windows: WalkForwardWindowResult[];
};

const alignBtcToSymbol = (symbolCandles: NormalizedCandle[], btc: NormalizedCandle[]): NormalizedCandle[] => {
  const map = new Map(btc.map((c) => [c.openTime, c]));
  return symbolCandles.map((s) => {
    const b = map.get(s.openTime);
    if (!b) {
      return { ...s, open: NaN, high: NaN, low: NaN, close: NaN, volume: 0 };
    }
    return b;
  });
};

const runBacktest = (
  family: FamilyStrategyPack,
  candles: NormalizedCandle[],
  params: Record<string, number | string>,
  start: number,
  end: number,
  balance: number,
  feeRate: number,
  entryMode: "close" | "nextOpen",
  btcCache?: ReturnType<typeof buildDiscoveryIndicatorCache>
): StrategyBacktestResult => {
  const slice = candles.filter((c) => c.openTime >= start && c.openTime < end);
  const cache = buildDiscoveryIndicatorCache(slice, family.strategy.indicatorReq);
  const ctx: StrategyContext = {
    candles: slice,
    cache,
    params: mergeParams(family.strategy.defaults, params),
    initialBalance: balance,
    entryMode,
    feeRate,
    leverage: num(process.env.BACKTEST_LEVERAGE, 3),
    riskPct: num(process.env.BACKTEST_RISK_PCT, 0.5),
    backtestMsSpan: end - start,
    btcCache,
  };
  return family.strategy.run(ctx);
};

const main = async () => {
  const outputDir = path.resolve(process.env.BACKTEST_OUTPUT_DIR ?? "data/results");
  const cacheDir = path.resolve(process.env.BACKTEST_CACHE_DIR ?? "data/cache");
  const months = num(process.env.BACKTEST_MONTHS, 12);
  const symbols = (process.env.ADAPTIVE_SYMBOLS ?? DEFAULT_SYMBOLS).split(",").map((s) => s.trim());
  const timeframes = (process.env.ADAPTIVE_TIMEFRAMES ?? "1m,3m").split(",").map((s) => s.trim());
  const wfWindows = num(process.env.ADAPTIVE_WF_WINDOWS, 4);
  const startBalance = num(process.env.BACKTEST_INITIAL_BALANCE, 100);
  const feeRate = num(process.env.BACKTEST_FEE_RATE, 0.00035);
  const entryMode = process.env.BACKTEST_ENTRY_MODE === "close" ? "close" : "nextOpen";
  const downloadBtc = process.env.FAMILY_DOWNLOAD_BTC !== "0";

  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n=== BINANCE FAMILY SEARCH ===`);
  console.log(`source=${BINANCE_FUTURES_SOURCE}`);
  const familyFilter = (process.env.FAMILY_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const families =
    familyFilter.length > 0
      ? ALL_FAMILIES.filter((f) => familyFilter.includes(f.familyId))
      : BINANCE_STRATEGY_FAMILIES;

  console.log(`Families: ${families.length} | WF windows: ${wfWindows}\n`);

  let btcMinute: NormalizedCandle[] | null = null;
  if (downloadBtc) {
    try {
      let btcLoad = await loadBinanceFuturesCandles("BTCUSDT", { cacheDir, months, minCoveragePct: MIN_COVERAGE });
      if (!btcLoad.quality.reliable) {
        console.log("[BTC] refreshing BTCUSDT cache...");
        btcLoad = await downloadBinanceFuturesCandles("BTCUSDT", "1m", {
          cacheDir,
          months,
          forceRefresh: true,
          minCoveragePct: MIN_COVERAGE,
        });
      }
      if (!btcLoad.quality.reliable) {
        console.warn("[WARN] BTCUSDT data unreliable — trend+BTC family will be skipped");
      } else {
        btcMinute = btcLoad.candles;
        console.log(`[BTC] loaded ${btcMinute.length} candles for filter\n`);
      }
    } catch (e) {
      if (e instanceof BinanceCacheMissingError) {
        console.log("[BTC] downloading BTCUSDT...");
        try {
          const btcLoad = await downloadBinanceFuturesCandles("BTCUSDT", "1m", {
            cacheDir,
            months,
            forceRefresh: true,
            minCoveragePct: MIN_COVERAGE,
          });
          if (btcLoad.quality.reliable) {
            btcMinute = btcLoad.candles;
            console.log(`[BTC] loaded ${btcMinute.length} candles\n`);
          }
        } catch (e2) {
          console.warn("[WARN] BTCUSDT download failed:", e2);
        }
      } else {
        console.warn("[WARN] BTCUSDT not available:", e);
      }
    }
  }

  const allResults: VariantResult[] = [];
  const qualityLines: string[] = [];

  for (const symbol of symbols) {
    let load;
    try {
      load = await loadBinanceFuturesCandles(symbol, { cacheDir, months, minCoveragePct: MIN_COVERAGE });
    } catch (e) {
      if (e instanceof BinanceCacheMissingError) {
        console.error(`[SKIP] ${symbol}: ${e.message}`);
        continue;
      }
      throw e;
    }
    if (!load.quality.reliable) {
      console.warn(`[SKIP] ${symbol}: coverage ${load.quality.coveragePct}% < ${MIN_COVERAGE}%`);
      continue;
    }
    qualityLines.push(formatQualityReport(load.quality));

    const btcAligned = btcMinute ? alignBtcToSymbol(load.candles, btcMinute) : null;

    for (const timeframe of timeframes) {
      const candles = resolveStrategyCandles(load.candles, timeframe);
      const btcForTf =
        btcAligned && timeframe !== "1m" ? resolveStrategyCandles(btcAligned, timeframe) : btcAligned;
      const rangeStart = candles[0]!.openTime;
      const rangeEnd = (candles[candles.length - 1]?.closeTime ?? Date.now()) + 1;
      const slices = buildRollingWalkForwardSlices(rangeStart, rangeEnd, wfWindows);
      const btcCacheFull =
        btcForTf && btcForTf.some((c) => Number.isFinite(c.close))
          ? buildDiscoveryIndicatorCache(btcForTf, { emaPeriods: [8, 12, 26, 34, 50] })
          : undefined;

      for (const family of families) {
        if (family.familyId === "trend_btc_filter" && !btcCacheFull) continue;

        const grid = family.searchGrid;
        const combos = cartesian(grid);
        console.log(
          `\n[${family.familyId}] ${symbol} ${timeframe} — ${combos.length} variants (grid size ${countGrid(grid)})`
        );

        let best: VariantResult | null = null;

        for (let vi = 0; vi < combos.length; vi++) {
          const params = combos[vi]!;
          let windows: WalkForwardWindowResult[];
          try {
          windows = slices.map((slice) => {
            const train = runBacktest(
              family,
              candles,
              params,
              slice.trainStart,
              slice.trainEnd,
              startBalance,
              feeRate,
              entryMode,
              btcCacheFull
            );
            const val = runBacktest(
              family,
              candles,
              params,
              slice.trainEnd,
              slice.valEnd,
              startBalance,
              feeRate,
              entryMode,
              btcCacheFull
            );
            const oos = runBacktest(
              family,
              candles,
              params,
              slice.valEnd,
              slice.oosEnd,
              startBalance,
              feeRate,
              entryMode,
              btcCacheFull
            );
            return evaluateWalkForwardWindow(symbol, train, val, oos, slice, startBalance);
          });
          } catch (e) {
            console.warn(`  [variant ${vi + 1}] failed:`, e instanceof Error ? e.message : e);
            continue;
          }

          const score = scoreWalkForwardCandidate(windows, { minOosTrades: 30, minPositiveWindows: 2 });
          const bucket = classifyCandidate(score, TARGET_MONTHLY, TARGET_DD);
          const row: VariantResult = {
            familyId: family.familyId,
            familyLabel: family.label,
            symbol,
            timeframe,
            params,
            score,
            bucket,
            windows,
          };
          allResults.push(row);
          if (!best || score.composite > best.score.composite) best = row;

          if ((vi + 1) % 8 === 0 || vi === combos.length - 1) {
            process.stdout.write(
              `  [${vi + 1}/${combos.length}] bestOos=${best.score.avgOosMonthlyPct.toFixed(2)}% dd=${best.score.avgOosDdPct.toFixed(2)}% trades=${best.score.totalOosTrades}\r`
            );
          }
        }
        console.log("");

        if (best) {
          console.log(
            `  → best: OOS ${best.score.avgOosMonthlyPct.toFixed(2)}%/mo | DD ${best.score.avgOosDdPct.toFixed(2)}% | PF ${best.score.avgOosPf.toFixed(2)} | trades ${best.score.totalOosTrades} | worst mo ${best.score.worstOosMonthPct.toFixed(2)}% | ${best.score.rejected ? `REJECT (${best.score.rejectReasons.join(",")})` : best.bucket}`
          );
          console.log(formatMetricsTable(best.windows.map((w) => w.outOfSample)));
        }
      }
    }
  }

  const byFamily = new Map<string, VariantResult[]>();
  for (const r of allResults) {
    const k = `${r.familyId}|${r.symbol}|${r.timeframe}`;
    const prev = byFamily.get(k) ?? [];
    prev.push(r);
    byFamily.set(k, prev);
  }

  const familyBest = [...byFamily.entries()].map(([k, rows]) => {
    const best = rows.reduce((a, b) => (b.score.composite > a.score.composite ? b : a));
    return { key: k, best };
  });

  const familyLeaderboard = [...familyBest]
    .map((x) => x.best)
    .sort((a, b) => b.score.composite - a.score.composite);

  const pickPool = (pred: (r: VariantResult) => boolean) => {
    const pool = familyLeaderboard.filter(pred);
    if (!pool.length) return null;
    return pool.reduce((a, b) => (b.score.composite > a.score.composite ? b : a));
  };

  const targetHit = familyLeaderboard.some((r) => r.bucket === "target" && !r.score.rejected);
  const stable = pickPool((r) => r.score.avgOosDdPct <= TARGET_DD * 1.2 && r.score.avgOosMonthlyPct >= 1);
  const bestReturn = pickPool(() => true);
  const bestDd = familyLeaderboard.reduce<VariantResult | null>(
    (a, b) => (!a || b.score.avgOosDdPct < a.score.avgOosDdPct ? b : a),
    null
  );
  const bestTrades = familyLeaderboard.reduce<VariantResult | null>(
    (a, b) => (!a || b.score.totalOosTrades > a.score.totalOosTrades ? b : a),
    null
  );

  const tableRow = (r: VariantResult) =>
    `| ${r.familyLabel} | ${r.symbol} | ${r.timeframe} | ${r.score.composite.toFixed(1)} | ${r.score.avgOosMonthlyPct.toFixed(2)} | ${r.score.worstOosMonthPct.toFixed(2)} | ${r.score.avgOosDdPct.toFixed(2)} | ${r.score.avgOosPf.toFixed(2)} | ${r.score.totalOosTrades} | ${r.score.oosWindowsPositive}/${wfWindows} | ${r.score.rejected ? r.score.rejectReasons.join(";") : r.bucket} |`;

  const md = [
    "# Binance Family Search Report",
    "",
    `Source: **${BINANCE_FUTURES_SOURCE}**`,
    `Generated: ${new Date().toISOString()}`,
    `Months: ${months} | Symbols: ${symbols.join(", ")} | TF: ${timeframes.join(", ")}`,
    "",
    "## Data quality",
    "",
    ...qualityLines,
    "",
    "## Target",
    "",
    `- OOS avg monthly ≥ **${TARGET_MONTHLY}%**`,
    `- OOS max DD ≤ **${TARGET_DD}%**`,
    `- Ranked by **walk-forward OOS** (not train)`,
    "",
    `**Primary target met:** ${targetHit ? "YES (at least one family)" : "**NO**"}`,
    "",
    "## Family leaderboard (best variant per family × symbol × TF)",
    "",
    "| Family | Symbol | TF | Score | OOS avg mo % | Worst mo % | OOS DD % | PF | Trades | +WF | Status |",
    "|--------|--------|-----|------:|-------------:|-----------:|---------:|---:|-------:|----:|--------|",
    ...familyLeaderboard.map(tableRow),
    "",
    "## Walk-forward (top 5 by OOS score)",
    "",
    ...familyLeaderboard.slice(0, 5).flatMap((r) => [
      `### ${r.familyLabel} — ${r.symbol} ${r.timeframe}`,
      "",
      "| W | Train % | Val % | OOS % | OOS DD % | Trades |",
      "|--:|--------:|------:|------:|---------:|-------:|",
      ...r.windows.map((w) => {
        const tr = w.train.metrics.netPnLPct;
        const va = w.validation.metrics.netPnLPct;
        const oo = w.outOfSample.metrics.netPnLPct;
        return `| ${w.slice.windowIndex} | ${tr.toFixed(2)} | ${va.toFixed(2)} | ${oo.toFixed(2)} | ${w.outOfSample.metrics.maxDrawdownPct.toFixed(2)} | ${w.outOfSample.metrics.tradesCount} |`;
      }),
      "",
    ]),
    "",
    "## Secondary picks",
    "",
    stable
      ? `- **Stable low-DD:** ${stable.familyLabel} ${stable.symbol} ${stable.timeframe} — ${stable.score.avgOosMonthlyPct.toFixed(2)}%/mo, DD ${stable.score.avgOosDdPct.toFixed(2)}%`
      : "- **Stable low-DD:** none",
    bestReturn
      ? `- **Best return:** ${bestReturn.familyLabel} ${bestReturn.symbol} ${bestReturn.timeframe} — ${bestReturn.score.avgOosMonthlyPct.toFixed(2)}%/mo`
      : "- **Best return:** none",
    bestDd
      ? `- **Best drawdown:** ${bestDd.familyLabel} ${bestDd.symbol} ${bestDd.timeframe} — DD ${bestDd.score.avgOosDdPct.toFixed(2)}%`
      : "- **Best drawdown:** none",
    bestTrades
      ? `- **Best trade count:** ${bestTrades.familyLabel} ${bestTrades.symbol} ${bestTrades.timeframe} — ${bestTrades.score.totalOosTrades} OOS trades`
      : "- **Best trade count:** none",
    "",
    targetHit
      ? "At least one family variant met primary targets on walk-forward OOS."
      : `**No family met ${TARGET_MONTHLY}%/month OOS with ≤${TARGET_DD}% DD** on clean Binance 12m data. Adaptive-regime was correctly rejected; these classic families do not rescue the target on this run.`,
  ].join("\n");

  const reportPath = path.join(outputDir, "binance-family-search-report.md");
  const jsonPath = path.join(outputDir, "binance-family-search-results.json");
  fs.writeFileSync(reportPath, md);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        source: BINANCE_FUTURES_SOURCE,
        generatedAt: new Date().toISOString(),
        targetMet: targetHit,
        targetMonthly: TARGET_MONTHLY,
        targetMaxDd: TARGET_DD,
        familyLeaderboard: familyLeaderboard.map((r) => ({
          familyId: r.familyId,
          familyLabel: r.familyLabel,
          symbol: r.symbol,
          timeframe: r.timeframe,
          params: r.params,
          score: r.score,
          bucket: r.bucket,
          oosWindows: r.windows.map((w) => ({
            window: w.slice.windowIndex,
            trainPct: w.train.metrics.netPnLPct,
            valPct: w.validation.metrics.netPnLPct,
            oosPct: w.outOfSample.metrics.netPnLPct,
            oosDd: w.outOfSample.metrics.maxDrawdownPct,
            oosTrades: w.outOfSample.metrics.tradesCount,
            oosAvgMonth: w.outOfSample.averageMonthlyReturnPct,
            oosWorstMonth: w.outOfSample.worstMonthReturnPct,
            oosPf: w.outOfSample.metrics.profitFactor,
          })),
        })),
        secondary: {
          stable: stable?.familyId ?? null,
          bestReturn: bestReturn?.familyId ?? null,
          bestDrawdown: bestDd?.familyId ?? null,
          bestTrades: bestTrades?.familyId ?? null,
        },
      },
      null,
      2
    )
  );

  console.log("\n=== COMPLETE ===\n");
  console.log(`source=${BINANCE_FUTURES_SOURCE}`);
  console.log(`Target met: ${targetHit}`);
  console.log(`Report: ${reportPath}`);
  console.log(`JSON: ${jsonPath}\n`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
