# Binance No-Loss Volume Search

Generated: 2026-05-01T00:00:00.000Z

## Verdict

Best candidate: **ATR_VOLATILITY_BREAKOUT 15m** with **15.732320 USDC** net PnL and **47416.57 USDC** notional.

## Search constraints

- Source: **BINANCE_FUTURES**
- Hard pass: netPnL >= 0, profitFactor >= 1, maxDrawdown <= 20%, trades >= 10
- Fee gate profiles: minMoveVsFeeMult 4-12, volume filters 1.0-2.0, cooldown and daily caps to avoid fee death
- Tested variants: 9792

## Best no-loss candidate

```json
{
  "atrPeriod": 14,
  "atrMult": 1.2,
  "trailStart": 0.4,
  "trailGap": 0.6,
  "takeProfitPct": 0.6,
  "breakEvenPct": 0,
  "maxHoldCandles": 90,
  "exitOnOppositeSignal": 1,
  "cooldownCandles": 1,
  "minAtrFilter": 0,
  "minEmaDistancePct": 0,
  "minMoveVsFeeMult": 5,
  "minVolumeMult": 1.2,
  "maxTradesPerDay": 30,
  "lookback": 8,
  "breakoutMult": 1.2,
  "stopMult": 0.6,
  "label": "fee5-vol12-more-volume",
  "riskPct": 0.35,
  "leverage": 3,
  "minAtrPct": 0.03
}
```

| Metric | Value |
|---|---:|
| Symbol | SOLUSDT |
| Timeframe | 15m |
| Total notional | 47416.57 USDC |
| Avg weekly notional | 1844.76 USDC |
| Net PnL | 15.732320 USDC (15.732320%) |
| Gross PnL | 32.328119 USDC |
| Fees | 16.595799 USDC |
| Profit factor | 1.266797 |
| Max drawdown | 5.719512% |
| Trades | 203 |
| Trades/day | 1.127778 |
| Active days | 114 |
| Trades artifact | `/workspace/data/results/trades/BINANCE_NO_LOSS_ATR_VOLATILITY_BREAKOUT_fbad821a2626.json` |
| Equity artifact | `/workspace/data/results/equity/BINANCE_NO_LOSS_ATR_VOLATILITY_BREAKOUT_fbad821a2626.csv` |


## Top no-loss candidates

| Rank | Strategy | TF | Total notional | Avg weekly | Net PnL | Fees | Max DD | PF | Trades | Status |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | ATR_VOLATILITY_BREAKOUT | 15m | 47416.57 | 1844.76 | 15.732320 | 16.595799 | 5.7195% | 1.2668 | 203 | PASS |
| 2 | ATR_VOLATILITY_BREAKOUT | 15m | 30644.98 | 1216.73 | 11.975804 | 10.725745 | 4.5162% | 1.3081 | 137 | PASS |
| 3 | ATR_VOLATILITY_BREAKOUT | 15m | 42555.41 | 1680.26 | 12.291093 | 14.894395 | 6.9528% | 1.2260 | 187 | PASS |
| 4 | ATR_VOLATILITY_BREAKOUT | 15m | 37556.29 | 1469.16 | 11.551966 | 13.144700 | 4.5601% | 1.2435 | 165 | PASS |
| 5 | ATR_VOLATILITY_BREAKOUT | 15m | 34731.56 | 1380.23 | 11.530407 | 12.156047 | 4.4167% | 1.2642 | 151 | PASS |
| 6 | ATR_VOLATILITY_BREAKOUT | 15m | 36266.70 | 1418.74 | 10.522687 | 12.693346 | 4.7141% | 1.2076 | 199 | PASS |
| 7 | ATR_VOLATILITY_BREAKOUT | 15m | 47476.90 | 1866.01 | 10.863122 | 16.616914 | 6.3631% | 1.1799 | 208 | PASS |
| 8 | ATR_VOLATILITY_BREAKOUT | 15m | 53873.80 | 2093.36 | 9.629175 | 18.855831 | 5.2163% | 1.1412 | 237 | PASS |
| 9 | ATR_VOLATILITY_BREAKOUT | 15m | 66889.17 | 2600.95 | 9.970760 | 23.411210 | 6.9597% | 1.1174 | 291 | PASS |
| 10 | ATR_VOLATILITY_BREAKOUT | 5m | 13936.46 | 557.46 | 8.964243 | 4.877762 | 3.2517% | 1.3613 | 143 | PASS |
| 11 | ATR_VOLATILITY_BREAKOUT | 15m | 44381.22 | 1726.10 | 9.578714 | 15.533428 | 5.7195% | 1.1690 | 194 | PASS |
| 12 | ATR_VOLATILITY_BREAKOUT | 15m | 39861.67 | 1513.81 | 9.643433 | 13.951584 | 6.8399% | 1.1728 | 217 | PASS |
| 13 | ATR_VOLATILITY_BREAKOUT | 15m | 42272.92 | 1622.08 | 9.221340 | 14.795523 | 5.5035% | 1.1582 | 225 | PASS |
| 14 | ATR_VOLATILITY_BREAKOUT | 5m | 10630.12 | 425.20 | 8.496814 | 3.720541 | 2.3105% | 1.4690 | 107 | PASS |
| 15 | ATR_VOLATILITY_BREAKOUT | 15m | 61871.69 | 2413.05 | 9.471214 | 21.655092 | 6.5165% | 1.1204 | 268 | PASS |
| 16 | EMA_VOLUME_SPIKE | 15m | 5636.71 | 217.49 | 7.154542 | 1.972849 | 1.5739% | 1.3496 | 269 | PASS |
| 17 | EMA_VOLUME_SPIKE | 15m | 19479.69 | 744.94 | 7.017980 | 6.817890 | 4.3134% | 1.1145 | 473 | PASS |
| 18 | ATR_VOLATILITY_BREAKOUT | 15m | 53131.77 | 2080.25 | 9.221805 | 18.596118 | 6.7591% | 1.1358 | 232 | PASS |
| 19 | ATR_VOLATILITY_BREAKOUT | 5m | 14654.43 | 586.18 | 8.286279 | 5.129051 | 3.7121% | 1.3210 | 150 | PASS |
| 20 | ATR_VOLATILITY_BREAKOUT | 5m | 11814.94 | 472.60 | 8.142936 | 4.135228 | 3.4446% | 1.3965 | 119 | PASS |

## Top near misses

| Rank | Strategy | TF | Total notional | Avg weekly | Net PnL | Fees | Max DD | PF | Trades | Status |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | RSI_MEAN_REVERSION | 15m | 6060.38 | 229.50 | -0.102422 | 2.121134 | 1.4691% | 0.9892 | 298 | netPnL<0, profitFactor<1 |
| 2 | RSI_MEAN_REVERSION | 15m | 9522.77 | 362.09 | -0.512049 | 3.332969 | 2.6305% | 0.9627 | 439 | netPnL<0, profitFactor<1 |
| 3 | RSI_MEAN_REVERSION | 15m | 6777.04 | 255.64 | -0.177166 | 2.371963 | 2.1368% | 0.9872 | 335 | netPnL<0, profitFactor<1 |
| 4 | RSI_ADX_TREND | 5m | 22373.00 | 853.89 | -0.383973 | 7.830549 | 3.7226% | 0.9894 | 591 | netPnL<0, profitFactor<1 |
| 5 | RSI_ADX_TREND | 15m | 9165.09 | 351.21 | -0.452718 | 3.207782 | 3.4535% | 0.9829 | 456 | netPnL<0, profitFactor<1 |
| 6 | EMA_TREND_CONTINUATION | 15m | 9014.56 | 349.86 | -0.270983 | 3.155097 | 3.1384% | 0.9925 | 392 | netPnL<0, profitFactor<1 |
| 7 | RSI_ADX_TREND | 15m | 8520.88 | 325.29 | -0.475448 | 2.982307 | 2.9761% | 0.9816 | 421 | netPnL<0, profitFactor<1 |
| 8 | RSI_MEAN_REVERSION | 15m | 9501.81 | 362.62 | -1.009304 | 3.325635 | 1.7415% | 0.9240 | 456 | netPnL<0, profitFactor<1 |
| 9 | RSI_MEAN_REVERSION | 15m | 10032.67 | 381.86 | -0.613747 | 3.511434 | 1.8466% | 0.9641 | 366 | netPnL<0, profitFactor<1 |
| 10 | RSI_MEAN_REVERSION | 15m | 10393.02 | 396.45 | -1.038674 | 3.637559 | 2.5699% | 0.9214 | 479 | netPnL<0, profitFactor<1 |
| 11 | ATR_VOLATILITY_BREAKOUT | 3m | 553.60 | 22.14 | 0.737886 | 0.193758 | 0.8577% | 1.6163 | 9 | tradesCount<10 |
| 12 | ATR_VOLATILITY_BREAKOUT | 3m | 553.60 | 22.14 | 0.737886 | 0.193758 | 0.8577% | 1.6163 | 9 | tradesCount<10 |
| 13 | ATR_VOLATILITY_BREAKOUT | 3m | 559.97 | 22.40 | 0.735632 | 0.195989 | 0.8600% | 1.6133 | 9 | tradesCount<10 |
| 14 | ATR_VOLATILITY_BREAKOUT | 3m | 559.97 | 22.40 | 0.735632 | 0.195989 | 0.8600% | 1.6133 | 9 | tradesCount<10 |
| 15 | ATR_VOLATILITY_BREAKOUT | 3m | 559.97 | 22.40 | 0.735632 | 0.195989 | 0.8600% | 1.6133 | 9 | tradesCount<10 |
| 16 | ATR_VOLATILITY_BREAKOUT | 3m | 559.97 | 22.40 | 0.735632 | 0.195989 | 0.8600% | 1.6133 | 9 | tradesCount<10 |
| 17 | ATR_VOLATILITY_BREAKOUT | 3m | 559.97 | 22.40 | 0.735632 | 0.195989 | 0.8600% | 1.6133 | 9 | tradesCount<10 |
| 18 | EMA_CROSSOVER_ATR | 5m | 13835.46 | 536.35 | -0.357825 | 4.842413 | 3.7761% | 0.9915 | 409 | netPnL<0, profitFactor<1 |
| 19 | RSI_MEAN_REVERSION | 15m | 7950.87 | 302.80 | -0.912719 | 2.782806 | 1.5518% | 0.9213 | 380 | netPnL<0, profitFactor<1 |
| 20 | RSI_ADX_TREND | 15m | 8340.60 | 318.06 | -0.687982 | 2.919210 | 3.1819% | 0.9731 | 417 | netPnL<0, profitFactor<1 |
