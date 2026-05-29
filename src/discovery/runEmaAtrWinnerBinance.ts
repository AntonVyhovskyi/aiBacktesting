import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { BINANCE_FUTURES_SOURCE, loadBinanceFuturesCandles } from "../backtest/fetchBinanceFuturesCandles.js";
import { resolveStrategyCandles } from "../backtest/candleTimeframe.js";
import { formatQualityReport } from "../backtest/candleValidate.js";
import type { NormalizedCandle } from "../backtest/types.js";
import { buildDiscoveryIndicatorCache } from "./indicatorCache.js";
import { cartesian, mergeParams } from "./grids.js";
import {
  emaAtrWinnerLegacyFamily,
  emaAtrWinnerTunedFamily,
  EMA_ATR_WINNER_LEGACY_PARAMS,
  EMA_ATR_WINNER_INACTIVE_PARAMS,
} from "./strategies/families/emaAtrWinnerLegacy.js";
import { emaTrendContinuationFamily } from "./strategies/families/emaTrendContinuation.js";
import type { FamilyStrategyPack } from "./strategies/families/familyKit.js";
import {
  buildRollingWalkForwardSlices,
  evaluateWalkForwardWindow,
  type WalkForwardWindowResult,
} from "./regime/walkForward.js";
import { scoreWalkForwardCandidate, type CandidateScore } from "./regime/adaptiveScoring.js";
import { formatMetricsTable } from "./regime/regimeBacktestMetrics.js";
import type { StrategyBacktestResult, StrategyContext } from "./types.js";

const num = (v: string | undefined, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const bool = (v: string | undefined, fb: boolean) =>
  !v ? fb : v === "1" || v.toLowerCase() === "true";

const TARGET_MONTHLY = num(process.env.FAMILY_TARGET_MONTHLY_PCT, 10);
const TARGET_DD = num(process.env.FAMILY_TARGET_MAX_DD_PCT, 5);
const MIN_COVERAGE = num(process.env.BINANCE_MIN_COVERAGE_PCT, 90);
const DEFAULT_SYMBOLS = "SOLUSDT,ETHUSDT";

type RunRow = {
  label: string;
  symbol: string;
  timeframe: string;
  params: Record<string, number | string>;
  score: CandidateScore;
  windows: WalkForwardWindowResult[];
};

const O1_WINNER_SNAPSHOT = {
  source: "max-monthly-volume-10dd-search-final.json",
  symbol: "SOLUSD",
  market: "O1",
  timeframe: "1m",
  spanNote: "~30d cache, objective=max monthly notional under 10% DD (not 12m profit)",
  metrics: {
    endBalance: 91.444509,
    netPnLPct: -8.555491,
    maxDrawdownPct: 9.603529,
    tradesCount: 156,
    profitFactor: 0.823868,
  },
};

const runBacktest = (
  family: FamilyStrategyPack,
  candles: NormalizedCandle[],
  params: Record<string, number | string>,
  start: number,
  end: number,
  balance: number,
  feeRate: number,
  entryMode: "close" | "nextOpen"
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
  };
  return family.strategy.run(ctx);
};

const evaluateVariant = (
  label: string,
  family: FamilyStrategyPack,
  symbol: string,
  timeframe: string,
  candles: NormalizedCandle[],
  params: Record<string, number | string>,
  slices: ReturnType<typeof buildRollingWalkForwardSlices>,
  balance: number,
  feeRate: number,
  entryMode: "close" | "nextOpen",
  wfWindows: number
): RunRow => {
  const windows = slices.map((slice) => {
    const train = runBacktest(family, candles, params, slice.trainStart, slice.trainEnd, balance, feeRate, entryMode);
    const val = runBacktest(family, candles, params, slice.trainEnd, slice.valEnd, balance, feeRate, entryMode);
    const oos = runBacktest(family, candles, params, slice.valEnd, slice.oosEnd, balance, feeRate, entryMode);
    return evaluateWalkForwardWindow(symbol, train, val, oos, slice, balance);
  });
  const score = scoreWalkForwardCandidate(windows, { minOosTrades: 30, minPositiveWindows: 2 });
  console.log(
    `  [${label}] ${symbol} ${timeframe} OOS ${score.avgOosMonthlyPct.toFixed(2)}%/mo DD ${score.avgOosDdPct.toFixed(2)}% trades ${score.totalOosTrades} posWin ${score.oosWindowsPositive}/${wfWindows} ${score.rejected ? `REJECT: ${score.rejectReasons.join(",")}` : "ok"}`
  );
  return { label, symbol, timeframe, params, score, windows };
};

const verdictFrom = (best: RunRow | null): "REJECT" | "PAPER_CANDIDATE" | "STRONG_CANDIDATE" => {
  if (!best || best.score.rejected) return "REJECT";
  const s = best.score;
  const paperOk =
    s.avgOosMonthlyPct > 3 &&
    s.avgOosDdPct < 5 &&
    s.oosWindowsPositive >= 3 &&
    s.maxOneMonthDom <= 50 &&
    s.maxOneTradeDom <= 45;
  if (paperOk) return "PAPER_CANDIDATE";
  if (s.avgOosMonthlyPct >= TARGET_MONTHLY && s.avgOosDdPct <= TARGET_DD && s.oosWindowsPositive >= 3) {
    return "STRONG_CANDIDATE";
  }
  return "REJECT";
};

const writeLogicAudit = (outPath: string) => {
  const md = [
    "# EMA_ATR_WINNER_LEGACY — Logic Audit",
    "",
    "Source strategy: `src/discovery/strategies/emaCrossoverAtr.ts` (same logic as this family port).",
    "Winner params: `max-monthly-volume-10dd-search-final.json` → EMA_CROSSOVER_ATR rank #1 under ≤10% DD.",
    "",
    "## Entry",
    "",
    "- **Signal bar:** closed candle index `i` (loop from `i=1`).",
    "- **Long:** `emaShort[i-1] <= emaLong[i-1]` AND `emaShort[i] > emaLong[i]` (bullish cross).",
    "- **Short:** `emaShort[i-1] >= emaLong[i-1]` AND `emaShort[i] < emaLong[i]` (bearish cross).",
    "- **Initial stop:** long `close[i] - ATR[i]*atrMult`; short `close[i] + ATR[i]*atrMult` (atrMult=0.8).",
    "- **Filter:** `passMinMoveVsFee` — stop distance ≥ `close * feeRate * minMoveVsFeeMult` (mult=2).",
    "- **Filter:** `passVolatilityFilter` — inactive when `minAtrFilter=0` (winner).",
    "- **NOT used despite JSON:** minVolumeMult, minAtrPct, minEmaDistancePct, exitOnOppositeSignal.",
    "- **Execution:** `nextOpen` — signal on bar `i`, fill at bar `i+1` open; stop frozen from signal bar.",
    "",
    "## Exit (simulator `manageExits`, not in strategy file)",
    "",
    "- **Take profit:** off (`takeProfitPct=0`).",
    "- **Max hold:** off (`maxHoldCandles=0`).",
    "- **Opposite signal exit:** not implemented for this strategy.",
    "- **Break-even:** when unrealized profit ≥ `breakEvenPct` (0.3%), stop → entry price.",
    "- **Trailing:** when profit ≥ `trailStart` (0.1%), trail stop ratchets `trailGap` (0.4%) behind close.",
    "- **Stop loss:** intrabar — long if `low <= stopLoss`; short if `high >= stopLoss` (fill at stop).",
    "",
    "## Risk sizing",
    "",
    "- `qty = (balance * riskPct/100) / |entry - stop|`, capped by leverage (riskPct=0.5%, leverage=3).",
    "",
    "## Cooldown",
    "",
    "- After exit: no entries for `cooldownCandles` (3) bars.",
    "",
    "## Lookahead / indexing review",
    "",
    "| Check | Verdict |",
    "|-------|---------|",
    "| EMA cross uses i-1 and i only | OK — closed-bar signal |",
    "| ATR at i for stop from close[i] | OK — same bar as signal |",
    "| nextOpen entry | OK — no fill on signal close |",
    "| Exits before entries on same bar (`runBar`) | OK |",
    "| Future EMA values | None |",
    "",
    "## Original O1 result context",
    "",
    "- Optimized for **max notional volume** under **≤10% DD**, ~30d **SOLUSD O1** cache, not 12m Binance.",
    "- Reported: ~156 trades, -8.55% net, 9.6% DD, PF 0.82 (selection ≠ profitability).",
    "",
    "## Winner parameters",
    "",
    "```json",
    JSON.stringify(EMA_ATR_WINNER_LEGACY_PARAMS, null, 2),
    "```",
    "",
    "### Inactive in code",
    "",
    ...EMA_ATR_WINNER_INACTIVE_PARAMS.map((k) => `- \`${k}\``),
  ].join("\n");
  fs.writeFileSync(outPath, md);
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
  const runTuned = bool(process.env.EMA_ATR_TUNED_PASS, false);

  fs.mkdirSync(outputDir, { recursive: true });
  const auditPath = path.join(outputDir, "ema-atr-winner-logic-audit.md");
  writeLogicAudit(auditPath);

  console.log(`\n=== EMA_ATR_WINNER_LEGACY — BINANCE VALIDATION ===`);
  console.log(`source=${BINANCE_FUTURES_SOURCE}`);
  console.log(`Logic audit: ${auditPath}\n`);

  const allRows: RunRow[] = [];

  for (const symbol of symbols) {
    const load = await loadBinanceFuturesCandles(symbol, { cacheDir, months, minCoveragePct: MIN_COVERAGE });
    if (!load.quality.reliable) {
      console.warn(`[SKIP] ${symbol}: unreliable data`);
      continue;
    }
    console.log(formatQualityReport(load.quality));

    for (const timeframe of timeframes) {
      const candles = resolveStrategyCandles(load.candles, timeframe);
      const rangeStart = candles[0]!.openTime;
      const rangeEnd = (candles[candles.length - 1]?.closeTime ?? Date.now()) + 1;
      const slices = buildRollingWalkForwardSlices(rangeStart, rangeEnd, wfWindows);

      console.log(`\n--- ${symbol} ${timeframe} ---`);

      allRows.push(
        evaluateVariant(
          "legacy_faithful",
          emaAtrWinnerLegacyFamily,
          symbol,
          timeframe,
          candles,
          {},
          slices,
          startBalance,
          feeRate,
          entryMode,
          wfWindows
        )
      );

      const genericPresets = [
        { emaFast: 8, emaSlow: 26, pullbackPct: 0.2, atrMult: 1 },
        { emaFast: 12, emaSlow: 34, pullbackPct: 0.3, atrMult: 1 },
        { emaFast: 12, emaSlow: 34, pullbackPct: 0.35, atrMult: 1.2 },
        { emaFast: 8, emaSlow: 34, pullbackPct: 0.2, atrMult: 1.2 },
      ];
      const genericBest = genericPresets.map((gp) =>
        evaluateVariant(
          "generic_ema_trend",
          emaTrendContinuationFamily,
          symbol,
          timeframe,
          candles,
          gp,
          slices,
          startBalance,
          feeRate,
          entryMode,
          wfWindows
        )
      );
      const bestGeneric = genericBest.reduce((a, b) => (b.score.composite > a.score.composite ? b : a));
      allRows.push({ ...bestGeneric, label: "generic_ema_trend_best" });
      console.log(
        `  [generic_ema_trend best of ${genericPresets.length} presets] OOS ${bestGeneric.score.avgOosMonthlyPct.toFixed(2)}%/mo`
      );

      if (runTuned) {
        for (const tp of cartesian(emaAtrWinnerTunedFamily.searchGrid)) {
          allRows.push(
            evaluateVariant(
              "legacy_tuned",
              emaAtrWinnerTunedFamily,
              symbol,
              timeframe,
              candles,
              tp,
              slices,
              startBalance,
              feeRate,
              entryMode,
              wfWindows
            )
          );
        }
      }
    }
  }

  const legacyRows = allRows.filter((r) => r.label.startsWith("legacy"));
  const bestLegacy = legacyRows.length
    ? legacyRows.reduce((a, b) => (b.score.composite > a.score.composite ? b : a))
    : null;
  const bestReturn = allRows.length
    ? allRows.reduce((a, b) => (b.score.avgOosMonthlyPct > a.score.avgOosMonthlyPct ? b : a))
    : null;
  const bestDd = allRows.length
    ? allRows.reduce((a, b) => (b.score.avgOosDdPct < a.score.avgOosDdPct ? b : a))
    : null;
  const stable = allRows.filter((r) => r.score.avgOosDdPct <= 5 && r.score.avgOosMonthlyPct >= 0);
  const bestStable = stable.length
    ? stable.reduce((a, b) => (b.score.composite > a.score.composite ? b : a))
    : null;

  const verdict = verdictFrom(bestLegacy);

  const wfTable = (r: RunRow) =>
    r.windows
      .map((w) => {
        const o = w.outOfSample;
        return `| ${w.slice.windowIndex} | ${w.train.metrics.netPnLPct.toFixed(2)} | ${w.validation.metrics.netPnLPct.toFixed(2)} | ${o.metrics.netPnLPct.toFixed(2)} | ${o.averageMonthlyReturnPct.toFixed(2)} | ${o.worstMonthReturnPct.toFixed(2)} | ${o.metrics.maxDrawdownPct.toFixed(2)} | ${o.metrics.profitFactor.toFixed(2)} | ${o.metrics.tradesCount} | ${o.oneTradeDominancePct.toFixed(1)} |`;
      })
      .join("\n");

  const reportMd = [
    "# EMA_ATR_WINNER_LEGACY — Binance Walk-Forward Report",
    "",
    `Source: **${BINANCE_FUTURES_SOURCE}**`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Logic audit",
    "",
    `See [ema-atr-winner-logic-audit.md](./ema-atr-winner-logic-audit.md)`,
    "",
    "## Original O1 winner (context)",
    "",
    `- File: \`${O1_WINNER_SNAPSHOT.source}\``,
    `- Symbol/timeframe: ${O1_WINNER_SNAPSHOT.symbol} / ${O1_WINNER_SNAPSHOT.timeframe} on ${O1_WINNER_SNAPSHOT.market}`,
    `- ${O1_WINNER_SNAPSHOT.spanNote}`,
    `- Metrics: net ${O1_WINNER_SNAPSHOT.metrics.netPnLPct.toFixed(2)}%, DD ${O1_WINNER_SNAPSHOT.metrics.maxDrawdownPct.toFixed(2)}%, ${O1_WINNER_SNAPSHOT.metrics.tradesCount} trades, PF ${O1_WINNER_SNAPSHOT.metrics.profitFactor.toFixed(2)}`,
    "",
    "## Validation settings",
    "",
    `- Months: ${months} | Symbols: ${symbols.join(", ")} | TF: ${timeframes.join(", ")}`,
    `- Fees: ${feeRate}/side | Entry: ${entryMode} | WF windows: ${wfWindows}`,
    `- Risk: ${num(process.env.BACKTEST_RISK_PCT, 0.5)}% / leverage ${num(process.env.BACKTEST_LEVERAGE, 3)}`,
    "",
    "## Final verdict",
    "",
    `### ${verdict}`,
    "",
    verdict === "REJECT"
      ? "Does not meet PAPER_CANDIDATE or STRONG_CANDIDATE gates on clean Binance 12m walk-forward OOS."
      : verdict === "PAPER_CANDIDATE"
        ? "Meets paper gates (>3% OOS mo, <5% DD, 3+ positive WF windows) — **not live-ready**."
        : "Meets primary target on walk-forward OOS — still verify forward/paper.",
    "",
    "## Best legacy run",
    "",
    bestLegacy
      ? `- **${bestLegacy.symbol} ${bestLegacy.timeframe}** (${bestLegacy.label}): OOS ${bestLegacy.score.avgOosMonthlyPct.toFixed(2)}%/mo, DD ${bestLegacy.score.avgOosDdPct.toFixed(2)}%, PF ${bestLegacy.score.avgOosPf.toFixed(2)}, trades ${bestLegacy.score.totalOosTrades}, worst mo ${bestLegacy.score.worstOosMonthPct.toFixed(2)}%, 1-trade dom ${bestLegacy.score.maxOneTradeDom.toFixed(1)}%`
      : "_No runs_",
    "",
    "### Walk-forward (best legacy)",
    "",
    "| W | Train % | Val % | OOS % | OOS avg mo % | Worst mo % | OOS DD % | PF | Trades | 1-tr dom % |",
    "|--:|--------:|------:|------:|-------------:|-----------:|---------:|---:|-------:|-----------:|",
    ...(bestLegacy ? [wfTable(bestLegacy)] : []),
    "",
    bestLegacy ? formatMetricsTable(bestLegacy.windows.map((w) => w.outOfSample)) : "",
    "",
    "## vs generic EMA trend family",
    "",
    "| Symbol | TF | Legacy OOS mo % | Generic best OOS mo % | Legacy DD % | Generic DD % |",
    "|--------|-----|----------------:|----------------------:|------------:|-------------:|",
    ...symbols.flatMap((sym) =>
      timeframes.map((tf) => {
        const leg = legacyRows.find((r) => r.symbol === sym && r.timeframe === tf && r.label === "legacy_faithful");
        const gen = allRows.find((r) => r.symbol === sym && r.timeframe === tf && r.label === "generic_ema_trend_best");
        if (!leg || !gen) return "";
        return `| ${sym} | ${tf} | ${leg.score.avgOosMonthlyPct.toFixed(2)} | ${gen.score.avgOosMonthlyPct.toFixed(2)} | ${leg.score.avgOosDdPct.toFixed(2)} | ${gen.score.avgOosDdPct.toFixed(2)} |`;
      })
    ).filter(Boolean),
    "",
    "## Failure analysis (if applicable)",
    "",
    "- **Data source:** O1 winner was tuned on short/gappy O1 SOLUSD; Binance 12m is continuous — edge may not transfer.",
    "- **Objective mismatch:** Original search maximized **volume** under DD cap, not monthly return.",
    "- **Fees + next-open:** Realistic costs reduce churny crossover edges.",
    "- **Regime:** Strategy is regime-agnostic (no regime filter) — reported as regime-independent.",
    "",
    "## Secondary candidates (Binance)",
    "",
    bestStable
      ? `- **Stable:** ${bestStable.label} ${bestStable.symbol} ${bestStable.timeframe} — ${bestStable.score.avgOosMonthlyPct.toFixed(2)}%/mo, DD ${bestStable.score.avgOosDdPct.toFixed(2)}%`
      : "- **Stable:** none with OOS ≥ 0% and DD ≤ 5%",
    bestReturn
      ? `- **Best return:** ${bestReturn.label} ${bestReturn.symbol} ${bestReturn.timeframe} — ${bestReturn.score.avgOosMonthlyPct.toFixed(2)}%/mo`
      : "- **Best return:** none",
    bestDd
      ? `- **Best DD:** ${bestDd.label} ${bestDd.symbol} ${bestDd.timeframe} — DD ${bestDd.score.avgOosDdPct.toFixed(2)}%`
      : "- **Best DD:** none",
    "",
    `Primary target (≥${TARGET_MONTHLY}% OOS mo, ≤${TARGET_DD}% DD): **${bestLegacy && bestLegacy.score.avgOosMonthlyPct >= TARGET_MONTHLY && bestLegacy.score.avgOosDdPct <= TARGET_DD ? "MET" : "NOT MET"}**`,
  ].join("\n");

  const reportPath = path.join(outputDir, "ema-atr-winner-binance-report.md");
  const jsonPath = path.join(outputDir, "ema-atr-winner-binance-results.json");
  fs.writeFileSync(reportPath, reportMd);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        source: BINANCE_FUTURES_SOURCE,
        verdict,
        o1WinnerSnapshot: O1_WINNER_SNAPSHOT,
        bestLegacy,
        rows: allRows.map((r) => ({
          label: r.label,
          symbol: r.symbol,
          timeframe: r.timeframe,
          params: r.params,
          score: r.score,
          oosWindows: r.windows.map((w) => ({
            window: w.slice.windowIndex,
            trainPct: w.train.metrics.netPnLPct,
            valPct: w.validation.metrics.netPnLPct,
            oosPct: w.outOfSample.metrics.netPnLPct,
            oosAvgMonth: w.outOfSample.averageMonthlyReturnPct,
            oosWorstMonth: w.outOfSample.worstMonthReturnPct,
            oosDd: w.outOfSample.metrics.maxDrawdownPct,
            oosPf: w.outOfSample.metrics.profitFactor,
            oosTrades: w.outOfSample.metrics.tradesCount,
          })),
        })),
      },
      null,
      2
    )
  );

  console.log(`\n=== COMPLETE ===`);
  console.log(`Verdict: ${verdict}`);
  console.log(`Report: ${reportPath}`);
  console.log(`JSON: ${jsonPath}\n`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
