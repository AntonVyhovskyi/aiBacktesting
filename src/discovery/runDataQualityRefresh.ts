import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import {
  BINANCE_FUTURES_SOURCE,
  downloadBinanceFuturesCandles,
} from "../backtest/fetchBinanceFuturesCandles.js";
import { formatQualityReport, type CandleQualityReport } from "../backtest/candleValidate.js";

const num = (v: string | undefined, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const bool = (v: string | undefined, fb: boolean) =>
  !v ? fb : v === "1" || v.toLowerCase() === "true";

const DEFAULT_SYMBOLS = "SOLUSDT,ETHUSDT";

export const refreshBinanceSymbolData = async (
  symbol: string,
  months: number,
  forceRefresh: boolean
): Promise<CandleQualityReport> => {
  const cacheDir = path.resolve(process.env.BACKTEST_CACHE_DIR ?? "data/cache");
  const minCoveragePct = num(process.env.BINANCE_MIN_COVERAGE_PCT, 90);
  const result = await downloadBinanceFuturesCandles(symbol, "1m", {
    cacheDir,
    months,
    endTimeMs: num(process.env.BACKTEST_END_TIME_MS, Date.now()),
    forceRefresh,
    minCoveragePct,
    requestDelayMs: num(process.env.BINANCE_REQUEST_DELAY_MS, 250),
    maxRetries: num(process.env.BINANCE_MAX_RETRIES, 8),
    retryDelayMs: num(process.env.BINANCE_RETRY_DELAY_MS, 2000),
  });
  return result.quality;
};

const main = async () => {
  const months = num(process.env.BACKTEST_MONTHS, 12);
  const forceRefresh = bool(process.env.BACKTEST_FORCE_REFRESH, false);
  const symbols = (process.env.ADAPTIVE_SYMBOLS ?? DEFAULT_SYMBOLS).split(",").map((s) => s.trim());

  console.log(`\n=== DATA QUALITY REFRESH (${BINANCE_FUTURES_SOURCE}) ===\n`);
  console.log(`Months: ${months} | Force refresh: ${forceRefresh}\n`);

  const reports: CandleQualityReport[] = [];
  for (const symbol of symbols) {
    console.log(`\n[DOWNLOAD] ${symbol}...`);
    try {
      const r = await refreshBinanceSymbolData(symbol, months, forceRefresh);
      reports.push(r);
      console.log(formatQualityReport(r));
    } catch (e) {
      console.error(`[FAIL] ${symbol}:`, e);
      reports.push({
        symbol,
        source: BINANCE_FUTURES_SOURCE,
        cachePath: "",
        count: 0,
        spanDays: 0,
        expectedCandles: 0,
        coveragePct: 0,
        duplicateTimestamps: 0,
        gapCount: 0,
        largestGapMinutes: 0,
        missingEstimate: 0,
        unordered: false,
        ok: false,
        reliable: false,
        warnings: [],
        issues: [String(e)],
      });
    }
  }

  const outDir = path.resolve(process.env.BACKTEST_OUTPUT_DIR ?? "data/results");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "data-quality-report.md");
  const md = [
    "# Data Quality Report",
    "",
    `Source: **${BINANCE_FUTURES_SOURCE}**`,
    `Generated: ${new Date().toISOString()}`,
    `Months requested: ${months}`,
    `Min coverage required: ${num(process.env.BINANCE_MIN_COVERAGE_PCT, 90)}%`,
    "",
    ...reports.flatMap((r) => [formatQualityReport(r), ""]),
    "",
    "## Summary",
    "",
    `| Symbol | Days | Coverage % | Reliable |`,
    `|--------|-----:|-----------:|:--------:|`,
    ...reports.map(
      (r) => `| ${r.symbol} | ${r.spanDays.toFixed(0)} | ${r.coveragePct} | ${r.reliable ? "yes" : "**NO**"} |`
    ),
  ].join("\n");

  fs.writeFileSync(outPath, md);
  writeJson(path.join(outDir, "data-quality-report.json"), {
    source: BINANCE_FUTURES_SOURCE,
    generatedAt: new Date().toISOString(),
    reports,
  });

  console.log(`\nWrote ${outPath}\n`);
};

const writeJson = (p: string, obj: unknown) => fs.writeFileSync(p, JSON.stringify(obj, null, 2));

const isMain =
  process.argv[1]?.replace(/\\/g, "/").endsWith("runDataQualityRefresh.ts") ||
  process.argv[1]?.replace(/\\/g, "/").endsWith("runDataQualityRefresh.js");

if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
