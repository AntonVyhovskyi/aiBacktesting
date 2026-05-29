# Binance Family Search Report

Source: **BINANCE_FUTURES**
Generated: 2026-05-23T17:37:16.953Z
Months: 12 | Symbols: SOLUSDT, ETHUSDT | TF: 1m, 3m

## Data quality

## SOLUSDT

- Source: **BINANCE_FUTURES**

- Cache: `C:\Users\vygov\OneDrive\Desktop\aiBacktesting\data\cache\binance_futures\SOLUSDT_1m_12m.json`
- Candles: **518,376** (~360 days)
- Coverage: **100%** (expected ~518,401)
- Gaps: 0 (largest 0 min, ~0 missing bars)
- Duplicates: 0
- Reliable for optimization: **YES**
## ETHUSDT

- Source: **BINANCE_FUTURES**

- Cache: `C:\Users\vygov\OneDrive\Desktop\aiBacktesting\data\cache\binance_futures\ETHUSDT_1m_12m.json`
- Candles: **518,376** (~360 days)
- Coverage: **100%** (expected ~518,401)
- Gaps: 0 (largest 0 min, ~0 missing bars)
- Duplicates: 0
- Reliable for optimization: **YES**

## Target

- OOS avg monthly ≥ **10%**
- OOS max DD ≤ **5%**
- Ranked by **walk-forward OOS** (not train)

**Primary target met:** **NO**

## Family leaderboard (best variant per family × symbol × TF)

| Family | Symbol | TF | Score | OOS avg mo % | Worst mo % | OOS DD % | PF | Trades | +WF | Status |
|--------|--------|-----|------:|-------------:|-----------:|---------:|---:|-------:|----:|--------|
| VWAP pullback | ETHUSDT | 3m | -141.3 | -1.04 | -1.50 | 2.49 | 0.23 | 51 | 0/4 | insufficient_positive_oos_windows |
| VWAP pullback | ETHUSDT | 1m | -143.2 | -1.17 | -1.63 | 2.44 | 0.12 | 49 | 0/4 | insufficient_positive_oos_windows |
| VWAP pullback | SOLUSDT | 3m | -153.3 | -1.44 | -2.85 | 3.02 | 0.21 | 71 | 0/4 | insufficient_positive_oos_windows |
| VWAP pullback | SOLUSDT | 1m | -156.3 | -1.65 | -2.90 | 3.38 | 0.15 | 65 | 0/4 | insufficient_positive_oos_windows |
| RSI mean reversion | ETHUSDT | 3m | -515.5 | -14.49 | -18.19 | 27.92 | 0.41 | 595 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| RSI mean reversion | SOLUSDT | 3m | -520.6 | -15.34 | -17.63 | 29.10 | 0.37 | 598 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| ATR volatility breakout | SOLUSDT | 3m | -572.1 | -17.94 | -21.01 | 34.33 | 0.38 | 663 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| ATR volatility breakout | ETHUSDT | 3m | -618.5 | -20.35 | -24.37 | 38.41 | 0.35 | 686 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| RSI mean reversion | SOLUSDT | 1m | -776.2 | -29.91 | -34.94 | 52.74 | 0.51 | 1702 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| RSI mean reversion | ETHUSDT | 1m | -854.8 | -34.36 | -40.81 | 59.04 | 0.45 | 1792 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| ATR volatility breakout | SOLUSDT | 1m | -1020.1 | -44.05 | -52.92 | 72.42 | 0.41 | 2024 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| Donchian breakout | ETHUSDT | 3m | -1070.5 | -49.36 | -52.76 | 79.88 | 0.38 | 2449 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| ATR volatility breakout | ETHUSDT | 1m | -1076.4 | -49.53 | -54.74 | 78.13 | 0.34 | 2214 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| Donchian breakout | SOLUSDT | 3m | -1115.3 | -51.66 | -57.73 | 81.28 | 0.36 | 2618 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| Bollinger mean reversion | SOLUSDT | 3m | -1117.4 | -53.78 | -56.58 | 81.67 | 0.49 | 3766 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| Trend + BTC filter | ETHUSDT | 3m | -1130.7 | -54.29 | -57.26 | 83.27 | 0.39 | 2972 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| Opening-range / session breakout | ETHUSDT | 3m | -1147.7 | -52.41 | -61.87 | 82.53 | 0.40 | 3232 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| Trend + BTC filter | SOLUSDT | 3m | -1166.1 | -55.57 | -61.32 | 84.75 | 0.38 | 3181 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| Bollinger mean reversion | ETHUSDT | 3m | -1185.2 | -58.39 | -61.75 | 86.22 | 0.46 | 4046 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| Opening-range / session breakout | SOLUSDT | 3m | -1228.6 | -59.01 | -67.55 | 87.49 | 0.34 | 3673 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| EMA trend continuation | ETHUSDT | 3m | -1327.2 | -67.93 | -74.03 | 93.65 | 0.41 | 5020 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| EMA trend continuation | SOLUSDT | 3m | -1353.8 | -68.62 | -76.92 | 95.28 | 0.41 | 5579 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| Opening-range / session breakout | ETHUSDT | 1m | -1381.6 | -70.44 | -80.33 | 95.27 | 0.41 | 5638 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| Opening-range / session breakout | SOLUSDT | 1m | -1402.5 | -71.09 | -83.26 | 95.48 | 0.42 | 6006 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| Trend + BTC filter | ETHUSDT | 1m | -1426.8 | -76.95 | -82.10 | 97.41 | 0.40 | 6625 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| Trend + BTC filter | SOLUSDT | 1m | -1433.3 | -77.33 | -82.85 | 97.58 | 0.43 | 6931 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| Donchian breakout | SOLUSDT | 1m | -1439.6 | -76.17 | -84.69 | 97.51 | 0.40 | 6184 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| Donchian breakout | ETHUSDT | 1m | -1442.2 | -77.22 | -84.58 | 97.16 | 0.36 | 6115 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| Bollinger mean reversion | SOLUSDT | 1m | -1481.6 | -82.72 | -86.32 | 99.11 | 0.45 | 10773 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| EMA trend continuation | ETHUSDT | 1m | -1503.2 | -83.58 | -89.25 | 99.22 | 0.44 | 9788 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| EMA trend continuation | SOLUSDT | 1m | -1522.8 | -84.96 | -91.38 | 99.54 | 0.44 | 10516 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |
| Bollinger mean reversion | ETHUSDT | 1m | -1527.7 | -86.48 | -91.08 | 99.58 | 0.39 | 11503 | 0/4 | insufficient_positive_oos_windows;oos_dd_high |

## Walk-forward (top 5 by OOS score)

### VWAP pullback — ETHUSDT 3m

| W | Train % | Val % | OOS % | OOS DD % | Trades |
|--:|--------:|------:|------:|---------:|-------:|
| 1 | -1.31 | -1.62 | -3.01 | 3.29 | 16 |
| 2 | -5.34 | -8.28 | -1.47 | 1.47 | 5 |
| 3 | -7.30 | -3.61 | -0.90 | 2.18 | 13 |
| 4 | -7.42 | -3.84 | -2.90 | 3.03 | 17 |

### VWAP pullback — ETHUSDT 1m

| W | Train % | Val % | OOS % | OOS DD % | Trades |
|--:|--------:|------:|------:|---------:|-------:|
| 1 | -4.79 | 1.24 | -1.22 | 1.46 | 10 |
| 2 | -10.81 | -9.77 | -1.98 | 1.98 | 6 |
| 3 | -6.97 | -3.55 | -2.89 | 3.07 | 17 |
| 4 | -16.59 | -2.99 | -3.24 | 3.24 | 16 |

### VWAP pullback — SOLUSDT 3m

| W | Train % | Val % | OOS % | OOS DD % | Trades |
|--:|--------:|------:|------:|---------:|-------:|
| 1 | -2.15 | -5.98 | -5.67 | 5.89 | 38 |
| 2 | -4.81 | -1.94 | -2.35 | 2.35 | 11 |
| 3 | -5.50 | -2.85 | -0.99 | 1.39 | 9 |
| 4 | -8.05 | -6.91 | -2.45 | 2.45 | 13 |

### VWAP pullback — SOLUSDT 1m

| W | Train % | Val % | OOS % | OOS DD % | Trades |
|--:|--------:|------:|------:|---------:|-------:|
| 1 | -6.52 | -2.05 | -5.74 | 5.79 | 34 |
| 2 | -6.00 | -6.76 | -2.11 | 2.29 | 10 |
| 3 | -8.74 | -1.33 | -1.42 | 1.57 | 7 |
| 4 | -5.97 | -4.05 | -3.86 | 3.86 | 14 |

### RSI mean reversion — ETHUSDT 3m

| W | Train % | Val % | OOS % | OOS DD % | Trades |
|--:|--------:|------:|------:|---------:|-------:|
| 1 | -25.71 | -7.89 | -22.53 | 24.61 | 143 |
| 2 | -24.23 | -20.13 | -33.66 | 33.74 | 158 |
| 3 | -30.07 | -6.28 | -23.27 | 23.27 | 151 |
| 4 | -32.45 | -4.01 | -29.42 | 30.07 | 143 |


## Secondary picks

- **Stable low-DD:** none
- **Best return:** VWAP pullback ETHUSDT 3m — -1.04%/mo
- **Best drawdown:** VWAP pullback ETHUSDT 1m — DD 2.44%
- **Best trade count:** Bollinger mean reversion ETHUSDT 1m — 11503 OOS trades

**No family met 10%/month OOS with ≤5% DD** on clean Binance 12m data. Adaptive-regime was correctly rejected; these classic families do not rescue the target on this run.