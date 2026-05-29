# Adaptive Regime — Walk-Forward Report

Source: **BINANCE_FUTURES**
Generated: 2026-05-23T17:17:07.883Z

## Data quality

## SOLUSDT

- Source: **BINANCE_FUTURES**

- Cache: `C:\Users\vygov\OneDrive\Desktop\aiBacktesting\data\cache\binance_futures\SOLUSDT_1m_12m.json`
- Candles: **518,393** (~360 days)
- Coverage: **100%** (expected ~518,401)
- Gaps: 0 (largest 0 min, ~0 missing bars)
- Duplicates: 0
- Reliable for optimization: **YES**
## ETHUSDT

- Source: **BINANCE_FUTURES**

- Cache: `C:\Users\vygov\OneDrive\Desktop\aiBacktesting\data\cache\binance_futures\ETHUSDT_1m_12m.json`
- Candles: **518,394** (~360 days)
- Coverage: **100%** (expected ~518,401)
- Gaps: 0 (largest 0 min, ~0 missing bars)
- Duplicates: 0
- Reliable for optimization: **YES**

**Overall data reliable (≥90% coverage):** YES

## Target

- Avg monthly return ≥ **10%**
- Max drawdown ≤ **5%**
- Walk-forward: **4** rolling windows

**Primary target met:** NO

## Walk-forward detail (best per symbol/TF)

### SOLUSDT 1m

| Window | Train net % | Val net % | OOS net % | OOS DD % | OOS trades |
|-------:|------------:|----------:|----------:|---------:|-----------:|
| 1 | 0.26 | 0.00 | 0.00 | 0.00 | 0 |
| 2 | -0.74 | -0.90 | -1.56 | 1.56 | 5 |
| 3 | -0.85 | 0.00 | -1.13 | 1.14 | 12 |
| 4 | -0.50 | 0.00 | 0.00 | 0.00 | 0 |

### ETHUSDT 3m

| Window | Train net % | Val net % | OOS net % | OOS DD % | OOS trades |
|-------:|------------:|----------:|----------:|---------:|-----------:|
| 1 | -1.39 | -2.12 | -0.02 | 0.47 | 2 |
| 2 | -0.81 | -0.92 | -1.48 | 1.86 | 12 |
| 3 | -2.58 | -0.49 | -2.35 | 2.35 | 17 |
| 4 | -1.41 | 0.58 | 0.00 | 0.00 | 0 |

### ETHUSDT 1m

| Window | Train net % | Val net % | OOS net % | OOS DD % | OOS trades |
|-------:|------------:|----------:|----------:|---------:|-----------:|
| 1 | 0.00 | 0.00 | -2.02 | 2.02 | 4 |
| 2 | -2.33 | 1.49 | -1.08 | 1.08 | 6 |
| 3 | -0.15 | 0.00 | -2.10 | 2.54 | 20 |
| 4 | -0.70 | 0.00 | 0.00 | 0.00 | 0 |

### SOLUSDT 3m

| Window | Train net % | Val net % | OOS net % | OOS DD % | OOS trades |
|-------:|------------:|----------:|----------:|---------:|-----------:|
| 1 | -2.44 | -1.69 | -0.41 | 1.06 | 7 |
| 2 | -1.92 | -2.58 | -3.18 | 3.18 | 15 |
| 3 | -2.24 | 0.00 | -4.09 | 4.09 | 17 |
| 4 | -1.65 | 0.00 | 0.00 | 0.00 | 0 |


## Best candidates

| Symbol | TF | Bucket | Score | OOS avg mo % | OOS DD % | OOS PF | +windows | Rejected |
|--------|-----|--------|------:|-------------:|---------:|-------:|---------:|:--------:|
| SOLUSDT | 1m | rejected | -128.0 | -0.34 | 0.67 | 0.09 | 0 | insufficient_positive_oos_windows |
| SOLUSDT | 1m | rejected | -129.6 | -0.42 | 0.83 | 0.07 | 0 | insufficient_positive_oos_windows |
| SOLUSDT | 1m | rejected | -129.6 | -0.42 | 0.83 | 0.07 | 0 | insufficient_positive_oos_windows |
| ETHUSDT | 3m | rejected | -130.7 | -0.48 | 1.17 | 0.37 | 0 | insufficient_positive_oos_windows |
| SOLUSDT | 1m | rejected | -131.4 | -0.49 | 0.97 | 0.08 | 0 | insufficient_positive_oos_windows |
| ETHUSDT | 1m | rejected | -132.8 | -0.65 | 1.41 | 0.22 | 0 | insufficient_positive_oos_windows |
| ETHUSDT | 1m | rejected | -133.0 | -0.57 | 1.16 | 0.17 | 0 | insufficient_positive_oos_windows |
| SOLUSDT | 1m | rejected | -134.2 | -0.60 | 1.23 | 0.08 | 0 | insufficient_positive_oos_windows |
| ETHUSDT | 1m | rejected | -136.5 | -0.68 | 1.38 | 0.18 | 0 | insufficient_positive_oos_windows |
| ETHUSDT | 1m | rejected | -137.8 | -0.75 | 1.52 | 0.18 | 0 | insufficient_positive_oos_windows |
| ETHUSDT | 1m | rejected | -137.8 | -0.75 | 1.52 | 0.18 | 0 | insufficient_positive_oos_windows |
| ETHUSDT | 3m | rejected | -140.4 | -0.97 | 1.94 | 0.17 | 0 | insufficient_positive_oos_windows |
| SOLUSDT | 3m | rejected | -142.6 | -0.96 | 2.08 | 0.24 | 0 | insufficient_positive_oos_windows |
| ETHUSDT | 1m | rejected | -145.6 | -1.01 | 2.03 | 0.15 | 0 | insufficient_positive_oos_windows |
| ETHUSDT | 3m | rejected | -145.9 | -1.24 | 2.46 | 0.08 | 0 | insufficient_positive_oos_windows |
| ETHUSDT | 3m | rejected | -146.1 | -1.20 | 2.39 | 0.17 | 0 | insufficient_positive_oos_windows |
| ETHUSDT | 3m | rejected | -146.1 | -1.20 | 2.39 | 0.17 | 0 | insufficient_positive_oos_windows |
| SOLUSDT | 3m | rejected | -152.8 | -1.38 | 3.48 | 0.28 | 0 | insufficient_positive_oos_windows |
| ETHUSDT | 3m | rejected | -155.3 | -1.62 | 3.31 | 0.15 | 0 | insufficient_positive_oos_windows |
| SOLUSDT | 1m | rejected | -244.8 | -0.22 | 0.45 | 0.11 | 0 | low_oos_trades;insufficient_positive_oos_windows |
| SOLUSDT | 3m | rejected | -337.9 | -0.82 | 2.60 | 0.54 | 1 | insufficient_positive_oos_windows;one_trade_dominance;one_month_dominance |
| SOLUSDT | 3m | rejected | -341.3 | -0.73 | 2.16 | 0.50 | 1 | insufficient_positive_oos_windows;one_trade_dominance;one_month_dominance |
| SOLUSDT | 3m | rejected | -347.0 | -0.93 | 2.71 | 0.48 | 1 | insufficient_positive_oos_windows;one_trade_dominance;one_month_dominance |
| SOLUSDT | 3m | rejected | -347.0 | -0.93 | 2.71 | 0.48 | 1 | insufficient_positive_oos_windows;one_trade_dominance;one_month_dominance |

## Final recommendation

**REJECT**

### Realistic candidates

- **Stable / low risk:** SOLUSDT 1m
- **Best return:** SOLUSDT 1m
- **Best drawdown:** SOLUSDT 1m