import fs from "node:fs";
import path from "node:path";
import {
  buildTvHistoryRequest,
  fetchTvHistory,
  historyPayloadToMinuteCandles,
  type TvHistoryOk,
} from "../o1/tvHistory.js";
import type { NormalizedCandle, O1FetchConfig } from "./types.js";

const CACHE_MISSING =
  "Cache is missing. Run once with BACKTEST_FORCE_REFRESH=true after rate limit is gone.";

export class CacheMissingError extends Error {
  constructor(message: string = CACHE_MISSING) {
    super(message);
    this.name = "CacheMissingError";
  }
}

export type FetchO1Options = {
  startTimeMs: number;
  endTimeMs: number;
  backtestDays: number;
  cacheDir: string;
  countback: number;
  maxRetries: number;
  retryDelayMs: number;
  forceRefresh: boolean;
};

export type CandleLoadResult = {
  source: "cache" | "downloaded";
  cachePath: string;
  candles: NormalizedCandle[];
};

const dedupeSort = (candles: NormalizedCandle[]): NormalizedCandle[] => {
  const m = new Map<number, NormalizedCandle>();
  for (const c of candles) m.set(c.openTime, c);
  return [...m.values()].sort((a, b) => a.openTime - b.openTime);
};

const loadJson = (p: string): NormalizedCandle[] | null => {
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as NormalizedCandle[];
    return Array.isArray(raw) ? dedupeSort(raw) : null;
  } catch {
    return null;
  }
};

const loadCsv = (p: string): NormalizedCandle[] | null => {
  if (!fs.existsSync(p)) return null;
  try {
    const lines = fs.readFileSync(p, "utf8").trim().split(/\r?\n/);
    const out: NormalizedCandle[] = [];
    for (let i = 1; i < lines.length; i++) {
      const p = lines[i]!.split(",");
      if (p.length < 7) continue;
      out.push({
        openTime: Number(p[0]),
        open: Number(p[1]),
        high: Number(p[2]),
        low: Number(p[3]),
        close: Number(p[4]),
        volume: Number(p[5]),
        closeTime: Number(p[6]),
      });
    }
    return dedupeSort(out);
  } catch {
    return null;
  }
};

export const getCachePath = (config: O1FetchConfig, cacheDir: string, days: number): string =>
  path.resolve(cacheDir, `${config.symbol.replace(/[^a-zA-Z0-9_-]/g, "_")}_market${config.marketId}_1m_${days}d.json`);

/** Extended history cache: `{symbol}_market{id}_1m_{months}m.json` */
export const getExtendedCachePath = (
  config: O1FetchConfig,
  cacheDir: string,
  months: number
): string =>
  path.resolve(
    cacheDir,
    `${config.symbol.replace(/[^a-zA-Z0-9_-]/g, "_")}_market${config.marketId}_1m_${months}m.json`
  );

/** @deprecated use getExtendedCachePath(..., 6) */
export const getSixMonthCachePath = (config: O1FetchConfig, cacheDir: string): string =>
  getExtendedCachePath(config, cacheDir, 6);

export type SixMonthFetchOptions = Omit<FetchO1Options, "backtestDays"> & {
  backtestMonths: number;
};

const saveCache = (cachePath: string, candles: NormalizedCandle[]) => {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(candles));
};

const downloadPaginatedMinutes = async (
  config: O1FetchConfig,
  options: Pick<FetchO1Options, "startTimeMs" | "endTimeMs" | "countback" | "maxRetries" | "retryDelayMs"> & {
    cachePath?: string;
    resumeFrom?: NormalizedCandle[];
  }
): Promise<{ candles: NormalizedCandle[]; complete: boolean }> => {
  const all: NormalizedCandle[] = options.resumeFrom ? [...options.resumeFrom] : [];
  const startSec = Math.floor(options.startTimeMs / 1000);
  let toSec = Math.floor(options.endTimeMs / 1000);
  if (all.length) {
    const earliest = all[0]!.openTime / 1000;
    if (earliest > startSec) toSec = earliest - 60;
  }
  let failStreak = 0;
  let pages = 0;
  const maxPages =
    Math.ceil(((options.endTimeMs - options.startTimeMs) / 60000 / options.countback) * 1.5) + 120;

  while (toSec > startSec && pages < maxPages && failStreak < 15) {
    const url = buildTvHistoryRequest(config, "1", options.countback, toSec);
    let ok = false;
    for (let a = 1; a <= options.maxRetries; a++) {
      try {
        const res = await fetchTvHistory(url, 60_000);
        const payload = res.payload as TvHistoryOk | { s: string };
        if (res.ok && payload && "s" in payload && payload.s === "ok") {
          const page = historyPayloadToMinuteCandles(payload as TvHistoryOk);
          if (!page.length) {
            failStreak += 1;
            break;
          }
          all.push(...page);
          pages += 1;
          const earliest = page[0]!.openTime / 1000;
          if (pages % 25 === 0) {
            const days = (options.endTimeMs / 1000 - earliest) / 86400;
            console.log(
              `[O1_DOWNLOAD] pages=${pages} earliest=${new Date(earliest * 1000).toISOString().slice(0, 10)} span~${days.toFixed(0)}d`
            );
          }
          if (options.cachePath && pages % 10 === 0) {
            saveCache(options.cachePath, dedupeSort(all));
          }
          if (earliest <= startSec) {
            ok = true;
            failStreak = 0;
            break;
          }
          toSec = earliest - 60;
          ok = true;
          failStreak = 0;
          break;
        }
      } catch (e) {
        if (a === options.maxRetries) console.warn(`[O1_DOWNLOAD] fetch error: ${e}`);
      }
      await sleep(options.retryDelayMs * a);
    }
    if (!ok) failStreak += 1;
  }

  const candles = dedupeSort(filterRange(all, options.startTimeMs, options.endTimeMs));
  const complete =
    candles.length > 0 &&
    candles[0]!.openTime / 1000 <= startSec + 120 &&
    failStreak < 15 &&
    toSec <= startSec;
  return { candles, complete };
};

export const loadExtendedO1MinuteCandles = async (
  config: O1FetchConfig,
  options: SixMonthFetchOptions
): Promise<CandleLoadResult> => {
  const months = Math.max(1, Math.min(24, options.backtestMonths));
  const cachePath = getExtendedCachePath(config, options.cacheDir, months);
  const spanMs = months * 30 * 86400000;
  const startTimeMs = options.endTimeMs - spanMs;
  const targetMinCandles = Math.floor(months * 30 * 1440 * 0.85);

  if (!options.forceRefresh) {
    let candles = loadJson(cachePath);
    if (!candles?.length && months === 6) {
      const legacy = getSixMonthCachePath(config, options.cacheDir);
      candles = loadJson(legacy);
      if (candles?.length) console.log(`[O1_CACHE] legacy 6m path: ${legacy}`);
    }
    if (!candles?.length) {
      throw new CacheMissingError(
        `Cache missing: ${cachePath}\nRun: BACKTEST_FORCE_REFRESH=true BACKTEST_MONTHS=${months}`
      );
    }
    const ranged = filterRange(candles, startTimeMs, options.endTimeMs);
    if (!ranged.length) {
      throw new CacheMissingError(`No candles in ${months}-month window in ${cachePath}`);
    }
    console.log(
      `[O1_CACHE] ${config.symbol} ${months}m: ${cachePath} (${candles.length} total, ${ranged.length} in window)`
    );
    console.log("[O1_CACHE] cache only — O1 API will not be called");
    return { source: "cache", cachePath, candles: ranged };
  }

  const existing = loadJson(cachePath) ?? [];
  if (existing.length) {
    console.log(`[O1_DOWNLOAD] ${config.symbol} ~${months} months → ${cachePath} (resume ${existing.length} candles)`);
  } else {
    console.log(`[O1_DOWNLOAD] ${config.symbol} ~${months} months → ${cachePath}`);
  }

  const { candles: full, complete } = await downloadPaginatedMinutes(config, {
    startTimeMs,
    endTimeMs: options.endTimeMs,
    countback: options.countback,
    maxRetries: options.maxRetries,
    retryDelayMs: options.retryDelayMs,
    cachePath,
    resumeFrom: existing.length ? existing : undefined,
  });
  if (!full.length) {
    throw new CacheMissingError(`Download failed with no candles for ${config.symbol}`);
  }
  saveCache(cachePath, full);
  console.log(
    `[O1_CACHE] saved: ${full.length} candles (~${(full.length / 1440).toFixed(0)} days) → ${cachePath}${complete ? "" : " (PARTIAL — re-run refresh to continue)"}`
  );
  if (!complete || full.length < targetMinCandles) {
    console.warn(
      `[O1_CACHE] WARNING: download ${complete ? "complete but short" : "incomplete"} — expected >= ${targetMinCandles}, got ${full.length}`
    );
  }
  return { source: "downloaded", cachePath, candles: full };
};

/** @deprecated use loadExtendedO1MinuteCandles */
export const loadSixMonthO1MinuteCandles = loadExtendedO1MinuteCandles;

const legacyPaths = (config: O1FetchConfig, cacheDir: string): string[] => {
  const s = config.symbol.replace(/[^a-zA-Z0-9_-]/g, "_");
  return [
    path.resolve(cacheDir, `${s}_m${config.marketId}_1m.csv`),
    path.resolve(cacheDir, `${s}_market${config.marketId}_1m.json`),
  ];
};

const filterRange = (candles: NormalizedCandle[], start: number, end: number) =>
  candles.filter((c) => c.openTime >= start && c.openTime <= end);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const loadOrDownloadO1MinuteCandles = async (
  config: O1FetchConfig,
  options: FetchO1Options
): Promise<CandleLoadResult> => {
  const cachePath = getCachePath(config, options.cacheDir, options.backtestDays);

  if (!options.forceRefresh) {
    let candles = loadJson(cachePath);
    if (!candles?.length) {
      for (const lp of legacyPaths(config, options.cacheDir)) {
        candles = lp.endsWith(".csv") ? loadCsv(lp) : loadJson(lp);
        if (candles?.length) {
          console.log(`[O1_CACHE] legacy fallback: ${lp} (${candles.length} candles)`);
          break;
        }
      }
    }
    if (!candles?.length) throw new CacheMissingError();
    const ranged = filterRange(candles, options.startTimeMs, options.endTimeMs);
    if (!ranged.length) throw new CacheMissingError("No candles in BACKTEST_DAYS window.");
    console.log("[O1_CACHE] cache only — O1 API will not be called");
    return { source: "cache", cachePath, candles: ranged };
  }

  const all: NormalizedCandle[] = [];
  let toSec = Math.floor(options.endTimeMs / 1000);
  const startSec = Math.floor(options.startTimeMs / 1000);

  while (toSec > startSec) {
    const url = buildTvHistoryRequest(config, "1", options.countback, toSec);
    let ok = false;
    for (let a = 1; a <= options.maxRetries; a++) {
      const res = await fetchTvHistory(url);
      const payload = res.payload as TvHistoryOk | { s: string };
      if (res.ok && payload && "s" in payload && payload.s === "ok") {
        const page = historyPayloadToMinuteCandles(payload as TvHistoryOk);
        if (!page.length) break;
        all.push(...page);
        const earliest = page[0]!.openTime / 1000;
        if (earliest <= startSec) break;
        toSec = earliest - 60;
        ok = true;
        break;
      }
      await sleep(options.retryDelayMs * a);
    }
    if (!ok) break;
  }

  const candles = dedupeSort(filterRange(all, options.startTimeMs, options.endTimeMs));
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(candles));
  return { source: "downloaded", cachePath, candles };
};
