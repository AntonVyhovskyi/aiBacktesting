import type { NormalizedCandle } from "./types.js";

export type CandleQualityReport = {
  symbol: string;
  cachePath: string;
  source?: string;
  count: number;
  spanDays: number;
  expectedCandles: number;
  coveragePct: number;
  duplicateTimestamps: number;
  gapCount: number;
  largestGapMinutes: number;
  missingEstimate: number;
  unordered: boolean;
  ok: boolean;
  reliable: boolean;
  warnings: string[];
  issues: string[];
};

export type QualityThresholds = {
  minSpanDays: number;
  minCoveragePct: number;
  maxGapCount: number;
  maxLargestGapMinutes: number;
};

const DEFAULT_THRESHOLDS: QualityThresholds = {
  minSpanDays: 150,
  minCoveragePct: 85,
  maxGapCount: 500,
  maxLargestGapMinutes: 30,
};

export const validateCandles = (
  candles: NormalizedCandle[],
  expectedIntervalMs = 60_000,
  thresholds: Partial<QualityThresholds> = {}
): Omit<CandleQualityReport, "symbol" | "cachePath"> => {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!candles.length) {
    return {
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
      issues: ["empty_candle_set"],
    };
  }

  let duplicateTimestamps = 0;
  let gapCount = 0;
  let largestGapMinutes = 0;
  let missingEstimate = 0;
  let unordered = false;

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1]!;
    const cur = candles[i]!;
    if (cur.openTime <= prev.openTime) {
      if (cur.openTime === prev.openTime) duplicateTimestamps += 1;
      else unordered = true;
    }
    const gap = cur.openTime - prev.openTime;
    if (gap > expectedIntervalMs * 1.5) {
      gapCount += 1;
      largestGapMinutes = Math.max(largestGapMinutes, gap / 60_000);
      missingEstimate += Math.max(0, Math.round(gap / expectedIntervalMs) - 1);
    }
  }

  const spanMs = candles[candles.length - 1]!.openTime - candles[0]!.openTime;
  const spanDays = spanMs / 86400000;
  const expectedCandles = Math.max(1, Math.floor(spanMs / expectedIntervalMs) + 1);
  const coveragePct = (candles.length / expectedCandles) * 100;

  if (duplicateTimestamps > 0) issues.push(`duplicate_timestamps=${duplicateTimestamps}`);
  if (unordered) issues.push("unordered_timestamps");
  if (gapCount > 0) warnings.push(`gaps=${gapCount} largestGapMin=${largestGapMinutes.toFixed(0)}`);
  if (spanDays < t.minSpanDays) issues.push(`short_history=${spanDays.toFixed(0)}d (need ${t.minSpanDays})`);
  if (coveragePct < t.minCoveragePct)
    issues.push(`low_coverage=${coveragePct.toFixed(1)}% (need ${t.minCoveragePct}%)`);
  if (gapCount > t.maxGapCount) issues.push(`too_many_gaps=${gapCount}`);
  if (largestGapMinutes > t.maxLargestGapMinutes)
    issues.push(`large_gap=${largestGapMinutes.toFixed(0)}min`);

  const ok = !unordered && duplicateTimestamps === 0;
  const reliable =
    ok &&
    spanDays >= t.minSpanDays &&
    coveragePct >= t.minCoveragePct &&
    gapCount <= t.maxGapCount &&
    largestGapMinutes <= t.maxLargestGapMinutes;

  return {
    count: candles.length,
    spanDays,
    expectedCandles,
    coveragePct: Math.round(coveragePct * 100) / 100,
    duplicateTimestamps,
    gapCount,
    largestGapMinutes,
    missingEstimate,
    unordered,
    ok,
    reliable,
    warnings,
    issues,
  };
};

export const validateCandlesForRange = (
  candles: NormalizedCandle[],
  rangeStartMs: number,
  rangeEndMs: number,
  expectedIntervalMs = 60_000,
  thresholds: Partial<QualityThresholds> = {}
): Omit<CandleQualityReport, "symbol" | "cachePath" | "source"> => {
  const inRange = candles
    .filter((c) => c.openTime >= rangeStartMs && c.openTime <= rangeEndMs)
    .sort((a, b) => a.openTime - b.openTime);
  const spanMs = rangeEndMs - rangeStartMs;
  const expectedCandles = Math.max(1, Math.floor(spanMs / expectedIntervalMs) + 1);
  const t = { minCoveragePct: 90, minSpanDays: 150, maxGapCount: 50, maxLargestGapMinutes: 5, ...thresholds };
  const base = validateCandles(inRange, expectedIntervalMs, {
    ...t,
    minSpanDays: 0,
    minCoveragePct: 0,
  });
  const coveragePct = (inRange.length / expectedCandles) * 100;
  const spanDays = spanMs / 86400000;
  const issues = base.issues.filter(
    (i) => !i.startsWith("low_coverage=") && !i.startsWith("short_history=")
  );
  if (coveragePct < t.minCoveragePct) {
    issues.push(`low_coverage=${coveragePct.toFixed(1)}% (need ${t.minCoveragePct}%)`);
  }
  if (spanDays < t.minSpanDays) {
    issues.push(`short_history=${spanDays.toFixed(0)}d (need ${t.minSpanDays})`);
  }
  const reliable =
    base.ok &&
    inRange.length > 0 &&
    spanDays >= t.minSpanDays &&
    coveragePct >= t.minCoveragePct &&
    base.gapCount <= t.maxGapCount &&
    base.largestGapMinutes <= t.maxLargestGapMinutes;

  return {
    ...base,
    count: inRange.length,
    spanDays,
    expectedCandles,
    coveragePct: Math.round(coveragePct * 100) / 100,
    issues,
    reliable,
  };
};

export const formatQualityReport = (report: CandleQualityReport): string => {
  const lines = [
    `## ${report.symbol}`,
    "",
    ...(report.source ? [`- Source: **${report.source}**`, ""] : []),
    `- Cache: \`${report.cachePath}\``,
    `- Candles: **${report.count.toLocaleString()}** (~${report.spanDays.toFixed(0)} days)`,
    `- Coverage: **${report.coveragePct}%** (expected ~${report.expectedCandles.toLocaleString()})`,
    `- Gaps: ${report.gapCount} (largest ${report.largestGapMinutes.toFixed(0)} min, ~${report.missingEstimate} missing bars)`,
    `- Duplicates: ${report.duplicateTimestamps}`,
    `- Reliable for optimization: **${report.reliable ? "YES" : "NO — RESULTS UNRELIABLE"}**`,
  ];
  if (report.issues.length) lines.push(`- Issues: ${report.issues.join("; ")}`);
  if (report.warnings.length) lines.push(`- Warnings: ${report.warnings.join("; ")}`);
  return lines.join("\n");
};
