import type { O1FetchConfig } from "../backtest/types.js";
import type { NormalizedCandle } from "../backtest/types.js";

export type TvHistoryOk = {
  s: "ok";
  t: number[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
};

export const buildTvHistoryRequest = (
  config: O1FetchConfig,
  resolution: string,
  countback: number,
  toSec: number
): string => {
  const params = new URLSearchParams({
    symbol: config.symbol,
    marketId: String(config.marketId),
    resolution,
    countback: String(countback),
    to: String(toSec),
  });
  return `${config.webServerUrl}/tv/history?${params}`;
};

export const fetchTvHistory = async (
  url: string,
  timeoutMs = 60_000
): Promise<{ ok: boolean; status: number; body: string; payload: unknown }> => {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  const body = await res.text();
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    payload = null;
  }
  return { ok: res.ok, status: res.status, body, payload };
};

export const historyPayloadToMinuteCandles = (payload: TvHistoryOk): NormalizedCandle[] => {
  const out: NormalizedCandle[] = [];
  for (let i = 0; i < payload.t.length; i++) {
    const openTime = payload.t[i]! * 1000;
    out.push({
      openTime,
      open: payload.o[i]!,
      high: payload.h[i]!,
      low: payload.l[i]!,
      close: payload.c[i]!,
      volume: payload.v[i] ?? 0,
      closeTime: openTime + 60_000 - 1,
    });
  }
  return out;
};
