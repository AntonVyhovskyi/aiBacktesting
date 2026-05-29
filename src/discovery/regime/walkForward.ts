import { buildPeriodReport, type PeriodReport } from "./regimeBacktestMetrics.js";
import type { StrategyBacktestResult } from "../types.js";

export type WalkForwardSlice = {
  windowIndex: number;
  trainStart: number;
  trainEnd: number;
  valEnd: number;
  oosEnd: number;
};

export type WalkForwardWindowResult = {
  slice: WalkForwardSlice;
  train: PeriodReport;
  validation: PeriodReport;
  outOfSample: PeriodReport;
};

export const buildRollingWalkForwardSlices = (
  rangeStart: number,
  rangeEnd: number,
  windowCount: number,
  trainPct = 0.5,
  valPct = 0.15
): WalkForwardSlice[] => {
  const span = rangeEnd - rangeStart;
  const windowSpan = span / windowCount;
  const slices: WalkForwardSlice[] = [];

  for (let w = 0; w < windowCount; w++) {
    const wStart = rangeStart + w * windowSpan;
    const wEnd = w === windowCount - 1 ? rangeEnd : rangeStart + (w + 1) * windowSpan;
    const inner = wEnd - wStart;
    slices.push({
      windowIndex: w + 1,
      trainStart: wStart,
      trainEnd: wStart + inner * trainPct,
      valEnd: wStart + inner * (trainPct + valPct),
      oosEnd: wEnd,
    });
  }
  return slices;
};

export const evaluateWalkForwardWindow = (
  label: string,
  resultTrain: StrategyBacktestResult,
  resultVal: StrategyBacktestResult,
  resultOos: StrategyBacktestResult,
  slice: WalkForwardSlice,
  startBalance: number
): WalkForwardWindowResult => ({
  slice,
  train: buildPeriodReport(`${label}_w${slice.windowIndex}_train`, resultTrain.trades, slice.trainStart, slice.trainEnd, startBalance),
  validation: buildPeriodReport(`${label}_w${slice.windowIndex}_val`, resultVal.trades, slice.trainEnd, slice.valEnd, startBalance),
  outOfSample: buildPeriodReport(`${label}_w${slice.windowIndex}_oos`, resultOos.trades, slice.valEnd, slice.oosEnd, startBalance),
});

export const aggregateOosReports = (windows: WalkForwardWindowResult[]): PeriodReport[] =>
  windows.map((w) => w.outOfSample);
