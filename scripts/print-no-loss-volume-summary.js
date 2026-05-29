const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const outputPath = path.join(root, "data/results/no-loss-volume-strategy-report.md");

const sourceFiles = [
  "data/results/autonomous-weekly-volume-search-final.json",
  "data/results/max-monthly-volume-10dd-search-final.json",
];
const sourceGeneratedAt = new Map();

const round = (value, digits = 6) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  const p = 10 ** digits;
  return Math.round(value * p) / p;
};

const fmt = (value, digits = 2) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const metricNumber = (metrics, keys) => {
  for (const key of keys) {
    const value = metrics[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
};

const stableString = (candidate) => {
  if (typeof candidate.nearBreakevenOrProfitableWeeks !== "number") return "n/a";
  const fullWeeks = Array.isArray(candidate.weekly)
    ? candidate.weekly.filter((w) => w?.isFullWeek).length
    : undefined;
  return `${candidate.nearBreakevenOrProfitableWeeks}/${fullWeeks ?? "?"}`;
};

const paramsKey = (params) => JSON.stringify(params ?? {});

const collectCandidates = (value, sourceFile, pathParts = [], rows = []) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectCandidates(item, sourceFile, [...pathParts, index], rows));
    return rows;
  }
  if (!value || typeof value !== "object") return rows;

  if (typeof value.strategyName === "string" && value.metrics && typeof value.metrics === "object") {
    const metrics = value.metrics;
    const totalNotional = metricNumber(metrics, [
      "totalNotional",
      "totalNotionalVolume",
      "totalMonthlyNotionalVolume",
    ]);
    const avgWeekly =
      typeof value.averageWeeklyNotionalVolume === "number"
        ? value.averageWeeklyNotionalVolume
        : metricNumber(metrics, ["averageWeeklyNotionalVolume"]);

    rows.push({
      sourceFile,
      sourcePath: pathParts.join(".") || "<root>",
      strategyName: value.strategyName,
      params: value.params ?? {},
      score: value.weeklyVolumeTargetScore ?? value.maxVolumeWithRiskScore ?? value.score,
      totalNotional,
      averageWeeklyNotionalVolume: avgWeekly,
      netPnL: metricNumber(metrics, ["netPnL"]),
      netPnLPct: metricNumber(metrics, ["netPnLPct"]),
      grossPnL: metricNumber(metrics, ["grossPnL"]),
      totalFees: metricNumber(metrics, ["totalFees"]),
      tradesCount: metricNumber(metrics, ["tradesCount"]),
      tradesPerDay: metricNumber(metrics, ["tradesPerDay"]),
      winRate: metricNumber(metrics, ["winRate"]),
      profitFactor: metricNumber(metrics, ["profitFactor"]),
      maxDrawdownPct: metricNumber(metrics, ["maxDrawdownPct"]),
      maxWeeklyDrawdownPct: value.maxWeeklyDrawdownPct,
      stableWeeks: stableString(value),
      hardTargetFailures: value.hardTargetFailures ?? [],
      fallbackIssues: value.fallbackIssues ?? [],
      weekly: value.weekly ?? [],
    });
  }

  for (const [key, child] of Object.entries(value)) {
    collectCandidates(child, sourceFile, [...pathParts, key], rows);
  }
  return rows;
};

const loadRows = () => {
  const rows = [];
  for (const rel of sourceFiles) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    const data = JSON.parse(fs.readFileSync(abs, "utf8"));
    if (typeof data.generatedAt === "string") sourceGeneratedAt.set(rel, data.generatedAt);
    collectCandidates(data, rel, [], rows);
  }
  return rows;
};

const uniqueRows = (rows) => {
  const byKey = new Map();
  for (const row of rows) {
    const key = [
      row.strategyName,
      paramsKey(row.params),
      round(row.totalNotional ?? 0, 3),
      round(row.netPnL ?? 0, 6),
      round(row.maxDrawdownPct ?? 0, 6),
    ].join("|");
    const existing = byKey.get(key);
    if (!existing || (row.sourcePath.length < existing.sourcePath.length)) byKey.set(key, row);
  }
  return [...byKey.values()];
};

const isNoLossCandidate = (row) =>
  typeof row.netPnL === "number" &&
  row.netPnL >= 0 &&
  typeof row.tradesCount === "number" &&
  row.tradesCount > 0 &&
  typeof row.totalNotional === "number" &&
  row.totalNotional > 0 &&
  (typeof row.profitFactor !== "number" || row.profitFactor >= 1);

const rankedNoLossCandidates = uniqueRows(loadRows())
  .filter(isNoLossCandidate)
  .sort((a, b) => (b.totalNotional ?? 0) - (a.totalNotional ?? 0));

if (rankedNoLossCandidates.length === 0) {
  console.error("No no-loss volume candidates found in known result files.");
  process.exit(1);
}

const best = rankedNoLossCandidates[0];
const top = rankedNoLossCandidates.slice(0, 8);

const paramsBlock = JSON.stringify(best.params, null, 2);
const failures = [...(best.hardTargetFailures ?? []), ...(best.fallbackIssues ?? [])];
const weeklyRows = Array.isArray(best.weekly)
  ? best.weekly
      .map(
        (w) =>
          `| ${w.weekIndex} | ${String(w.startTime).slice(0, 10)} | ${fmt(
            w.notionalVolumeUsdc,
            2
          )} | ${fmt(w.netPnL, 6)} | ${fmt(w.totalFees, 6)} | ${fmt(
            w.maxDrawdownPct,
            2
          )}% | ${w.tradesCount} |`
      )
      .join("\n")
  : "";

const leaderboard = top
  .map(
    (row, index) =>
      `| ${index + 1} | ${row.strategyName} | ${fmt(row.totalNotional, 2)} | ${fmt(
        row.averageWeeklyNotionalVolume,
        2
      )} | ${fmt(row.netPnL, 6)} | ${fmt(row.maxDrawdownPct, 2)}% | ${fmt(
        row.profitFactor,
        3
      )} | ${fmt(row.tradesPerDay, 3)} | ${row.sourceFile}:${row.sourcePath} |`
  )
  .join("\n");

const reportGeneratedAt = sourceGeneratedAt.get(best.sourceFile) ?? "unknown";

const report = `# No-Loss Volume Strategy Report

Generated from source artifact: ${reportGeneratedAt}

## Recommendation

Use **${best.strategyName}** as the current best candidate for generating volume without losing money in the available search artifacts.

This is a **near-breakeven volume strategy**, not a fully validated production strategy. It produced positive net PnL after fees in the backtest, but it did **not** meet the stricter target for weekly volume and trade frequency.

## Best candidate metrics

| Metric | Value |
|---|---:|
| Source | \`${best.sourceFile}:${best.sourcePath}\` |
| Total notional volume | ${fmt(best.totalNotional, 2)} USDC |
| Average weekly notional | ${fmt(best.averageWeeklyNotionalVolume, 2)} USDC |
| Net PnL after fees | ${fmt(best.netPnL, 6)} USDC (${fmt(best.netPnLPct, 6)}%) |
| Gross PnL | ${fmt(best.grossPnL, 6)} USDC |
| Fees | ${fmt(best.totalFees, 6)} USDC |
| Profit factor | ${fmt(best.profitFactor, 6)} |
| Max drawdown | ${fmt(best.maxDrawdownPct, 6)}% |
| Max weekly drawdown | ${fmt(best.maxWeeklyDrawdownPct, 6)}% |
| Trades | ${fmt(best.tradesCount, 0)} |
| Trades/day | ${fmt(best.tradesPerDay, 6)} |
| Win rate | ${fmt(best.winRate, 6)}% |
| Stable weeks | ${best.stableWeeks} |

## Parameters

\`\`\`json
${paramsBlock}
\`\`\`

## Why this is the best current answer

- It is the highest-notional candidate found with **netPnL >= 0** and **profitFactor >= 1**.
- Fees were covered by gross PnL: gross ${fmt(best.grossPnL, 6)} USDC vs fees ${fmt(
  best.totalFees,
  6
)} USDC.
- Drawdown stayed low in the available result: ${fmt(best.maxDrawdownPct, 6)}%.

## Important limitations

${failures.length ? failures.map((x) => `- ${x}`).join("\n") : "- No explicit hard-target failures recorded."}
- Activity was concentrated in one full week in the available final artifact; later weeks had zero trades.
- The strategy should not be made more aggressive by simply increasing leverage or risk to force volume, because fee drag and drawdown can quickly turn a breakeven candidate into a losing one.

## Weekly breakdown

| Week | Start | Notional USDC | Net PnL | Fees | Max DD | Trades |
|---:|---|---:|---:|---:|---:|---:|
${weeklyRows}

## No-loss volume leaderboard

| Rank | Strategy | Total notional | Avg weekly | Net PnL | Max DD | PF | Trades/day | Source |
|---:|---|---:|---:|---:|---:|---:|---:|---|
${leaderboard}

## Suggested next search

If more volume is required while preserving the no-loss constraint, search additional symbols/timeframes first, then relax the frequency target only if needed. The next objective should rank candidates by notional volume **after** requiring:

1. netPnL >= 0 after fees,
2. profitFactor >= 1,
3. max drawdown <= 10%,
4. at least 3 near-breakeven/profitable full weeks.
`;

fs.writeFileSync(outputPath, report);

console.log("\n=== NO-LOSS VOLUME STRATEGY SUMMARY ===\n");
console.log(`Strategy:     ${best.strategyName}`);
console.log(`Notional:     ${fmt(best.totalNotional, 2)} USDC`);
console.log(`Avg weekly:   ${fmt(best.averageWeeklyNotionalVolume, 2)} USDC`);
console.log(`Net PnL:      ${fmt(best.netPnL, 6)} USDC`);
console.log(`Fees:         ${fmt(best.totalFees, 6)} USDC`);
console.log(`Trades/day:   ${fmt(best.tradesPerDay, 6)}`);
console.log(`Max DD:       ${fmt(best.maxDrawdownPct, 6)}%`);
console.log(`ProfitFactor: ${fmt(best.profitFactor, 6)}`);
console.log(`\nReport: ${outputPath}\n`);
