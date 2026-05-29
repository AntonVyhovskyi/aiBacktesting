import { checkEarlyStop } from "./earlyStop.js";
import { computeMetrics } from "./metrics.js";
import { balancedScore, overtradingScore, volumeProfitScore } from "./scoring.js";
import { highVolumeBreakevenScore, volumeScreeningScore } from "./volumePriority.js";
import type { SimState } from "./simulator.js";
import type { StrategyBacktestResult, StrategyContext } from "./types.js";

export const buildResult = (
  name: string,
  params: Record<string, number | string>,
  state: SimState,
  ctx: StrategyContext
): StrategyBacktestResult => {
  const metrics = computeMetrics(state.trades, ctx.initialBalance, ctx.backtestMsSpan);
  const early = checkEarlyStop(metrics);
  return {
    strategyName: name,
    params,
    trades: state.trades,
    metrics,
    diagnostics: state.diagnostics,
    screeningScore: volumeScreeningScore(metrics),
    balancedScore: balancedScore(metrics),
    volumeProfitScore: volumeProfitScore(metrics),
    overtradingScore: overtradingScore(metrics),
    highVolumeBreakevenScore: highVolumeBreakevenScore(metrics),
    earlyStopped: early.stop,
    earlyStopReason: early.reason,
  };
};
