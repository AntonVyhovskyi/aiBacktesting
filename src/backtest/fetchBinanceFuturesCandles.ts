import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import {
  validateCandlesForRange,
  type CandleQualityReport,
} from "./candleValidate.js";
import type { NormalizedCandle } from "./types.js";

export const BINANCE_FUTURES_SOURCE = "BINANCE_FUTURES" as const;
export const BINANCE_FUTURES_BASE_URL = "https://fapi.binance.com/fapi/v1/klines";
export const BINANCE_VISION_BASE_URL = "https://data.binance.vision/data/futures/um";

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

const isRestGeoBlocked = (err: unknown): boolean => {
  const msg = String(err);
  return /HTTP 451|HTTP 403|unavailable for legal reasons|restricted location|cloudflare/i.test(msg);
};

const monthKeysInclusive = (startTimeMs: number, endTimeMs: number): string[] => {
  const keys: string[] = [];
  const d = new Date(Date.UTC(new Date(startTimeMs).getUTCFullYear(), new Date(startTimeMs).getUTCMonth(), 1));
  const end = new Date(endTimeMs);
  while (d.getTime() < end.getTime()) {
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return keys;
};

const daysInMonth = (yearMonth: string): string[] => {
  const [y, m] = yearMonth.split("-").map(Number);
  const start = Date.UTC(y!, m! - 1, 1);
  const end = Date.UTC(y!, m!, 1);
  const out: string[] = [];
  for (let t = start; t < end; t += 86400000) {
    const d = new Date(t);
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`);
  }
  return out;
};

const parseCsvKlines = (text: string): NormalizedCandle[] => {
  const out: NormalizedCandle[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line || /open.?time/i.test(line)) continue;
    const cols = line.split(",");
    const openTime = Number(cols[0]);
    if (!Number.isFinite(openTime) || cols.length < 7) continue;
    out.push({
      openTime,
      open: Number(cols[1]),
      high: Number(cols[2]),
      low: Number(cols[3]),
      close: Number(cols[4]),
      volume: Number(cols[5]),
      closeTime: Number(cols[6]),
    });
  }
  return out;
};

const inflateZipPayload = (method: number, data: Buffer): string => {
  if (method === 0) return data.toString("utf8");
  if (method === 8) return zlib.inflateRawSync(data).toString("utf8");
  throw new Error(`Unsupported ZIP compression method ${method}`);
};

/** Minimal ZIP reader for Binance Vision monthly/daily kline archives (single CSV). */
export const extractCsvFromZip = (buf: Buffer): string => {
  let offset = 0;
  while (offset + 30 <= buf.length) {
    if (buf.readUInt32LE(offset) !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const flags = buf.readUInt16LE(offset + 6);
    const method = buf.readUInt16LE(offset + 8);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const name = buf.subarray(offset + 30, offset + 30 + nameLen).toString("utf8");
    const dataStart = offset + 30 + nameLen + extraLen;
    let compSize = buf.readUInt32LE(offset + 18);
    let dataEnd = dataStart + compSize;
    if (flags & 0x8) {
      const desc = buf.indexOf(Buffer.from([0x50, 0x4b, 0x07, 0x08]), dataStart);
      if (desc < 0) throw new Error(`ZIP data descriptor missing for ${name}`);
      compSize = desc - dataStart;
      dataEnd = desc;
    }
    const data = buf.subarray(dataStart, dataStart + compSize);
    if (name.toLowerCase().endsWith(".csv")) return inflateZipPayload(method, data);
    offset = dataEnd;
  }
  throw new Error("ZIP archive contains no CSV entry");
};

const fetchVisionZip = async (url: string, maxRetries: number, retryDelayMs: number): Promise<Buffer | null> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(60_000),
        headers: { "User-Agent": "aiBacktesting/1.0 (local research; data.binance.vision)" },
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (attempt === maxRetries) throw e;
      await sleep(retryDelayMs * attempt);
    }
  }
  return null;
};

const downloadVisionMonth = async (
  symbol: string,
  interval: string,
  yearMonth: string,
  maxRetries: number,
  retryDelayMs: number
): Promise<NormalizedCandle[]> => {
  const monthlyUrl = `${BINANCE_VISION_BASE_URL}/monthly/klines/${symbol}/${interval}/${symbol}-${interval}-${yearMonth}.zip`;
  console.log(`[BINANCE_VISION] ${symbol} ${interval} ${yearMonth} monthly zip`);
  const monthly = await fetchVisionZip(monthlyUrl, maxRetries, retryDelayMs);
  if (monthly) return parseCsvKlines(extractCsvFromZip(monthly));

  console.warn(`[BINANCE_VISION] monthly zip missing for ${yearMonth} — trying daily zips`);
  const all: NormalizedCandle[] = [];
  for (const day of daysInMonth(yearMonth)) {
    const dailyUrl = `${BINANCE_VISION_BASE_URL}/daily/klines/${symbol}/${interval}/${symbol}-${interval}-${day}.zip`;
    const daily = await fetchVisionZip(dailyUrl, maxRetries, retryDelayMs);
    if (!daily) continue;
    all.push(...parseCsvKlines(extractCsvFromZip(daily)));
  }
  return all;
};

export const downloadBinanceVisionCandles = async (
  symbol: string,
  interval: string,
  startTimeMs: number,
  endTimeMs: number,
  maxRetries: number,
  retryDelayMs: number
): Promise<NormalizedCandle[]> => {
  const months = monthKeysInclusive(startTimeMs, endTimeMs);
  const all: NormalizedCandle[] = [];
  for (const month of months) {
    const rows = await downloadVisionMonth(symbol, interval, month, maxRetries, retryDelayMs);
    all.push(...rows);
  }
  return dedupeSortCandles(filterRange(all, startTimeMs, endTimeMs));
};

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

  let useVision = false;
  try {
    await fetchKlinesPage(symbol, interval, cursor, Math.min(endTimeMs, cursor + stepMs * limit), 1, 2, retryDelayMs);
  } catch (e) {
    if (isRestGeoBlocked(e)) {
      console.warn(`[BINANCE_DOWNLOAD] REST blocked (${e}) — falling back to data.binance.vision`);
      useVision = true;
    }
  }

  if (useVision) {
    const vision = await downloadBinanceVisionCandles(symbol, interval, startTimeMs, endTimeMs, maxRetries, retryDelayMs);
    const candles = dedupeSortCandles(filterRange([...all, ...vision], startTimeMs, endTimeMs));
    const complete = candles.length >= targetMinCandles;
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
    const quality = buildQualityReport(symbol, cachePath, candles, startTimeMs, endTimeMs, stepMs, minCoveragePct, months);
    const spanDays = (endTimeMs - startTimeMs) / 86400000;
    console.log(
      `[BINANCE_VISION] saved ${candles.length} candles (~${spanDays.toFixed(0)}d span) complete=${complete} coverage=${quality.coveragePct}%`
    );
    return { source: BINANCE_FUTURES_SOURCE, cachePath, meta, candles, quality };
  }

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
      if (isRestGeoBlocked(e)) {
        console.warn(`[BINANCE_DOWNLOAD] REST blocked mid-download (${e}) — falling back to data.binance.vision`);
        const vision = await downloadBinanceVisionCandles(symbol, interval, startTimeMs, endTimeMs, maxRetries, retryDelayMs);
        all.push(...vision);
        break;
      }
      failStreak += 1;
      console.warn(`[BINANCE_DOWNLOAD] error: ${e}`);
      await sleep(retryDelayMs * failStreak);
    }
  }

  let candles = dedupeSortCandles(filterRange(all, startTimeMs, endTimeMs));
  if (candles.length < targetMinCandles) {
    console.warn(
      `[BINANCE_DOWNLOAD] REST coverage short (${candles.length} < ${targetMinCandles}) — trying data.binance.vision`
    );
    const vision = await downloadBinanceVisionCandles(symbol, interval, startTimeMs, endTimeMs, maxRetries, retryDelayMs);
    candles = dedupeSortCandles(filterRange([...candles, ...vision], startTimeMs, endTimeMs));
  }
  const complete = candles.length >= targetMinCandles;

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
    console.warn(`[BINANCE_CACHE] missing ${cachePath} — downloading`);
    return downloadBinanceFuturesCandles(symbol, "1m", options);
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
