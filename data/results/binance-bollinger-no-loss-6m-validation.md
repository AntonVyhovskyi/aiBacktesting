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
  "maxTradesPerDay": 999,
  "bbPeriod": 20,
  "riskPct": 1.5,
  "leverage": 5
}
```

## Full-period metrics

| Metric | Value |
|---|---:|
| End balance | 0.000002 USDC |
| Net PnL after fees | -99.999997 USDC (-99.999997%) |
| Gross PnL | -20.403903 USDC |
| Total fees | 79.596094 USDC |
| Total notional volume | 227417.56 USDC |
| Trades | 15799 |
| Trades/day | 87.772222 |
| Win rate | 33.571745% |
| Profit factor | 0.461891 |
| Max drawdown | 100.000000% |
| Avg monthly PnL | -24.925405% |
| Worst monthly PnL | -99.995809% |
| Profitable months | 1 |
| Stable-profit hard failures | not_all_months_profitable, monthly_pnl_below_10pct, full_dd_too_high, monthly_dd_too_high, profit_factor_low |

## Monthly breakdown

| Month | Full | Trades | Notional USDC | Gross PnL | Fees | Net PnL | Net % | Max DD | PF |
|---|:---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2025-11 | yes | 2491 | 227403.66 | -20.404528 | 79.591281 | -99.995809 | -99.995809% | 99.9958% | 0.4619 |
| 2025-12 | yes | 2679 | 13.76 | 0.000624 | 0.004812 | -0.004188 | -99.934383% | 99.9420% | 0.5504 |
| 2026-01 | yes | 2701 | 0.07 | 0.000001 | 0.000002 | 0.000000 | -17.090909% | 34.0136% | 0.9916 |
| 2026-02 | yes | 2519 | 0.02 | 0.000000 | 0.000000 | -0.000001 | -64.912281% | 81.8565% | 0.9524 |
| 2026-03 | yes | 2785 | 0.02 | 0.000001 | 0.000000 | 0.000000 | 5.000000% | 41.4894% | 1.0932 |
| 2026-04 | yes | 2624 | 0.04 | 0.000000 | 0.000000 | 0.000001 | 127.380952% | 21.2435% | 1.0167 |

## Weekly breakdown

| Week | Start | Full | Trades | Notional USDC | Gross PnL | Fees | Net PnL | Max DD |
|---:|---|:---:|---:|---:|---:|---:|---:|---:|
| W1 | 2025-11-02 | yes | 598 | 208826.57 | -18.443303 | 73.089300 | -91.532603 | 91.6091% |
| W2 | 2025-11-09 | yes | 616 | 17316.61 | -1.935788 | 6.060814 | -7.996602 | 99.5482% |
| W3 | 2025-11-16 | yes | 599 | 1142.92 | -0.021061 | 0.400023 | -0.421084 | 99.9518% |
| W4 | 2025-11-23 | yes | 580 | 112.13 | -0.004210 | 0.039246 | -0.043455 | 99.9938% |
| W5 | 2025-11-30 | yes | 591 | 16.28 | 0.000517 | 0.005699 | -0.005182 | 99.9989% |
| W6 | 2025-12-07 | yes | 594 | 2.46 | -0.000085 | 0.000860 | -0.000945 | 99.9999% |
| W7 | 2025-12-14 | yes | 612 | 0.37 | 0.000025 | 0.000130 | -0.000105 | 100.0000% |
| W8 | 2025-12-21 | yes | 632 | 0.06 | 0.000000 | 0.000020 | -0.000020 | 100.0000% |
| W9 | 2025-12-28 | yes | 609 | 0.02 | 0.000001 | 0.000001 | 0.000000 | 100.0000% |
| W10 | 2026-01-04 | yes | 644 | 0.02 | 0.000000 | 0.000000 | 0.000000 | 100.0000% |
| W11 | 2026-01-11 | yes | 638 | 0.01 | 0.000000 | 0.000000 | 0.000000 | 100.0000% |
| W12 | 2026-01-18 | yes | 552 | 0.01 | 0.000001 | 0.000000 | 0.000001 | 100.0000% |
| W13 | 2026-01-25 | yes | 606 | 0.02 | 0.000000 | 0.000001 | -0.000001 | 100.0000% |
| W14 | 2026-02-01 | yes | 655 | 0.01 | -0.000002 | 0.000000 | -0.000002 | 100.0000% |
| W15 | 2026-02-08 | yes | 612 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 100.0000% |
| W16 | 2026-02-15 | yes | 614 | 0.00 | 0.000001 | 0.000000 | 0.000001 | 100.0000% |
| W17 | 2026-02-22 | yes | 638 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 100.0000% |
| W18 | 2026-03-01 | yes | 620 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 100.0000% |
| W19 | 2026-03-08 | yes | 637 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 100.0000% |
| W20 | 2026-03-15 | yes | 639 | 0.00 | 0.000001 | 0.000000 | 0.000001 | 100.0000% |
| W21 | 2026-03-22 | yes | 602 | 0.00 | 0.000000 | 0.000000 | 0.000000 | 100.0000% |
| W22 | 2026-03-29 | yes | 642 | 0.01 | 0.000000 | 0.000000 | 0.000000 | 100.0000% |
| W23 | 2026-04-05 | yes | 623 | 0.01 | 0.000000 | 0.000000 | 0.000000 | 100.0000% |
| W24 | 2026-04-12 | yes | 590 | 0.01 | 0.000000 | 0.000000 | 0.000000 | 100.0000% |
| W25 | 2026-04-19 | yes | 628 | 0.01 | 0.000000 | 0.000000 | 0.000000 | 100.0000% |
| W26 | 2026-04-26 | partial | 428 | 0.01 | 0.000000 | 0.000000 | 0.000000 | 100.0000% |

## Active days

- **2025-11-02**: trades=84, notional=72068.55, net=-29.226546, fees=25.223992
- **2025-11-03**: trades=98, notional=53457.68, net=-22.936316, fees=18.710187
- **2025-11-04**: trades=95, notional=32454.49, net=-18.527023, fees=11.359072
- **2025-11-05**: trades=71, notional=17062.09, net=-8.041300, fees=5.971732
- **2025-11-06**: trades=81, notional=15436.39, net=-5.100891, fees=5.402738
- **2025-11-07**: trades=97, notional=11681.56, net=-5.964234, fees=4.088547
- **2025-11-08**: trades=72, notional=6665.80, net=-1.736293, fees=2.333031
- **2025-11-09**: trades=83, notional=5821.29, net=-2.242910, fees=2.037451
- **2025-11-10**: trades=92, notional=4510.53, net=-2.549645, fees=1.578687
- **2025-11-11**: trades=86, notional=2413.18, net=-1.092551, fees=0.844614
- **2025-11-12**: trades=80, notional=1831.55, net=-0.615704, fees=0.641041
- **2025-11-13**: trades=91, notional=1454.33, net=-0.804415, fees=0.509014
- **2025-11-14**: trades=99, notional=825.93, net=-0.537162, fees=0.289075
- **2025-11-15**: trades=85, notional=459.81, net=-0.154215, fees=0.160932
- **2025-11-16**: trades=89, notional=346.96, net=-0.117015, fees=0.121435
- **2025-11-17**: trades=83, notional=226.70, net=-0.091623, fees=0.079345
- **2025-11-18**: trades=81, notional=184.04, net=-0.048831, fees=0.064415
- **2025-11-19**: trades=89, notional=157.59, net=-0.068538, fees=0.055156
- **2025-11-20**: trades=88, notional=107.21, net=-0.037016, fees=0.037523
- **2025-11-21**: trades=87, notional=73.38, net=-0.043649, fees=0.025683
- **2025-11-22**: trades=82, notional=47.05, net=-0.014411, fees=0.016466
- **2025-11-23**: trades=78, notional=33.25, net=-0.011410, fees=0.011637
- **2025-11-24**: trades=89, notional=26.98, net=-0.013922, fees=0.009441
- **2025-11-25**: trades=87, notional=18.21, net=-0.008764, fees=0.006375
- **2025-11-26**: trades=72, notional=10.42, net=-0.002690, fees=0.003648
- **2025-11-27**: trades=82, notional=9.58, net=-0.002643, fees=0.003353
- **2025-11-28**: trades=96, notional=8.43, net=-0.002932, fees=0.002952
- **2025-11-29**: trades=76, notional=5.26, net=-0.001094, fees=0.001840
- **2025-11-30**: trades=98, notional=5.42, net=-0.002064, fees=0.001898
- **2025-12-01**: trades=79, notional=2.90, net=-0.000608, fees=0.001014
- **2025-12-02**: trades=80, notional=2.37, net=-0.001097, fees=0.000828
- **2025-12-03**: trades=92, notional=1.99, net=-0.000473, fees=0.000697
- **2025-12-04**: trades=89, notional=1.60, net=-0.000405, fees=0.000560
- **2025-12-05**: trades=77, notional=1.13, net=-0.000335, fees=0.000397
- **2025-12-06**: trades=76, notional=0.87, net=-0.000199, fees=0.000305
- **2025-12-07**: trades=93, notional=0.83, net=-0.000409, fees=0.000290
- **2025-12-08**: trades=93, notional=0.52, net=-0.000127, fees=0.000181
- **2025-12-09**: trades=79, notional=0.37, net=-0.000160, fees=0.000128
- **2025-12-10**: trades=84, notional=0.28, net=-0.000070, fees=0.000097
- **2025-12-11**: trades=79, notional=0.20, net=-0.000093, fees=0.000071
- **2025-12-12**: trades=84, notional=0.15, net=-0.000055, fees=0.000054
- **2025-12-13**: trades=82, notional=0.11, net=-0.000030, fees=0.000040
- **2025-12-14**: trades=85, notional=0.10, net=-0.000019, fees=0.000034
- **2025-12-15**: trades=88, notional=0.08, net=-0.000032, fees=0.000029
- **2025-12-16**: trades=100, notional=0.07, net=-0.000017, fees=0.000023
- **2025-12-17**: trades=86, notional=0.04, net=-0.000013, fees=0.000015
- **2025-12-18**: trades=84, notional=0.03, net=-0.000012, fees=0.000012
- **2025-12-19**: trades=86, notional=0.03, net=-0.000006, fees=0.000009
- **2025-12-20**: trades=83, notional=0.02, net=-0.000006, fees=0.000007
- **2025-12-21**: trades=102, notional=0.02, net=-0.000007, fees=0.000007
- **2025-12-22**: trades=85, notional=0.01, net=-0.000004, fees=0.000004
- **2025-12-23**: trades=88, notional=0.01, net=-0.000003, fees=0.000003
- **2025-12-24**: trades=84, notional=0.01, net=-0.000001, fees=0.000002
- **2025-12-25**: trades=98, notional=0.01, net=-0.000003, fees=0.000002
- **2025-12-26**: trades=88, notional=0.00, net=-0.000002, fees=0.000002
- **2025-12-27**: trades=87, notional=0.00, net=0.000000, fees=0.000000
- **2025-12-28**: trades=80, notional=0.00, net=0.000000, fees=0.000000
- **2025-12-29**: trades=96, notional=0.00, net=0.000000, fees=0.000000
- **2025-12-30**: trades=90, notional=0.00, net=0.000000, fees=0.000000
- **2025-12-31**: trades=82, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-01**: trades=87, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-02**: trades=96, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-03**: trades=78, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-04**: trades=92, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-05**: trades=83, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-06**: trades=102, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-07**: trades=94, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-08**: trades=98, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-09**: trades=95, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-10**: trades=80, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-11**: trades=99, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-12**: trades=93, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-13**: trades=95, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-14**: trades=91, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-15**: trades=85, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-16**: trades=94, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-17**: trades=81, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-18**: trades=85, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-19**: trades=78, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-20**: trades=84, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-21**: trades=92, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-22**: trades=65, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-23**: trades=79, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-24**: trades=69, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-25**: trades=94, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-26**: trades=83, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-27**: trades=90, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-28**: trades=79, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-29**: trades=72, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-30**: trades=88, notional=0.00, net=0.000000, fees=0.000000
- **2026-01-31**: trades=100, notional=0.00, net=-0.000001, fees=0.000000
- **2026-02-01**: trades=96, notional=0.00, net=-0.000001, fees=0.000000
- **2026-02-02**: trades=92, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-03**: trades=94, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-04**: trades=90, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-05**: trades=94, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-06**: trades=97, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-07**: trades=92, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-08**: trades=108, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-09**: trades=91, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-10**: trades=83, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-11**: trades=84, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-12**: trades=82, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-13**: trades=78, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-14**: trades=86, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-15**: trades=92, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-16**: trades=92, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-17**: trades=90, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-18**: trades=85, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-19**: trades=85, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-20**: trades=88, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-21**: trades=82, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-22**: trades=88, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-23**: trades=85, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-24**: trades=76, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-25**: trades=93, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-26**: trades=90, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-27**: trades=96, notional=0.00, net=0.000000, fees=0.000000
- **2026-02-28**: trades=110, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-01**: trades=106, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-02**: trades=84, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-03**: trades=88, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-04**: trades=92, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-05**: trades=91, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-06**: trades=77, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-07**: trades=82, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-08**: trades=104, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-09**: trades=102, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-10**: trades=88, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-11**: trades=97, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-12**: trades=78, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-13**: trades=87, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-14**: trades=81, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-15**: trades=84, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-16**: trades=90, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-17**: trades=89, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-18**: trades=94, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-19**: trades=101, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-20**: trades=94, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-21**: trades=87, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-22**: trades=80, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-23**: trades=90, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-24**: trades=79, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-25**: trades=92, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-26**: trades=94, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-27**: trades=84, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-28**: trades=83, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-29**: trades=97, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-30**: trades=99, notional=0.00, net=0.000000, fees=0.000000
- **2026-03-31**: trades=91, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-01**: trades=87, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-02**: trades=93, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-03**: trades=85, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-04**: trades=90, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-05**: trades=92, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-06**: trades=91, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-07**: trades=91, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-08**: trades=96, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-09**: trades=89, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-10**: trades=81, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-11**: trades=83, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-12**: trades=71, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-13**: trades=89, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-14**: trades=85, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-15**: trades=85, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-16**: trades=91, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-17**: trades=92, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-18**: trades=77, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-19**: trades=105, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-20**: trades=87, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-21**: trades=97, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-22**: trades=81, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-23**: trades=93, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-24**: trades=84, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-25**: trades=81, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-26**: trades=101, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-27**: trades=83, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-28**: trades=80, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-29**: trades=85, notional=0.00, net=0.000000, fees=0.000000
- **2026-04-30**: trades=79, notional=0.00, net=0.000000, fees=0.000000

## Artifacts

- JSON: `/workspace/data/results/binance-bollinger-no-loss-6m-validation.json`
- Trades: `/workspace/data/results/trades/BINANCE_BOLLINGER_MEAN_REVERSION_6M_221cb2e5dac7.json`
- Equity: `/workspace/data/results/equity/BINANCE_BOLLINGER_MEAN_REVERSION_6M_221cb2e5dac7.csv`
