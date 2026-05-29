# Adaptive Regime Strategy — Backtest Report

Generated: 2026-05-23T13:58:58.154Z

## Strategy logic

1. **Regime detection** (no lookahead): ADX, ATR%, Bollinger width, EMA slope, RSI, volume — evaluated on each **closed** bar.
2. **Regime-specific entries**:
   - `TREND_UP` / `TREND_DOWN`: pullback toward fast EMA, ATR stop
   - `RANGE`: RSI + Bollinger mean reversion
   - `LOW_VOLATILITY_COMPRESSION`: breakout with volume confirm
   - `HIGH_VOLATILITY`: no new trades (risk reduced)
   - `TRANSITION`: minimal or no trades
3. **Risk**: position size from stop distance; regime risk multipliers; max portfolio DD and daily loss guards.
4. **Execution**: signal on bar close → fill **next open** (default).

## Data quality

- Candles: 117513 (~168 days)
- Warnings: gaps=31444 maxGapMin=2233

## Target

Desired: **≥10%** avg monthly return, **≤5%** max drawdown (fees included).

**Target met (validation + OOS):** NO

Notes: validation_underperforms, oos_single_trade_dominance, full_period_dd_above_target, avg_monthly_below_target

## Parameters

```json
{
  "adxTrendMin": 22,
  "adxRangeMax": 22,
  "atrHighPct": 1.2,
  "riskPct": 0.75,
  "atrMult": 1.1,
  "minRegimeConfidence": 0.5
}
```

## Metrics by period

| Period | Net PnL % | Avg month % | Worst month % | Max DD % | PF | Trades | Avg R | 1-trade dom % |
|--------|----------:|------------:|--------------:|---------:|---:|-------:|------:|--------------:|
| train_60pct | 8.07 | 6.32 | 0.00 | 5.09 | 1.20 | 119 | -9.89 | 77.6 |
| validation_20pct | -3.39 | -1.70 | -3.39 | 5.37 | 0.59 | 15 | -0.41 | 0.0 |
| out_of_sample_20pct | 1.85 | 0.92 | 0.00 | 5.42 | 1.21 | 26 | -1.80 | 137.1 |
| full | 8.07 | 3.16 | 0.00 | 5.09 | 1.20 | 119 | -9.89 | 77.6 |

### Regime performance — full

| Regime | Trades | Net PnL | Win % | PF | Avg R |
|--------|-------:|--------:|------:|---:|------:|
| TREND_UP | 15 | -0.29 | 40.0 | 0.93 | 0.28 |
| TREND_DOWN | 9 | -3.60 | 22.2 | 0.16 | -0.65 |
| RANGE | 13 | -1.71 | 38.5 | 0.52 | -0.17 |
| LOW_VOLATILITY_COMPRESSION | 82 | 13.68 | 37.8 | 1.48 | -14.30 |

## Risks & limitations

- Regime labels are heuristic; misclassification in chop hurts trend logic.
- 10%/month with 5% max DD is extremely ambitious on intraday crypto.
- Short or partial history inflates/deflates monthly stats.
- Parameter grid is small; not a guarantee of robustness.
- Slippage beyond taker fee is not modeled.

## Honest assessment

Best realistic read: **3.16%** avg monthly, **5.09%** max DD, PF **1.20**.
The **10%/month with ≤5% DD** target was **not** met on available data.