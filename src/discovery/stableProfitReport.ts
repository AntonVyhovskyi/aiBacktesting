import { stableProfitSummary } from "./stableProfitEvaluation.js";

type FinalPayload = {
  generatedAt: string;
  targetAchieved: boolean;
  nearbyVariantsPassing: number;
  targetRequirements: Record<string, number>;
  testedVariants: number;
  elapsedSec: number;
  bestStrategy: ReturnType<typeof stableProfitSummary> & {
    tradeHistoryPath?: string | null;
    equityCurvePath?: string | null;
    rejectionReasons?: string[];
  } | null;
};

export const buildStableProfitReportMd = (final: FinalPayload, cachePath: string): string => {
  const b = final.bestStrategy;
  const lines: string[] = [
    "# Stable Profit 6-Month Search Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Search completed: ${final.generatedAt}`,
    `Candle cache: \`${cachePath}\``,
    "",
    "## Target",
    "",
    "Find strategies with **≥+10% net PnL in every full calendar month** over 6 months, with low drawdown, profit factor ≥1.2, fees included, and no single-month dominance.",
    "",
    `**Target achieved:** ${final.targetAchieved ? "YES" : "NO"}`,
  ];

  if (final.targetAchieved) {
    lines.push(`Confirmed with **${final.nearbyVariantsPassing}** nearby parameter variants also passing.`);
  }

  lines.push("", "## Best candidate", "");

  if (!b) {
    lines.push("_No viable candidate found._");
    return lines.join("\n");
  }

  const fp = b.fullPeriod;
  lines.push(
    `**Strategy:** \`${b.strategyName}\``,
    "",
    "### Parameters",
    "",
    "```json",
    JSON.stringify(b.params, null, 2),
    "```",
    "",
    "### Full 6-month metrics",
    "",
    "| Metric | Value |",
    "|--------|------:|",
    `| Net PnL | ${fp.totalNetPnL?.toFixed(2)} USDC (${fp.totalNetPnLPct?.toFixed(2)}%) |`,
    `| Gross PnL | ${fp.grossPnL?.toFixed(2)} USDC |`,
    `| Total fees | ${fp.totalFees?.toFixed(2)} USDC |`,
    `| Trades | ${fp.tradesCount} |`,
    `| Win rate | ${fp.winRate?.toFixed(1)}% |`,
    `| Profit factor | ${fp.profitFactor?.toFixed(3)} |`,
    `| Max drawdown | ${fp.maxDrawdownPct?.toFixed(2)}% |`,
    `| Avg monthly PnL % | ${b.averageMonthlyPnLPct?.toFixed(2)}% |`,
    `| Worst month PnL % | ${b.worstMonthlyPnLPct?.toFixed(2)}% |`,
    `| Best month PnL % | ${b.bestMonthlyPnLPct?.toFixed(2)}% |`,
    `| Profitable months | ${b.profitableMonths} |`,
    `| Months ≥10% | ${b.monthsMeetingTargetPct} |`,
    `| One-month dominance | ${b.oneMonthDominancePct?.toFixed(1)}% |`,
    "",
    "### Monthly results",
    "",
    "| Month | Net PnL | Net % | Trades | Fees | Max DD % | PF |",
    "|-------|--------:|------:|-------:|-----:|---------:|---:|"
  );

  for (const m of b.monthly ?? []) {
    lines.push(
      `| ${m.monthKey} | ${m.netPnL.toFixed(2)} | ${m.netPnLPct.toFixed(2)}% | ${m.tradesCount} | ${m.fees.toFixed(2)} | ${m.maxDrawdownPct.toFixed(2)} | ${m.profitFactor.toFixed(2)} |`
    );
  }

  lines.push("", "### Requirement checklist", "", "| Requirement | Pass | Actual |", "|-------------|:----:|--------|");
  for (const t of b.targetCheck ?? []) {
    lines.push(`| ${t.label} | ${t.passed ? "✓" : "✗"} | ${t.actual} |`);
  }

  if (b.rejectionReasons?.length) {
    lines.push("", "### Why it failed", "", ...b.rejectionReasons.map((r) => `- ${r}`));
  }

  lines.push(
    "",
    "## Risks",
    "",
    "- Past 6-month stability does not guarantee future +10%/month.",
    "- High trade counts increase fee sensitivity on O1.",
    "- Calendar-month boundaries can hide intra-month drawdown clusters.",
    "- Parameter neighborhoods were only lightly checked unless target was achieved.",
    "",
    "## Paper trading suitability",
    ""
  );

  if (final.targetAchieved) {
    lines.push(
      "**Suitable for cautious paper trading** with strict live risk caps mirroring backtest (monthly loss halt, max DD halt).",
      "Start with reduced size vs backtest."
    );
  } else if (b.monthsMeetingTargetPct >= 4 && (b.fullPeriod?.maxDrawdownPct ?? 100) <= 15) {
    lines.push(
      "**Conditional paper testing only** — close to target but not all months ≥10%. Use for signal quality monitoring, not full size."
    );
  } else {
    lines.push(
      "**Not recommended for paper trading yet** — fails one or more hard monthly consistency requirements.",
      "Treat as research baseline only."
    );
  }

  lines.push(
    "",
    "## What to improve next",
    "",
    "1. Tighten entries (higher `minMoveVsFeeMult`, volume/ADX filters) to raise win rate.",
    "2. Reduce `maxTradesPerDay` if fees dominate.",
    "3. Add regime filter (skip low-vol or trending chop months).",
    "4. Walk-forward on months 1–4 train / 5–6 validate.",
    "5. Re-run search with `STABLE_PROFIT_DISCOVERY_MODE=full` if budget allows.",
    "",
    "## Artifacts",
    "",
    `- Tested variants: ${final.testedVariants} (${(final.elapsedSec / 60).toFixed(1)} min)`,
    b.tradeHistoryPath ? `- Trades: \`${b.tradeHistoryPath}\`` : "",
    b.equityCurvePath ? `- Equity: \`${b.equityCurvePath}\`` : "",
    "- Full JSON: `data/results/stable-profit-6m-search-final.json`"
  );

  return lines.filter(Boolean).join("\n");
};
