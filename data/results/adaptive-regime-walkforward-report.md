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
| 1 | -0.87 | -0.15 | -1.23 | 1.54 | 12 |
| 2 | -2.26 | -1.37 | -1.13 | 1.13 | 7 |
| 3 | 0.04 | -0.30 | -1.83 | 1.83 | 15 |
| 4 | -1.86 | -1.28 | -1.17 | 1.17 | 6 |


## Best candidates

| Symbol | TF | Bucket | Score | OOS avg mo % | OOS DD % | OOS PF | +windows | Rejected |
|--------|-----|--------|------:|-------------:|---------:|-------:|---------:|:--------:|
| SOLUSDT | 15m | rejected | -140.7 | -1.34 | 1.42 | 0.16 | 0 | insufficient_positive_oos_windows |
| SOLUSDT | 15m | rejected | -143.2 | -1.66 | 1.74 | 0.27 | 0 | insufficient_positive_oos_windows |
| SOLUSDT | 15m | rejected | -146.7 | -1.58 | 1.76 | 0.28 | 0 | insufficient_positive_oos_windows |
| SOLUSDT | 15m | rejected | -149.9 | -1.76 | 1.87 | 0.28 | 0 | insufficient_positive_oos_windows |
| SOLUSDT | 15m | rejected | -162.5 | -2.36 | 2.47 | 0.25 | 0 | insufficient_positive_oos_windows |
| SOLUSDT | 15m | rejected | -173.4 | -2.98 | 3.19 | 0.30 | 0 | insufficient_positive_oos_windows |

## Final recommendation

**REJECT**

### Realistic candidates

- **Stable / low risk:** SOLUSDT 15m
- **Best return:** SOLUSDT 15m
- **Best drawdown:** SOLUSDT 15m