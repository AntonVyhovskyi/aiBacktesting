# No-Loss Volume Strategy Report

Generated from source artifact: 2026-05-17T16:47:17.615Z

## Recommendation

Use **BOLLINGER_MEAN_REVERSION** as the current best candidate for generating volume without losing money in the available search artifacts.

This is a **near-breakeven volume strategy**, not a fully validated production strategy. It produced positive net PnL after fees in the backtest, but it did **not** meet the stricter target for weekly volume and trade frequency.

## Best candidate metrics

| Metric | Value |
|---|---:|
| Source | `data/results/autonomous-weekly-volume-search-final.json:bestStrategy` |
| Total notional volume | 30,253.01 USDC |
| Average weekly notional | 7,563.25 USDC |
| Net PnL after fees | 0.676866 USDC (0.676866%) |
| Gross PnL | 11.265421 USDC |
| Fees | 10.588555 USDC |
| Profit factor | 1.052146 |
| Max drawdown | 3.466306% |
| Max weekly drawdown | 3.466306% |
| Trades | 30 |
| Trades/day | 1.008003 |
| Win rate | 43.333333% |
| Stable weeks | 4/4 |

## Parameters

```json
{
  "atrPeriod": 14,
  "atrMult": 1.2,
  "trailStart": 0.3,
  "trailGap": 0.4,
  "takeProfitPct": 0,
  "breakEvenPct": 0,
  "maxHoldCandles": 0,
  "exitOnOppositeSignal": 1,
  "cooldownCandles": 0,
  "minAtrFilter": 0,
  "minEmaDistancePct": 0,
  "minMoveVsFeeMult": 0,
  "minVolumeMult": 1.2,
  "maxTradesPerDay": 30,
  "bbPeriod": 20,
  "riskPct": 1.5,
  "leverage": 5
}
```

## Why this is the best current answer

- It is the highest-notional candidate found with **netPnL >= 0** and **profitFactor >= 1**.
- Fees were covered by gross PnL: gross 11.265421 USDC vs fees 10.588555 USDC.
- Drawdown stayed low in the available result: 3.466306%.

## Important limitations

- avgWeeklyNotional<10000
- avgTradesPerDay<2
- not_enough_weekly_volume
- not_enough_trades_per_day
- Activity was concentrated in one full week in the available final artifact; later weeks had zero trades.
- The strategy should not be made more aggressive by simply increasing leverage or risk to force volume, because fee drag and drawdown can quickly turn a breakeven candidate into a losing one.

## Weekly breakdown

| Week | Start | Notional USDC | Net PnL | Fees | Max DD | Trades |
|---:|---|---:|---:|---:|---:|---:|
| 1 | 2026-04-17 | 30,253.01 | 0.676866 | 10.588555 | 3.47% | 30 |
| 2 | 2026-04-24 | 0.00 | 0.000000 | 0.000000 | 0.00% | 0 |
| 3 | 2026-05-01 | 0.00 | 0.000000 | 0.000000 | 0.00% | 0 |
| 4 | 2026-05-08 | 0.00 | 0.000000 | 0.000000 | 0.00% | 0 |
| 5 | 2026-05-15 | 0.00 | 0.000000 | 0.000000 | 0.00% | 0 |

## No-loss volume leaderboard

| Rank | Strategy | Total notional | Avg weekly | Net PnL | Max DD | PF | Trades/day | Source |
|---:|---|---:|---:|---:|---:|---:|---:|---|
| 1 | BOLLINGER_MEAN_REVERSION | 30,253.01 | 7,563.25 | 0.676866 | 3.47% | 1.052 | 1.008 | data/results/autonomous-weekly-volume-search-final.json:bestStrategy |
| 2 | BOLLINGER_MEAN_REVERSION | 30,034.10 | 7,508.52 | 0.370560 | 3.47% | 1.029 | 1.008 | data/results/autonomous-weekly-volume-search-final.json:topStableCandidates.1 |
| 3 | BOLLINGER_MEAN_REVERSION | 26,149.67 | 6,537.42 | 0.297145 | 3.47% | 1.028 | 1.008 | data/results/autonomous-weekly-volume-search-final.json:topStableCandidates.2 |
| 4 | BOLLINGER_MEAN_REVERSION | 18,094.12 | 4,523.53 | 0.442015 | 2.09% | 1.057 | 1.008 | data/results/autonomous-weekly-volume-search-final.json:topStableCandidates.3 |
| 5 | BOLLINGER_MEAN_REVERSION | 18,094.12 | 4,523.53 | 0.442015 | 2.09% | 1.057 | 1.008 | data/results/autonomous-weekly-volume-search-final.json:topStableCandidates.4 |
| 6 | BOLLINGER_MEAN_REVERSION | 17,738.21 | 4,434.55 | 0.274850 | 2.09% | 1.036 | 1.008 | data/results/autonomous-weekly-volume-search-final.json:topStableCandidates.5 |
| 7 | VWAP_BOUNCE | 7,021.21 | 1,755.30 | 0.595276 | 0.76% | 1.419 | 0.235 | data/results/autonomous-weekly-volume-search-final.json:topStableCandidates.6 |
| 8 | VWAP_BOUNCE | 7,021.21 | 1,755.30 | 0.595276 | 0.76% | 1.419 | 0.235 | data/results/autonomous-weekly-volume-search-final.json:topStableCandidates.7 |

## Suggested next search

If more volume is required while preserving the no-loss constraint, search additional symbols/timeframes first, then relax the frequency target only if needed. The next objective should rank candidates by notional volume **after** requiring:

1. netPnL >= 0 after fees,
2. profitFactor >= 1,
3. max drawdown <= 10%,
4. at least 3 near-breakeven/profitable full weeks.
