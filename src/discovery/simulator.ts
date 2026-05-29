import type { NormalizedCandle } from "../backtest/types.js";
import type { EntryExecutionMode, StrategyDiagnostics } from "./types.js";
import { num } from "./grids.js";

export type SimState = {
  balance: number;
  position: {
    direction: "long" | "short";
    entryTime: number;
    entryPrice: number;
    entryIndex: number;
    qty: number;
    stopLoss: number;
    trailingActive: boolean;
    entryFee: number;
    breakEvenActive: boolean;
    entryRegime?: string;
    entryStop?: number;
  } | null;
  pending: {
    direction: "long" | "short";
    signalIndex: number;
    stopLoss: number;
    meta?: { entryRegime?: string };
  } | null;
  trades: import("./types.js").DiscoveryTrade[];
  diagnostics: StrategyDiagnostics;
  cooldownUntil: number;
  tradesToday: Map<string, number>;
  lastDayKey: string;
  activeParams: Record<string, number | string>;
};

const round = (v: number, d = 8) => Math.round(v * 10 ** d) / 10 ** d;

export const emptyDiag = (): StrategyDiagnostics => ({
  signalCount: 0,
  crossoverCount: 0,
  entriesAllowed: 0,
  tradesOpened: 0,
  skippedByFilter: 0,
  skippedByRisk: 0,
  skippedByMargin: 0,
  skippedInvalidStop: 0,
  exitsByStopLoss: 0,
  exitsByTrailing: 0,
  exitsBySignal: 0,
  exitsByEndOfData: 0,
  exitsByTakeProfit: 0,
  exitsByMaxHold: 0,
});

export const createSim = (balance: number, params: Record<string, number | string>): SimState => ({
  balance,
  position: null,
  pending: null,
  trades: [],
  diagnostics: emptyDiag(),
  cooldownUntil: -1,
  tradesToday: new Map(),
  lastDayKey: "",
  activeParams: params,
});

const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

const canEnter = (state: SimState, index: number): boolean => {
  if (index < state.cooldownUntil) {
    state.diagnostics.skippedByFilter += 1;
    return false;
  }
  const maxPerDay = num(state.activeParams, "maxTradesPerDay", 999);
  if (maxPerDay < 999 && (state.tradesToday.get(state.lastDayKey) ?? 0) >= maxPerDay) {
    state.diagnostics.skippedByFilter += 1;
    return false;
  }
  return true;
};

export const closePos = (
  state: SimState,
  candle: NormalizedCandle,
  exitIndex: number,
  exitPrice: number,
  reason: string,
  feeRate: number,
  kind: keyof StrategyDiagnostics
): void => {
  const pos = state.position;
  if (!pos) return;
  const exitFee = round(exitPrice * pos.qty * feeRate);
  const gross =
    pos.direction === "long"
      ? (exitPrice - pos.entryPrice) * pos.qty
      : (pos.entryPrice - exitPrice) * pos.qty;
  const fees = pos.entryFee + exitFee;
  const net = gross - fees;
  state.balance += net;
  const initialRisk = Math.abs(pos.entryPrice - (pos.entryStop ?? pos.stopLoss)) * pos.qty;
  state.trades.push({
    direction: pos.direction,
    entryTime: pos.entryTime,
    entryPrice: pos.entryPrice,
    exitTime: candle.openTime,
    exitPrice,
    qty: pos.qty,
    grossPnL: round(gross),
    fees: round(fees),
    netPnL: round(net),
    balanceAfter: round(state.balance),
    exitReason: reason,
    durationCandles: Math.max(1, exitIndex - pos.entryIndex + 1),
    entryRegime: pos.entryRegime,
    entryStop: pos.entryStop ?? pos.stopLoss,
    initialRiskUsdc: round(initialRisk),
  });
  (state.diagnostics as Record<string, number>)[kind] =
    ((state.diagnostics as Record<string, number>)[kind] ?? 0) + 1;
  state.position = null;
  const cd = num(state.activeParams, "cooldownCandles", 0);
  if (cd > 0) state.cooldownUntil = exitIndex + cd;
};

export const calcQty = (bal: number, entry: number, stop: number, risk: number, lev: number): number => {
  const dist = Math.abs(entry - stop);
  if (dist <= 0 || entry <= 0) return 0;
  let qty = (bal * (risk / 100)) / dist;
  if ((qty * entry) / lev > bal) qty = (bal * lev) / entry;
  return round(Number.isFinite(qty) ? qty : 0, 8);
};

export const tryOpen = (
  state: SimState,
  candle: NormalizedCandle,
  index: number,
  dir: "long" | "short",
  entry: number,
  stop: number,
  risk: number,
  lev: number,
  feeRate: number,
  meta?: { entryRegime?: string }
): boolean => {
  if (!canEnter(state, index)) return false;
  if (Math.abs(entry - stop) <= 0) {
    state.diagnostics.skippedInvalidStop += 1;
    return false;
  }
  const qty = calcQty(state.balance, entry, stop, risk, lev);
  if (qty <= 0) {
    state.diagnostics.skippedByMargin += 1;
    return false;
  }
  state.diagnostics.tradesOpened += 1;
  const dk = dayKey(candle.openTime);
  state.lastDayKey = dk;
  state.tradesToday.set(dk, (state.tradesToday.get(dk) ?? 0) + 1);
  state.position = {
    direction: dir,
    entryTime: candle.openTime,
    entryPrice: entry,
    entryIndex: index,
    qty,
    stopLoss: stop,
    trailingActive: false,
    entryFee: round(entry * qty * feeRate),
    breakEvenActive: false,
    entryRegime: meta?.entryRegime,
    entryStop: stop,
  };
  return true;
};

export const manageExits = (
  state: SimState,
  candle: NormalizedCandle,
  index: number,
  feeRate: number
): void => {
  const pos = state.position;
  if (!pos) return;
  const p = state.activeParams;

  const maxHold = num(p, "maxHoldCandles", 0);
  if (maxHold > 0 && index - pos.entryIndex >= maxHold) {
    closePos(state, candle, index, candle.close, "max_hold", feeRate, "exitsByMaxHold");
    return;
  }

  const tp = num(p, "takeProfitPct", 0);
  if (tp > 0) {
    const pp =
      pos.direction === "long"
        ? ((candle.close - pos.entryPrice) / pos.entryPrice) * 100
        : ((pos.entryPrice - candle.close) / pos.entryPrice) * 100;
    if (pp >= tp) {
      closePos(state, candle, index, candle.close, "take_profit", feeRate, "exitsByTakeProfit");
      return;
    }
  }

  const be = num(p, "breakEvenPct", 0);
  if (be > 0 && !pos.breakEvenActive) {
    const pp =
      pos.direction === "long"
        ? ((candle.close - pos.entryPrice) / pos.entryPrice) * 100
        : ((pos.entryPrice - candle.close) / pos.entryPrice) * 100;
    if (pp >= be) {
      pos.stopLoss = pos.entryPrice;
      pos.breakEvenActive = true;
    }
  }

  const ts = num(p, "trailStart", 0);
  const tg = num(p, "trailGap", 0);
  if (ts > 0 && tg > 0) {
    const pp =
      pos.direction === "long"
        ? ((candle.close - pos.entryPrice) / pos.entryPrice) * 100
        : ((pos.entryPrice - candle.close) / pos.entryPrice) * 100;
    if (!pos.trailingActive && pp >= ts) pos.trailingActive = true;
    if (pos.trailingActive) {
      const cand =
        pos.direction === "long" ? candle.close * (1 - tg / 100) : candle.close * (1 + tg / 100);
      if (pos.direction === "long" ? cand > pos.stopLoss : cand < pos.stopLoss) pos.stopLoss = round(cand);
    }
  }

  if (pos.direction === "long" && candle.low <= pos.stopLoss) {
    closePos(
      state,
      candle,
      index,
      pos.stopLoss,
      pos.trailingActive ? "trail" : "stop",
      feeRate,
      pos.trailingActive ? "exitsByTrailing" : "exitsByStopLoss"
    );
  } else if (pos.direction === "short" && candle.high >= pos.stopLoss) {
    closePos(
      state,
      candle,
      index,
      pos.stopLoss,
      pos.trailingActive ? "trail" : "stop",
      feeRate,
      pos.trailingActive ? "exitsByTrailing" : "exitsByStopLoss"
    );
  }
};

export const runBar = (
  state: SimState,
  candles: NormalizedCandle[],
  index: number,
  entryMode: EntryExecutionMode,
  risk: number,
  lev: number,
  feeRate: number
): void => {
  const c = candles[index]!;
  if (state.pending && !state.position && entryMode === "nextOpen" && index === state.pending.signalIndex + 1) {
    tryOpen(
      state,
      c,
      index,
      state.pending.direction,
      c.open,
      state.pending.stopLoss,
      risk,
      lev,
      feeRate,
      state.pending.meta
    );
    state.pending = null;
  }
  manageExits(state, c, index, feeRate);
};

export const signal = (
  state: SimState,
  candles: NormalizedCandle[],
  index: number,
  dir: "long" | "short",
  stop: number,
  entryMode: EntryExecutionMode,
  risk: number,
  lev: number,
  feeRate: number,
  meta?: { entryRegime?: string }
): void => {
  state.diagnostics.signalCount += 1;
  state.diagnostics.entriesAllowed += 1;
  const c = candles[index]!;
  if (entryMode === "close") tryOpen(state, c, index, dir, c.close, stop, risk, lev, feeRate, meta);
  else if (index + 1 < candles.length)
    state.pending = { direction: dir, signalIndex: index, stopLoss: stop, meta };
};

export const finalize = (state: SimState, candles: NormalizedCandle[], feeRate: number): void => {
  if (state.position) {
    const i = candles.length - 1;
    closePos(state, candles[i]!, i, candles[i]!.close, "eod", feeRate, "exitsByEndOfData");
  }
};
