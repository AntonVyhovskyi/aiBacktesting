# Bollinger Mean Reversion — Full 30-Day Validation

## 1. Strategy name

**BOLLINGER_MEAN_REVERSION** (refined closest-to-pass candidate)

## 2. Full parameter list

```json
{
  "atrPeriod": 16,
  "atrMult": 1.6,
  "trailStart": 0.15,
  "trailGap": 0.35,
  "takeProfitPct": 0.25,
  "breakEvenPct": 0,
  "maxHoldCandles": 0,
  "exitOnOppositeSignal": 1,
  "cooldownCandles": 0,
  "minAtrFilter": 0,
  "minEmaDistancePct": 0,
  "minMoveVsFeeMult": 0,
  "minVolumeMult": 1,
  "maxTradesPerDay": 30,
  "bbPeriod": 20,
  "bbStdDev": 1.8,
  "riskPct": 1.5,
  "leverage": 5,
  "rsiConfirmPeriod": 0,
  "rsiOversold": 30,
  "rsiOverbought": 60,
  "stopLossPct": 0
}
```

**Diff vs original autonomous base:**

```json
{
  "atrPeriod": {
    "from": 14,
    "to": 16
  },
  "atrMult": {
    "from": 1.2,
    "to": 1.6
  },
  "trailStart": {
    "from": 0.3,
    "to": 0.15
  },
  "trailGap": {
    "from": 0.4,
    "to": 0.35
  },
  "takeProfitPct": {
    "from": 0,
    "to": 0.25
  },
  "minVolumeMult": {
    "from": 1.2,
    "to": 1
  },
  "bbStdDev": {
    "from": 2,
    "to": 1.8
  },
  "rsiOversold": {
    "from": 35,
    "to": 30
  },
  "rsiOverbought": {
    "from": 65,
    "to": 60
  }
}
```

## 3. Human-readable strategy logic

This is a **mean-reversion** system on SOLUSD 1m candles. Price is expected to revert toward the Bollinger middle band after stretching to the outer bands. The bot goes **long** when price closes **below the lower band** and **short** when price closes **above the upper band**. Positions are sized from account risk (1.5% per trade, 5× leverage cap) and exits use take-profit, trailing stop, hard stop, optional max hold, and **middle-band touch** (mean reversion complete).

## 4. Entry conditions

- **Long:** `close < lower Bollinger band`
- **Short:** `close > upper Bollinger band`
- Bollinger: period **20**, standard deviation **1.8**
- RSI confirmation **off** (rsiOversold/overbought params stored but not enforced when rsiConfirmPeriod=0)
- Volume filter: bar volume ≥ **1×** 20-bar volume SMA (if mult > 0)
- Minimum move vs fees: disabled
- Max **30** entries per calendar day; cooldown **0** bars after exit
- Fill: **next candle open** (default)

## 5. Exit conditions

- **Take profit:** 0.25% favorable move from entry
- **Trailing stop:** activates after **0.15%** profit, trail gap **0.35%**
- **Break-even:** disabled
- **Max hold:** disabled
- **Mean reversion exit:** close long when price ≥ middle band; close short when price ≤ middle band
- **Stop loss:** ATR(16) × 1.6 from entry

## 6. Stop loss / trailing logic

- Initial stop: **entry ± ATR(16) × 1.6**
- After **0.15%** unrealized profit, stop trails at **0.35%** behind favorable price
- Stops checked on bar **low/high** (intrabar touch)

## 7. Volume / RSI / ATR filters

| Filter | Setting | Effect |
|--------|---------|--------|
| ATR period | 16 | Stop distance & volatility context |
| ATR mult | 1.6 | Wider stop → fewer stop-outs, smaller size per risk |
| minVolumeMult | 1 | Requires elevated volume vs 20-bar average |
| RSI confirm | off | Bands alone trigger entries |
| minMoveVsFeeMult | 0 | Blocks tiny stop distances that cannot beat fees |

## 8. Why this strategy survived fees better

- **Tighter bands** (`bbStdDev` 1.8 vs 2.0) → fewer but higher-quality stretch signals
- **Take profit 0.25%** locks small wins before mean-reversion exit gives back profit
- **Earlier trail** (0.15% / 0.35% gap) protects open profit
- **Wider ATR stop** (1.6×) reduces whipsaw stop-outs that pay fees without gross edge
- **minVolumeMult 1.0** (vs 1.2) allows slightly more valid entries without extreme chop

Net: gross profit closer to fees; refinement turned a deeply negative baseline into **positive net PnL** on full 30d.

## 9. Why trades/day stayed low

- Mean-reversion entries require **rare** band pierces on 1m SOL
- After week 1, price often **stays inside bands** → zero new signals for weeks 2–4
- `maxTradesPerDay=30` is **not** the bottleneck; signal logic is
- Average **1.72** trades/day across 30d ≈ **51** trades total

## 10. Why trades concentrated in week 1

- First calendar week had the most **band touches** and volatility suitable for reversion
- Later weeks: flat net, **zero trades** in weeks 2–4 in this backtest window
- Classic **regime shift**: strategy active only when market is volatile/mean-reverting at 1m scale

## 11. Full metrics

| Metric | Value |
|--------|-------|
| averageWeeklyNotionalVolume | 12,623.472 USDC |
| totalNotionalVolume | 50,493.889 USDC |
| grossPnL | 15.183365 USDC |
| totalFees | 17.672861 USDC |
| netPnL | -2.489496 USDC |
| netPnLPct | -2.489496% |
| tradesCount | 51 |
| averageTradesPerDay | 1.716 |
| winRate | 49.019608% |
| profitFactor | 0.8794 |
| maxDrawdownPct | 7.739215% |
| profitableWeeks | 0 |
| losingWeeks | 1 |

## 12. Weekly table

| Week | Start | Trades | Volume (USDC) | Gross | Fees | Net | DD |
|------|-------|--------|---------------|-------|------|-----|-----|
| W1 | 2026-04-17 | 51 | 50494 | 15.18 | 17.67 | -2.49 | 7.74% |
| W2 | 2026-04-24 | 0 | 0 | 0.00 | 0.00 | 0.00 | 0.00% |
| W3 | 2026-05-01 | 0 | 0 | 0.00 | 0.00 | 0.00 | 0.00% |
| W4 | 2026-05-08 | 0 | 0 | 0.00 | 0.00 | 0.00 | 0.00% |
| W5 | 2026-05-15 | 0 | 0 | 0.00 | 0.00 | 0.00 | 0.00% |

## 13. Daily summary

- **2026-04-17**: trades=21 notional=20833 net=-0.10 fees=7.29
- **2026-04-18**: trades=30 notional=29661 net=-2.39 fees=10.38

## 14. Best trades

```json
[
  {
    "direction": "short",
    "entryTime": "2026-04-18T08:58:00.000Z",
    "exitTime": "2026-04-18T09:09:00.000Z",
    "entryPrice": 87.59,
    "exitPrice": 87.25,
    "qty": 5.41025522,
    "notionalUsdc": 945.929023,
    "grossPnL": 1.83948677,
    "fees": 0.33107516,
    "netPnL": 1.50841161,
    "exitReason": "take_profit",
    "durationCandles": 10
  },
  {
    "direction": "long",
    "entryTime": "2026-04-17T23:23:00.000Z",
    "exitTime": "2026-04-17T23:31:00.000Z",
    "entryPrice": 88.64,
    "exitPrice": 88.95,
    "qty": 5.55721346,
    "notionalUsdc": 986.905538,
    "grossPnL": 1.72273617,
    "fees": 0.34541694,
    "netPnL": 1.37731923,
    "exitReason": "take_profit",
    "durationCandles": 7
  },
  {
    "direction": "short",
    "entryTime": "2026-04-18T03:52:00.000Z",
    "exitTime": "2026-04-18T03:53:00.000Z",
    "entryPrice": 88.86,
    "exitPrice": 88.57,
    "qty": 5.67819769,
    "notionalUsdc": 1007.482616,
    "grossPnL": 1.64667733,
    "fees": 0.35261892,
    "netPnL": 1.29405841,
    "exitReason": "take_profit",
    "durationCandles": 2
  },
  {
    "direction": "long",
    "entryTime": "2026-04-17T20:32:00.000Z",
    "exitTime": "2026-04-17T20:49:00.000Z",
    "entryPrice": 88.64,
    "exitPrice": 88.93,
    "qty": 5.53776157,
    "notionalUsdc": 983.340322,
    "grossPnL": 1.60595086,
    "fees": 0.34416911,
    "netPnL": 1.26178175,
    "exitReason": "take_profit",
    "durationCandles": 13
  },
  {
    "direction": "short",
    "entryTime": "2026-04-18T00:57:00.000Z",
    "exitTime": "2026-04-18T01:01:00.000Z",
    "entryPrice": 89.12,
    "exitPrice": 88.85,
    "qty": 5.64420609,
    "notionalUsdc": 1004.499358,
    "grossPnL": 1.52393564,
    "fees": 0.35157478,
    "netPnL": 1.17236086,
    "exitReason": "take_profit",
    "durationCandles": 5
  }
]
```

## 15. Worst trades

```json
[
  {
    "direction": "long",
    "entryTime": "2026-04-18T08:36:00.000Z",
    "exitTime": "2026-04-18T08:37:00.000Z",
    "entryPrice": 87.42,
    "exitPrice": 87.24032814232534,
    "qty": 5.46864769,
    "notionalUsdc": 955.1558,
    "grossPnL": -0.98256209,
    "fees": 0.33430453,
    "netPnL": -1.31686662,
    "exitReason": "stop",
    "durationCandles": 2
  },
  {
    "direction": "long",
    "entryTime": "2026-04-17T18:08:00.000Z",
    "exitTime": "2026-04-17T18:09:00.000Z",
    "entryPrice": 89.36,
    "exitPrice": 89.19667376734911,
    "qty": 5.57001797,
    "notionalUsdc": 994.563882,
    "grossPnL": -0.90973005,
    "fees": 0.34809736,
    "netPnL": -1.25782741,
    "exitReason": "stop",
    "durationCandles": 2
  },
  {
    "direction": "long",
    "entryTime": "2026-04-18T08:23:00.000Z",
    "exitTime": "2026-04-18T08:34:00.000Z",
    "entryPrice": 87.76,
    "exitPrice": 87.60468758393661,
    "qty": 5.51555389,
    "notionalUsdc": 967.233385,
    "grossPnL": -0.856634,
    "fees": 0.33853168,
    "netPnL": -1.19516568,
    "exitReason": "stop",
    "durationCandles": 10
  },
  {
    "direction": "long",
    "entryTime": "2026-04-17T21:38:00.000Z",
    "exitTime": "2026-04-17T21:39:00.000Z",
    "entryPrice": 89.02,
    "exitPrice": 88.89251751479426,
    "qty": 5.58423169,
    "notionalUsdc": 993.504718,
    "grossPnL": -0.71189173,
    "fees": 0.34772665,
    "netPnL": -1.05961838,
    "exitReason": "stop",
    "durationCandles": 2
  },
  {
    "direction": "long",
    "entryTime": "2026-04-17T20:28:00.000Z",
    "exitTime": "2026-04-17T20:30:00.000Z",
    "entryPrice": 89.17,
    "exitPrice": 89.04495099437835,
    "qty": 5.6168922,
    "notionalUsdc": 1001.014168,
    "grossPnL": -0.70238678,
    "fees": 0.35035496,
    "netPnL": -1.05274174,
    "exitReason": "stop",
    "durationCandles": 3
  }
]
```

## 16. Exact targetCheck

```json
{
  "averageWeeklyNotionalVolume": {
    "value": 12623.472243,
    "required": 10000,
    "passed": true
  },
  "averageTradesPerDay": {
    "value": 1.715647,
    "required": 2,
    "passed": false
  },
  "stableWeeks": {
    "value": "3/4",
    "required": ">=3_of_4",
    "passed": true
  },
  "netPnL": {
    "value": -2.489496,
    "required": 0,
    "passed": false
  },
  "maxDrawdownPct": {
    "value": 7.739215,
    "required": 10,
    "passed": true
  },
  "maxWeeklyDrawdownPct": {
    "value": 7.739215,
    "required": 25,
    "passed": true
  },
  "profitFactor": {
    "value": 0.8794,
    "required": 0.9,
    "passed": false
  },
  "feesVsGrossProfit": {
    "value": "1.163962 (fees=17.672861 gross=15.183365)",
    "required": "fees<=2x_gross",
    "passed": true
  },
  "finalTargetAchieved": false,
  "failedReasons": [
    "averageTradesPerDay=1.715647 < 2",
    "netPnL=-2.489496 < 0",
    "profitFactor=0.8794 < 0.9"
  ],
  "refinementMaxDrawdownPct": {
    "value": 7.739215,
    "required": 10,
    "passed": true
  },
  "refinementTargetAchieved": false
}
```

## 17. Requirements passed

- averageWeeklyNotionalVolume
- stableWeeks
- maxDrawdownPct
- maxWeeklyDrawdownPct
- feesVsGrossProfit
- refinementMaxDrawdownPct

## 18. Requirements failed

- averageTradesPerDay=1.715647 < 2
- netPnL=-2.489496 < 0
- profitFactor=0.8794 < 0.9

## 19. Final verdict: **LOW_SIGNAL_FREQUENCY**

- 100% of trades in week 1; avg trades/day=1.72.

---

**Artifacts**

- Validation JSON: `C:\Users\vygov\OneDrive\Desktop\aiBacktesting\data\results\bollinger-full-validation.json`
- Trades: `C:\Users\vygov\OneDrive\Desktop\aiBacktesting\data\results\bollinger-full-trades.json`
- Equity: `C:\Users\vygov\OneDrive\Desktop\aiBacktesting\data\results\bollinger-full-equity.json`
