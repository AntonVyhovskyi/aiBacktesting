import { ADX, ATR, BollingerBands, EMA, RSI } from "technicalindicators";
import type { NormalizedCandle } from "../backtest/types.js";

const pad = (values: number[], len: number): number[] => {
  const n = len - values.length;
  return n <= 0 ? values : [...Array(n).fill(NaN), ...values];
};

export type BbConfig = { period: number; stdDev: number };

export const bbCacheKey = (period: number, stdDev = 2): string => `${period}_${stdDev}`;

export type IndicatorRequirements = {
  emaPeriods?: number[];
  atrPeriods?: number[];
  rsiPeriods?: number[];
  adxPeriods?: number[];
  bbPeriods?: number[];
  bbConfigs?: BbConfig[];
  donchianPeriods?: number[];
  volumeSmaPeriods?: number[];
  vwap?: boolean;
};

export type DiscoveryIndicatorCache = {
  length: number;
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  vwap: number[];
  ema: Map<number, number[]>;
  atr: Map<number, number[]>;
  rsi: Map<number, number[]>;
  adx: Map<number, number[]>;
  bb: Map<string, { upper: number[]; middle: number[]; lower: number[] }>;
  donchianHigh: Map<number, number[]>;
  donchianLow: Map<number, number[]>;
  volumeSma: Map<number, number[]>;
};

export const fin = (v: number | undefined): boolean => v !== undefined && Number.isFinite(v) && !Number.isNaN(v);

const donchian = (highs: number[], lows: number[], period: number) => {
  const high: number[] = [];
  const low: number[] = [];
  for (let i = 0; i < highs.length; i++) {
    if (i < period - 1) {
      high.push(NaN);
      low.push(NaN);
    } else {
      high.push(Math.max(...highs.slice(i - period + 1, i + 1)));
      low.push(Math.min(...lows.slice(i - period + 1, i + 1)));
    }
  }
  return { high, low };
};

const volSma = (volumes: number[], period: number) => {
  const out: number[] = [];
  for (let i = 0; i < volumes.length; i++) {
    if (i < period - 1) out.push(NaN);
    else out.push(volumes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
  }
  return out;
};

const buildVwap = (typical: number[], volumes: number[]) => {
  const out: number[] = [];
  let cv = 0;
  let ctp = 0;
  for (let i = 0; i < typical.length; i++) {
    cv += volumes[i]!;
    ctp += typical[i]! * volumes[i]!;
    out.push(cv > 0 ? ctp / cv : typical[i]!);
  }
  return out;
};

export const buildDiscoveryIndicatorCache = (
  candles: NormalizedCandle[],
  req: IndicatorRequirements
): DiscoveryIndicatorCache => {
  const length = candles.length;
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);
  const typical = candles.map((c) => (c.high + c.low + c.close) / 3);

  const ema = new Map<number, number[]>();
  for (const p of req.emaPeriods ?? []) ema.set(p, pad(EMA.calculate({ values: closes, period: p }), length));

  const atr = new Map<number, number[]>();
  for (const p of req.atrPeriods ?? [])
    atr.set(p, pad(ATR.calculate({ high: highs, low: lows, close: closes, period: p }), length));

  const rsi = new Map<number, number[]>();
  for (const p of req.rsiPeriods ?? []) rsi.set(p, pad(RSI.calculate({ values: closes, period: p }), length));

  const adx = new Map<number, number[]>();
  for (const p of req.adxPeriods ?? []) {
    const raw = ADX.calculate({ high: highs, low: lows, close: closes, period: p });
    adx.set(p, pad(raw.map((r) => r.adx), length));
  }

  const bb = new Map<string, { upper: number[]; middle: number[]; lower: number[] }>();
  const bbSeen = new Set<string>();
  const addBb = (period: number, stdDev: number) => {
    const key = bbCacheKey(period, stdDev);
    if (bbSeen.has(key)) return;
    bbSeen.add(key);
    const raw = BollingerBands.calculate({ period, stdDev, values: closes });
    bb.set(key, {
      upper: pad(raw.map((r) => r.upper), length),
      middle: pad(raw.map((r) => r.middle), length),
      lower: pad(raw.map((r) => r.lower), length),
    });
  };
  for (const p of req.bbPeriods ?? []) addBb(p, 2);
  for (const cfg of req.bbConfigs ?? []) addBb(cfg.period, cfg.stdDev);

  const donchianHigh = new Map<number, number[]>();
  const donchianLow = new Map<number, number[]>();
  for (const p of req.donchianPeriods ?? []) {
    const d = donchian(highs, lows, p);
    donchianHigh.set(p, d.high);
    donchianLow.set(p, d.low);
  }

  const volumeSma = new Map<number, number[]>();
  for (const p of req.volumeSmaPeriods ?? []) volumeSma.set(p, volSma(volumes, p));

  return {
    length,
    closes,
    highs,
    lows,
    volumes,
    vwap: req.vwap ? buildVwap(typical, volumes) : typical.map(() => NaN),
    ema,
    atr,
    rsi,
    adx,
    bb,
    donchianHigh,
    donchianLow,
    volumeSma,
  };
};
