# Binance Bollinger No-Loss Volume Candidate — 6-Month Validation

## Verdict

**FAIL for no-loss** over the tested Binance Futures 6-month window.

This validates the fixed **BOLLINGER_MEAN_REVERSION** candidate from `no-loss-volume-strategy-report.md` on Binance Futures data. It answers whether the strategy still avoids losing money after fees; it does not claim stable monthly profitability.

## Setup

| Field | Value |
|---|---:|
| Source | BINANCE_FUTURES |
| Symbol | SOLUSDT |
| Timeframe | 1m |
| Candles | 259,200 |
| Range start | 2025-11-02T00:00:00.000Z |
| Range end | 2026-04-30T23:59:59.999Z |
| Cache | `/workspace/data/cache/binance_futures/SOLUSDT_1m_6m.json` |
| Coverage | 100% |
| Reliable data | yes |
| Gaps | 0 |
| Largest gap | 0 min |
| Start balance | 100.00 USDC |
| Fee rate | 0.0350% per side |

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

## Full-period metrics

| Metric | Value |
|---|---:|
| End balance | 90.309536 USDC |
| Net PnL after fees | -9.690464 USDC (-9.690464%) |
| Gross PnL | 0.196848 USDC |
| Total fees | 9.887312 USDC |
| Total notional volume | 28249.46 USDC |
| Trades | 30 |
| Trades/day | 0.166667 |
| Win rate | 33.333333% |
| Profit factor | 0.364546 |
| Max drawdown | 11.248266% |
| Avg monthly PnL | -1.615077% |
| Worst monthly PnL | -9.690464% |
| Profitable months | 0 |
| Stable-profit hard failures | not_all_months_profitable, monthly_pnl_below_10pct, profit_factor_low, trades_per_month_low |

## Monthly breakdown

| Month | Full | Trades | Notional USDC | Gross PnL | Fees | Net PnL | Net % | Max DD | PF |
|---|:---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2025-11 | yes | 30 | 28249.46 | 0.196848 | 9.887312 | -9.690464 | -9.690464% | 11.2483% | 0.3645 |
| 2025-12 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.000000% | 0.0000% | 0.0000 |
| 2026-01 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.000000% | 0.0000% | 0.0000 |
| 2026-02 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.000000% | 0.0000% | 0.0000 |
| 2026-03 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.000000% | 0.0000% | 0.0000 |
| 2026-04 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.000000% | 0.0000% | 0.0000 |

## Weekly breakdown

| Week | Start | Full | Trades | Notional USDC | Gross PnL | Fees | Net PnL | Max DD |
|---:|---|:---:|---:|---:|---:|---:|---:|---:|
| W1 | 2025-11-02 | yes | 30 | 28249.46 | 0.196848 | 9.887312 | -9.690464 | 11.2483% |
| W2 | 2025-11-09 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W3 | 2025-11-16 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W4 | 2025-11-23 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W5 | 2025-11-30 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W6 | 2025-12-07 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W7 | 2025-12-14 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W8 | 2025-12-21 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W9 | 2025-12-28 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W10 | 2026-01-04 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W11 | 2026-01-11 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W12 | 2026-01-18 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W13 | 2026-01-25 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W14 | 2026-02-01 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W15 | 2026-02-08 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W16 | 2026-02-15 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W17 | 2026-02-22 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W18 | 2026-03-01 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W19 | 2026-03-08 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W20 | 2026-03-15 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W21 | 2026-03-22 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W22 | 2026-03-29 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W23 | 2026-04-05 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W24 | 2026-04-12 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W25 | 2026-04-19 | yes | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |
| W26 | 2026-04-26 | partial | 0 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 0.0000% |

## Active days

- **2025-11-02**: trades=30, notional=28249.46, net=-9.690464, fees=9.887312

## Artifacts

- JSON: `/workspace/data/results/binance-bollinger-no-loss-6m-validation.json`
- Trades: `/workspace/data/results/trades/BINANCE_BOLLINGER_MEAN_REVERSION_6M_a26fa465e7cc.json`
- Equity: `/workspace/data/results/equity/BINANCE_BOLLINGER_MEAN_REVERSION_6M_a26fa465e7cc.csv`
