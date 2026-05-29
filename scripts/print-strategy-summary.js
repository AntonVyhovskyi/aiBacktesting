import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const finalPath = path.join(root, "data/results/strategy-discovery-final.json");
const mdPath = path.join(root, "data/results/best-strategy-explanation.md");

const data = JSON.parse(fs.readFileSync(finalPath, "utf8"));
const b = data.bestHighVolumeNearBreakeven;
if (!b) {
  console.error("bestHighVolumeNearBreakeven not found in", finalPath);
  process.exit(1);
}

const trades = JSON.parse(
  fs.readFileSync(
    path.join(root, "data/results/trades/ATR_VOLATILITY_BREAKOUT_8680a0fcdb1b.json"),
    "utf8"
  )
);
const wins = trades.filter((t) => t.netPnL > 0).length;

console.log("\n=== BEST HIGH-VOLUME NEAR-BREAKEVEN SUMMARY ===\n");
console.log(`Strategy:     ${b.strategyName}`);
console.log(`Volume:       ${b.totalVolume.toFixed(2)} SOL (qty sum)`);
console.log(`Net PnL:      ${b.netPnL.toFixed(2)} (${b.netPnLPct.toFixed(2)}%)`);
console.log(`Fees:         ${b.totalFees.toFixed(2)}`);
console.log(`Trades:       ${b.tradesCount} | Win rate: ${((wins / trades.length) * 100).toFixed(1)}%`);
console.log(`Profit factor:${b.profitFactor.toFixed(2)} | Max DD: ${b.maxDrawdownPct.toFixed(2)}%`);
console.log(`Trades/day:   ${b.tradesPerDay.toFixed(2)} | Fees/vol: ${b.feesToVolumeRatio.toFixed(4)}`);
console.log(`Strict pass:  ${b.passedStrictFilters} | Fallback: ${data.highVolumeNearBreakevenUsedFallback}`);
console.log("\nKey params:   trail 0.1%/0.5% gap | TP 0.8% | cooldown 2 | max 40 trades/day | risk 1.5%");
console.log("Entry defaults: lookback 20 | breakoutMult 1.5 | stopMult 1.5 | ATR(14)");
console.log(`\nFull write-up: ${mdPath}\n`);
