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
| 1 | -0.75 | -0.81 | -0.64 | 0.80 | 6 |
| 2 | -1.23 | -0.08 | -1.36 | 1.36 | 4 |
| 3 | -0.14 | -0.27 | -1.60 | 1.60 | 6 |
| 4 | -2.86 | -1.23 | -1.41 | 1.41 | 6 |


## Best candidates

| Symbol | TF | Bucket | Score | OOS avg mo % | OOS DD % | OOS PF | +windows | Rejected |
|--------|-----|--------|------:|-------------:|---------:|-------:|---------:|:--------:|
| SOLUSDT | 15m | rejected | -138.4 | -1.25 | 1.29 | 0.17 | 0 | insufficient_positive_oos_windows |
| SOLUSDT | 15m | rejected | -244.4 | -0.31 | 0.36 | 0.20 | 0 | low_oos_trades;insufficient_positive_oos_windows |
| SOLUSDT | 15m | rejected | -246.8 | -0.51 | 0.62 | 0.28 | 0 | low_oos_trades;insufficient_positive_oos_windows |
| SOLUSDT | 15m | rejected | -247.9 | -0.58 | 0.62 | 0.17 | 0 | low_oos_trades;insufficient_positive_oos_windows |
| SOLUSDT | 15m | rejected | -247.9 | -0.52 | 0.61 | 0.12 | 0 | low_oos_trades;insufficient_positive_oos_windows |
| SOLUSDT | 15m | rejected | -248.3 | -0.60 | 0.72 | 0.27 | 0 | low_oos_trades;insufficient_positive_oos_windows |

## Final recommendation

**REJECT**

### Realistic candidates

- **Stable / low risk:** SOLUSDT 15m
- **Best return:** SOLUSDT 15m
- **Best drawdown:** SOLUSDT 15m