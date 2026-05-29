import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { HighVolumeNearBreakevenEntry, RankedResult, StrategyBacktestResult } from "../types.js";
import { highVolumeBreakevenScore, toVolumeSummary } from "../volumePriority.js";

export const writeJson = (filePath: string, data: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

const hash = (name: string, params: Record<string, number | string>) =>
  crypto.createHash("md5").update(`${name}:${JSON.stringify(params)}`).digest("hex").slice(0, 12);

export const exportArtifacts = (
  r: StrategyBacktestResult,
  outputDir: string
): { tradeHistoryPath: string; equityCurvePath: string } => {
  const tradesDir = path.join(outputDir, "trades");
  const equityDir = path.join(outputDir, "equity");
  fs.mkdirSync(tradesDir, { recursive: true });
  fs.mkdirSync(equityDir, { recursive: true });
  const id = hash(r.strategyName, r.params);
  const tradeHistoryPath = path.join(tradesDir, `${r.strategyName}_${id}.json`);
  const equityCurvePath = path.join(equityDir, `${r.strategyName}_${id}.csv`);
  fs.writeFileSync(tradeHistoryPath, JSON.stringify(r.trades, null, 2));
  const lines = ["time,balance", `${r.metrics.startBalance},${r.metrics.startBalance}`];
  for (const t of r.trades) lines.push(`${t.exitTime},${t.balanceAfter}`);
  fs.writeFileSync(equityCurvePath, lines.join("\n"));
  return { tradeHistoryPath, equityCurvePath };
};

export const toRanked = (
  items: StrategyBacktestResult[],
  scoreFn: (r: StrategyBacktestResult) => number,
  outputDir: string,
  exportFiles: boolean
): RankedResult[] => {
  const sorted = [...items].sort((a, b) => scoreFn(b) - scoreFn(a)).slice(0, 50);
  return sorted.map((r, i) => {
    const paths = exportFiles
      ? exportArtifacts(r, outputDir)
      : { tradeHistoryPath: null as string | null, equityCurvePath: null as string | null };
    return {
      rank: i + 1,
      strategyName: r.strategyName,
      score: scoreFn(r),
      params: r.params,
      metrics: r.metrics,
      diagnostics: r.diagnostics,
      tradeHistoryPath: paths.tradeHistoryPath,
      equityCurvePath: paths.equityCurvePath,
      balancedScore: r.balancedScore,
      volumeProfitScore: r.volumeProfitScore,
      overtradingScore: r.overtradingScore,
      screeningScore: r.screeningScore,
      highVolumeBreakevenScore: r.highVolumeBreakevenScore,
    };
  });
};

export const toHighVolumeNearBreakevenRanked = (
  items: StrategyBacktestResult[],
  outputDir: string,
  exportFiles: boolean
): HighVolumeNearBreakevenEntry[] => {
  const sorted = [...items].sort(
    (a, b) => highVolumeBreakevenScore(b.metrics) - highVolumeBreakevenScore(a.metrics)
  );
  return sorted.slice(0, 50).map((r, i) => {
    const paths = exportFiles
      ? exportArtifacts(r, outputDir)
      : { tradeHistoryPath: null as string | null, equityCurvePath: null as string | null };
    const summary = toVolumeSummary(r);
    return {
      rank: i + 1,
      ...summary,
      tradeHistoryPath: paths.tradeHistoryPath,
      equityCurvePath: paths.equityCurvePath,
    };
  });
};

export const buildBestHighVolumeNearBreakeven = (
  items: StrategyBacktestResult[],
  usedFallback: boolean
) => {
  if (!items.length) return null;
  const best = items[0]!;
  return {
    usedFallback,
    ...toVolumeSummary(best),
  };
};
