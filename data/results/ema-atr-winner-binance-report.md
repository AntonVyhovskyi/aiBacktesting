# EMA_ATR_WINNER_LEGACY — Binance Walk-Forward Report

Source: **BINANCE_FUTURES**
Generated: 2026-05-23T17:42:29.659Z

## Logic audit

See [ema-atr-winner-logic-audit.md](./ema-atr-winner-logic-audit.md)

## Original O1 winner (context)

- File: `max-monthly-volume-10dd-search-final.json`
- Symbol/timeframe: SOLUSD / 1m on O1
- ~30d cache, objective=max monthly notional under 10% DD (not 12m profit)
- Metrics: net -8.56%, DD 9.60%, 156 trades, PF 0.82

## Validation settings

- Months: 12 | Symbols: SOLUSDT, ETHUSDT | TF: 1m, 3m
- Fees: 0.00035/side | Entry: nextOpen | WF windows: 4
- Risk: 0.5% / leverage 3

## Final verdict

### REJECT

Does not meet PAPER_CANDIDATE or STRONG_CANDIDATE gates on clean Binance 12m walk-forward OOS.

## Best legacy run

- **ETHUSDT 3m** (legacy_faithful): OOS -44.81%/mo, DD 72.37%, PF 0.32, trades 1793, worst mo -51.25%, 1-trade dom 0.0%

### Walk-forward (best legacy)

| W | Train % | Val % | OOS % | OOS avg mo % | Worst mo % | OOS DD % | PF | Trades | 1-tr dom % |
|--:|--------:|------:|------:|-------------:|-----------:|---------:|---:|-------:|-----------:|
| 1 | -81.39 | -42.59 | -79.15 | -48.78 | -71.97 | 79.24 | 0.31 | 506 | 0.0 |
| 2 | -85.31 | -43.37 | -69.51 | -41.28 | -61.27 | 69.51 | 0.41 | 476 | 0.0 |
| 3 | -85.19 | -34.01 | -78.62 | -51.25 | -66.70 | 78.70 | 0.25 | 486 | 0.0 |
| 4 | -86.59 | -46.21 | -62.04 | -37.93 | -45.43 | 62.04 | 0.29 | 325 | 0.0 |

| Period | Net PnL % | Avg month % | Worst month % | Max DD % | PF | Trades | Avg R | 1-trade dom % |
|--------|----------:|------------:|--------------:|---------:|---:|-------:|------:|--------------:|
| ETHUSDT_w1_oos | -79.15 | -48.78 | -71.97 | 79.24 | 0.31 | 506 | -0.72 | 0.0 |
| ETHUSDT_w2_oos | -69.51 | -41.28 | -61.27 | 69.51 | 0.41 | 476 | -0.58 | 0.0 |
| ETHUSDT_w3_oos | -78.62 | -51.25 | -66.70 | 78.70 | 0.25 | 486 | -0.76 | 0.0 |
| ETHUSDT_w4_oos | -62.04 | -37.93 | -45.43 | 62.04 | 0.29 | 325 | -0.96 | 0.0 |

## vs generic EMA trend family

| Symbol | TF | Legacy OOS mo % | Generic best OOS mo % | Legacy DD % | Generic DD % |
|--------|-----|----------------:|----------------------:|------------:|-------------:|
| SOLUSDT | 1m | -59.61 | -85.13 | 88.63 | 99.56 |
| SOLUSDT | 3m | -45.32 | -70.62 | 75.15 | 95.84 |
| ETHUSDT | 1m | -53.13 | -83.95 | 80.19 | 99.27 |
| ETHUSDT | 3m | -44.81 | -69.39 | 72.37 | 94.54 |

## Failure analysis (if applicable)

- **Data source:** O1 winner was tuned on short/gappy O1 SOLUSD; Binance 12m is continuous — edge may not transfer.
- **Objective mismatch:** Original search maximized **volume** under DD cap, not monthly return.
- **Fees + next-open:** Realistic costs reduce churny crossover edges.
- **Regime:** Strategy is regime-agnostic (no regime filter) — reported as regime-independent.

## Secondary candidates (Binance)

- **Stable:** none with OOS ≥ 0% and DD ≤ 5%
- **Best return:** legacy_faithful ETHUSDT 3m — -44.81%/mo
- **Best DD:** legacy_faithful ETHUSDT 3m — DD 72.37%

Primary target (≥10% OOS mo, ≤5% DD): **NOT MET**