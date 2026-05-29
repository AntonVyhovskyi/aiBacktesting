import type { NormalizedCandle } from "./types.js";

export const filterCandlesByRange = (
  candles: NormalizedCandle[],
  startTimeMs: number,
  endTimeMs: number
): NormalizedCandle[] =>
  candles.filter((c) => c.openTime >= startTimeMs && c.openTime <= endTimeMs);

export const resampleCandles = (
  candles: NormalizedCandle[],
  intervalMinutes: number
): NormalizedCandle[] => {
  if (intervalMinutes <= 1) return candles;
  const bucketMs = intervalMinutes * 60_000;
  const out: NormalizedCandle[] = [];
  let bucket: NormalizedCandle | null = null;
  let bucketStart = 0;

  for (const c of candles) {
    const start = Math.floor(c.openTime / bucketMs) * bucketMs;
    if (!bucket || start !== bucketStart) {
      if (bucket) out.push(bucket);
      bucketStart = start;
      bucket = {
        openTime: start,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        closeTime: start + bucketMs - 1,
      };
    } else {
      bucket.high = Math.max(bucket.high, c.high);
      bucket.low = Math.min(bucket.low, c.low);
      bucket.close = c.close;
      bucket.volume += c.volume;
      bucket.closeTime = start + bucketMs - 1;
    }
  }
  if (bucket) out.push(bucket);
  return out;
};

export const resolveStrategyCandles = (
  minuteCandles: NormalizedCandle[],
  timeframe: string
): NormalizedCandle[] => {
  const tf = timeframe.toLowerCase();
  if (tf === "1m") return minuteCandles;
  if (tf === "3m") return resampleCandles(minuteCandles, 3);
  if (tf === "5m") return resampleCandles(minuteCandles, 5);
  if (tf === "15m") return resampleCandles(minuteCandles, 15);
  throw new Error(`Unsupported timeframe: ${timeframe}`);
};
