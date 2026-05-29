# Adaptive Regime — Walk-Forward Report

Source: **BINANCE_FUTURES**
Generated: 2026-05-01T00:00:00.000Z

## Data quality

## SOLUSDT

- Source: **BINANCE_FUTURES**

- Cache: `/workspace/data/cache/binance_futures/SOLUSDT_1m_6m.json`
- Candles: **259,200** (~180 days)
- Coverage: **100%** (expected ~259,201)
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

### SOLUSDT 15m

| Window | Train net % | Val net % | OOS net % | OOS DD % | OOS trades |
|-------:|------------:|----------:|----------:|---------:|-----------:|
| 1 | -0.71 | -0.15 | -0.75 | 0.99 | 10 |
| 2 | -2.26 | -1.17 | -0.84 | 0.84 | 6 |
| 3 | 0.04 | 0.13 | -2.22 | 2.22 | 13 |
| 4 | -1.51 | -1.28 | -1.19 | 1.19 | 5 |


## Best candidates

| Symbol | TF | Bucket | Score | OOS avg mo % | OOS DD % | OOS PF | +windows | Rejected |
|--------|-----|--------|------:|-------------:|---------:|-------:|---------:|:--------:|
| SOLUSDT | 15m | rejected | -142.5 | -1.25 | 1.31 | 0.14 | 0 | insufficient_positive_oos_windows |
| SOLUSDT | 15m | rejected | -144.5 | -1.46 | 1.54 | 0.26 | 0 | insufficient_positive_oos_windows |
| SOLUSDT | 15m | rejected | -149.0 | -1.53 | 1.70 | 0.25 | 0 | insufficient_positive_oos_windows |
| SOLUSDT | 15m | rejected | -151.3 | -1.64 | 1.75 | 0.27 | 0 | insufficient_positive_oos_windows |
| SOLUSDT | 15m | rejected | -158.0 | -2.01 | 2.14 | 0.25 | 0 | insufficient_positive_oos_windows |
| SOLUSDT | 15m | rejected | -169.7 | -2.60 | 2.83 | 0.29 | 0 | insufficient_positive_oos_windows |

## Final recommendation

**REJECT**

### Realistic candidates

- **Stable / low risk:** SOLUSDT 15m
- **Best return:** SOLUSDT 15m
- **Best drawdown:** SOLUSDT 15m