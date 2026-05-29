# Adaptive Regime Strategy — Backtest Report

Generated: 2026-05-23T13:58:40.156Z

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
  "adxTrendMin": 25,
  "adxRangeMax": 20,
  "atrHighPct": 1,
  "riskPct": 0.5,
  "atrMult": 0.9,
  "trailStart": 0.25,
  "breakEvenPct": 0.25
}
```

## Metrics by period

| Period | Net PnL % | Avg month % | Worst month % | Max DD % | PF | Trades | Avg R | 1-trade dom % |
|--------|----------:|------------:|--------------:|---------:|---:|-------:|------:|--------------:|
| train_60pct | 14.40 | 0.76 | 0.00 | 5.01 | 1.76 | 73 | -0.35 | 79.4 |
| validation_20pct | -5.63 | -2.81 | -5.63 | 5.63 | 0.34 | 26 | -2.48 | 0.0 |
| out_of_sample_20pct | 1.77 | 0.88 | 0.00 | 5.36 | 1.16 | 32 | -1.55 | 223.1 |
| full | 14.40 | 0.38 | 0.00 | 5.01 | 1.76 | 73 | -0.35 | 79.4 |

### Regime performance — full

| Regime | Trades | Net PnL | Win % | PF | Avg R |
|--------|-------:|--------:|------:|---:|------:|
| TREND_UP | 12 | 11.21 | 50.0 | 8.28 | 1.76 |
| TREND_DOWN | 5 | 5.71 | 60.0 | 5.36 | 2.25 |
| RANGE | 10 | -0.26 | 60.0 | 0.83 | -0.28 |
| LOW_VOLATILITY_COMPRESSION | 46 | -2.27 | 28.3 | 0.85 | -1.20 |

## Risks & limitations

- Regime labels are heuristic; misclassification in chop hurts trend logic.
- 10%/month with 5% max DD is extremely ambitious on intraday crypto.
- Short or partial history inflates/deflates monthly stats.
- Parameter grid is small; not a guarantee of robustness.
- Slippage beyond taker fee is not modeled.

## Honest assessment

Best realistic read: **0.38%** avg monthly, **5.01%** max DD, PF **1.76**.
The **10%/month with ≤5% DD** target was **not** met on available data.