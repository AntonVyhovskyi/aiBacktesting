import fs from "node:fs";
import path from "node:path";
import {
  validateCandlesForRange,
  type CandleQualityReport,
} from "./candleValidate.js";
import type { NormalizedCandle } from "./types.js";

export const BINANCE_FUTURES_SOURCE = "BINANCE_FUTURES" as const;
export const BINANCE_FUTURES_BASE_URL = "https://fapi.binance.com/fapi/v1/klines";

export class BinanceCacheMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BinanceCacheMissingError";
  }
}

export type BinanceCacheMeta = {
  source: typeof BINANCE_FUTURES_SOURCE;
  symbol: string;
  interval: string;
  months: number;
  startTimeMs: number;
  endTimeMs: number;
  downloadedAt: string;
  complete: boolean;
};

export type BinanceCacheFile = BinanceCacheMeta & {
  candles: NormalizedCandle[];
};

export type BinanceFetchOptions = {
  cacheDir: string;
  months: number;
  endTimeMs?: number;
  forceRefresh?: boolean;
  limit?: number;
  requestDelayMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  minCoveragePct?: number;
};

export type BinanceLoadResult = {
  source: typeof BINANCE_FUTURES_SOURCE;
  cachePath: string;
  meta: BinanceCacheMeta;
  candles: NormalizedCandle[];
  quality: CandleQualityReport;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const dedupeSortCandles = (candles: NormalizedCandle[]): NormalizedCandle[] => {
  const m = new Map<number, NormalizedCandle>();
  for (const c of candles) m.set(c.openTime, c);
  return [...m.values()].sort((a, b) => a.openTime - b.openTime);
};

export const getBinanceCachePath = (
  cacheDir: string,
  symbol: string,
  interval: string,
  months: number
): string =>
  path.resolve(cacheDir, "binance_futures", `${symbol}_${interval}_${months}m.json`);

const parseKline = (row: unknown[]): NormalizedCandle => ({
  openTime: Number(row[0]),
  open: Number(row[1]),
  high: Number(row[2]),
  low: Number(row[3]),
  close: Number(row[4]),
  volume: Number(row[5]),
  closeTime: Number(row[6]),
});

const loadCacheFile = (cachePath: string): BinanceCacheFile | null => {
  if (!fs.existsSync(cachePath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(cachePath, "utf8")) as BinanceCacheFile;
    if (raw?.source !== BINANCE_FUTURES_SOURCE || !Array.isArray(raw.candles)) return null;
    return { ...raw, candles: dedupeSortCandles(raw.candles) };
  } catch {
    return null;
  }
};

const saveCacheFile = (cachePath: string, file: BinanceCacheFile) => {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify({ ...file, candles: dedupeSortCandles(file.candles) }));
};

const fetchKlinesPage = async (
  symbol: string,
  interval: string,
  startTimeMs: number,
  endTimeMs: number,
  limit: number,
  maxRetries: number,
  retryDelayMs: number
): Promise<NormalizedCandle[]> => {
  const params = new URLSearchParams({
    symbol,
    interval,
    startTime: String(startTimeMs),
    endTime: String(endTimeMs),
    limit: String(limit),
  });
  const url = `${BINANCE_FUTURES_BASE_URL}?${params}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (res.status === 429) {
        const wait = retryDelayMs * attempt * 2;
        console.warn(`[BINANCE] 429 rate limit — wait ${wait}ms`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = (await res.json()) as unknown[][];
      return data.map(parseKline);
    } catch (e) {
      if (attempt === maxRetries) throw e;
      await sleep(retryDelayMs * attempt);
    }
  }
  return [];
};

const intervalMs = (interval: string): number => {
  const m = interval.match(/^(\d+)(m|h|d)$/);
  if (!m) throw new Error(`Unsupported interval: ${interval}`);
  const n = Number(m[1]);
  if (m[2] === "m") return n * 60_000;
  if (m[2] === "h") return n * 3_600_000;
  return n * 86_400_000;
};

export const downloadBinanceFuturesCandles = async (
  symbol: string,
  interval = "1m",
  options: BinanceFetchOptions
): Promise<BinanceLoadResult> => {
  const months = Math.max(1, Math.min(24, options.months));
  const endTimeMs = options.endTimeMs ?? Date.now();
  const startTimeMs = endTimeMs - months * 30 * 86400000;
  const cachePath = getBinanceCachePath(options.cacheDir, symbol, interval, months);
  const stepMs = intervalMs(interval);
  const limit = Math.min(1500, options.limit ?? 1500);
  const requestDelayMs = options.requestDelayMs ?? 250;
  const maxRetries = options.maxRetries ?? 8;
  const retryDelayMs = options.retryDelayMs ?? 2000;
  const minCoveragePct = options.minCoveragePct ?? 90;
  const targetMinCandles = Math.floor(((endTimeMs - startTimeMs) / stepMs) * (minCoveragePct / 100));

  let existing: BinanceCacheFile | null = null;
  if (!options.forceRefresh) {
    existing = loadCacheFile(cachePath);
    if (existing?.complete && existing.candles.length >= targetMinCandles) {
      const quality = buildQualityReport(
        symbol,
        cachePath,
        existing.candles,
        startTimeMs,
        endTimeMs,
        stepMs,
        minCoveragePct,
        months
      );
      console.log(
        `[BINANCE_CACHE] ${symbol} ${interval} ${months}m: ${existing.candles.length} candles (complete) → ${cachePath}`
      );
      return {
        source: BINANCE_FUTURES_SOURCE,
        cachePath,
        meta: existing,
        candles: filterRange(existing.candles, startTimeMs, endTimeMs),
        quality,
      };
    }
  }

  const resume = options.forceRefresh ? null : existing;
  const all: NormalizedCandle[] = resume?.candles ? [...resume.candles] : [];
  let cursor =
    all.length > 0
      ? Math.max(startTimeMs, all[all.length - 1]!.openTime + stepMs)
      : startTimeMs;

  console.log(
    `[BINANCE_DOWNLOAD] source=${BINANCE_FUTURES_SOURCE} ${symbol} ${interval} ~${months}m → ${cachePath}${resume ? ` (resume ${all.length})` : ""}`
  );

  let pages = 0;
  let failStreak = 0;

  while (cursor < endTimeMs && failStreak < 10) {
    try {
      const page = await fetchKlinesPage(
        symbol,
        interval,
        cursor,
        endTimeMs,
        limit,
        maxRetries,
        retryDelayMs
      );
      if (!page.length) {
        failStreak += 1;
        break;
      }
      all.push(...page);
      pages += 1;
      const last = page[page.length - 1]!;
      cursor = last.openTime + stepMs;
      failStreak = 0;

      if (pages % 20 === 0) {
        const pct = ((cursor - startTimeMs) / (endTimeMs - startTimeMs)) * 100;
        console.log(
          `[BINANCE_DOWNLOAD] pages=${pages} candles=${all.length} progress~${pct.toFixed(0)}% latest=${new Date(last.openTime).toISOString().slice(0, 10)}`
        );
      }

      if (pages % 10 === 0) {
        const partial: BinanceCacheFile = {
          source: BINANCE_FUTURES_SOURCE,
          symbol,
          interval,
          months,
          startTimeMs,
          endTimeMs,
          downloadedAt: new Date().toISOString(),
          complete: false,
          candles: dedupeSortCandles(all),
        };
        saveCacheFile(cachePath, partial);
      }

      if (page.length < limit) break;
      await sleep(requestDelayMs);
    } catch (e) {
      failStreak += 1;
      console.warn(`[BINANCE_DOWNLOAD] error: ${e}`);
      await sleep(retryDelayMs * failStreak);
    }
  }

  const candles = dedupeSortCandles(filterRange(all, startTimeMs, endTimeMs));
  const complete = candles.length >= targetMinCandles && cursor >= endTimeMs - stepMs * 2;

  const meta: BinanceCacheFile = {
    source: BINANCE_FUTURES_SOURCE,
    symbol,
    interval,
    months,
    startTimeMs,
    endTimeMs,
    downloadedAt: new Date().toISOString(),
    complete,
    candles,
  };
  saveCacheFile(cachePath, meta);

  const quality = buildQualityReport(
    symbol,
    cachePath,
    candles,
    startTimeMs,
    endTimeMs,
    stepMs,
    minCoveragePct,
    months
  );

  const spanDays = (endTimeMs - startTimeMs) / 86400000;
  console.log(
    `[BINANCE_CACHE] saved ${candles.length} candles (~${spanDays.toFixed(0)}d span) complete=${complete} coverage=${quality.coveragePct}%`
  );
  if (!quality.reliable) {
    console.warn(`[BINANCE_CACHE] WARNING: coverage ${quality.coveragePct}% < ${minCoveragePct}% — re-run refresh to resume`);
  }

  return { source: BINANCE_FUTURES_SOURCE, cachePath, meta, candles, quality };
};

const filterRange = (candles: NormalizedCandle[], start: number, end: number) =>
  candles.filter((c) => c.openTime >= start && c.openTime <= end);

const buildQualityReport = (
  symbol: string,
  cachePath: string,
  candles: NormalizedCandle[],
  rangeStartMs: number,
  rangeEndMs: number,
  intervalMs: number,
  minCoveragePct: number,
  months: number
): CandleQualityReport => {
  const minSpanDays = Math.floor(months * 30 * 0.85);
  const q = validateCandlesForRange(candles, rangeStartMs, rangeEndMs, intervalMs, {
    minCoveragePct,
    minSpanDays,
    maxGapCount: 50,
    maxLargestGapMinutes: 5,
  });
  return {
    symbol,
    cachePath,
    source: BINANCE_FUTURES_SOURCE,
    ...q,
  };
};

export const loadBinanceFuturesCandles = async (
  symbol: string,
  options: BinanceFetchOptions
): Promise<BinanceLoadResult> => {
  if (options.forceRefresh) {
    return downloadBinanceFuturesCandles(symbol, "1m", options);
  }
  const months = Math.max(1, Math.min(24, options.months));
  const cachePath = getBinanceCachePath(options.cacheDir, symbol, "1m", months);
  const file = loadCacheFile(cachePath);
  if (!file?.candles.length) {
    throw new BinanceCacheMissingError(
      `Binance cache missing: ${cachePath}\nRun: npm run binance-refresh`
    );
  }
  const endTimeMs = options.endTimeMs ?? Date.now();
  const startTimeMs = endTimeMs - months * 30 * 86400000;
  const minCoveragePct = options.minCoveragePct ?? 90;
  const quality = buildQualityReport(
    symbol,
    cachePath,
    file.candles,
    startTimeMs,
    endTimeMs,
    60_000,
    minCoveragePct,
    months
  );
  console.log(`[BINANCE_CACHE] source=${BINANCE_FUTURES_SOURCE} ${symbol} ${months}m — cache only`);
  return {
    source: BINANCE_FUTURES_SOURCE,
    cachePath,
    meta: file,
    candles: filterRange(file.candles, startTimeMs, endTimeMs),
    quality,
  };
};
