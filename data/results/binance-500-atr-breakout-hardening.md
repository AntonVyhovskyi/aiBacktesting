# ATR Volatility Breakout — local hardening (SOLUSDT 15m)

Generated: 2026-08-25T16:33:51.490Z

## Setup

- Source: **BINANCE_FUTURES** (REST, with data.binance.vision fallback)
- Symbol / TF: **SOLUSDT 15m** (aggregated from 1m cache)
- Window: 2025-11-02T00:00:00.000Z → 2026-05-01T00:15:00.000Z (`BACKTEST_END_TIME_MS=1777593600000`, 6×30d)
- Start balance: **500 USDC**, fee **0.00035 per side**
- 1m candles: 259201, coverage 100%
- Strategy: ATR_VOLATILITY_BREAKOUT label `r30-l3-volume`

## Reproduction vs cloud report

| Field | Cloud | Local | Match |
|---|---:|---:|:---:|
| End balance | 660.268462 | 660.268462 | yes |
| Net PnL | 160.268462 | 160.268462 | yes |
| Avg monthly notional | 52406.49 | 52406.49 | yes |
| Min monthly notional | 37071.33 | 37071.33 | yes |
| Max DD | 4.424832% | 4.424832% | yes |
| PF | 1.462911 | 1.462911 | yes |
| Trades | 247 | 247 | yes |

Reproduction verdict: **MATCH (within tolerance)**

### Baseline monthly

| Month | Notional | Net PnL | Max DD | Trades | PF |
|---|---:|---:|---:|---:|---:|
| 2025-11 | 37071.33 | -2.3052 | 3.6323% | 41 | 0.9531 |
| 2025-12 | 56793.77 | 50.3389 | 2.8135% | 50 | 1.9092 |
| 2026-01 | 62601.61 | 62.3177 | 3.2723% | 45 | 1.9556 |
| 2026-02 | 42997.53 | 13.4113 | 4.4248% | 39 | 1.2304 |
| 2026-03 | 68499.32 | 12.9694 | 3.6985% | 46 | 1.1662 |
| 2026-04 | 46475.39 | 23.5363 | 1.8127% | 26 | 1.5847 |

## Slippage and funding impact (winner params)

| Scenario | End | Net PnL | Avg monthly | Min monthly | Full DD | Monthly DD | PF | Trades | Flags |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| baseline-0slip-0fund | 660.27 | 160.2685 | 52406 | 37071 | 4.425% | 4.425% | 1.463 | 247 | minMonthlyNotional<50k |
| slip-1bps | 627.37 | 127.3727 | 51008 | 36924 | 4.741% | 4.741% | 1.356 | 247 | minMonthlyNotional<50k |
| slip-2bps | 586.71 | 86.7096 | 49359 | 36789 | 5.055% | 5.055% | 1.236 | 247 | avgMonthlyNotional<50k, minMonthlyNotional<50k, monthlyDD>5, fullDD>5 |
| funding-1bp-per-8h | 660.52 | 160.5192 | 52421 | 37071 | 4.425% | 4.425% | 1.464 | 247 | minMonthlyNotional<50k |
| funding-3bp-per-8h | 661.02 | 161.0208 | 52450 | 37071 | 4.425% | 4.425% | 1.465 | 247 | minMonthlyNotional<50k |
| slip-2bps+funding-1bp | 586.93 | 86.9326 | 49373 | 36789 | 5.055% | 5.055% | 1.236 | 247 | avgMonthlyNotional<50k, minMonthlyNotional<50k, monthlyDD>5, fullDD>5 |

Funding model: 8h marks, default **+1 bp / 8h** (longs pay, shorts receive). This is a conservative placeholder, not historical Binance funding.

## Walk-forward / OOS (same params, no re-fit)

Anchored split at 2026-03-08T00:10:30.000Z (70/30 by time):

| Leg | Trades | Net PnL | Max DD | PF |
|---|---:|---:|---:|---:|
| In-sample cold start | 186 | 136.9743 | 4.4248% | 1.5613 |
| OOS cold start | 61 | 18.2924 | 4.0299% | 1.2281 |
| Full-run trades in OOS window | 61 | 23.2942 | — | — |

Rolling 3-window WF (50% train / 15% val / 35% OOS, cold-start indicators):

| Window | Train net / DD / n | Val net / DD / n | OOS net / DD / n |
|---:|---|---|---|
| 1 | 9.48 / 3.63% / 44 | 10.65 / 2.81% / 20 | 24.20 / 1.52% / 26 |
| 2 | 36.51 / 3.27% / 41 | 13.07 / 1.23% / 19 | 6.64 / 3.59% / 27 |
| 3 | 11.95 / 3.70% / 41 | 6.61 / 0.73% / 8 | 11.72 / 1.81% / 18 |

OOS windows with net > 0: **3/3**

## Neighbor stability (cloud top-5 PASS list)

Baseline (0 slip / 0 funding):

| Scenario | End | Net PnL | Avg monthly | Min monthly | Full DD | Monthly DD | PF | Trades | Flags |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| top1-baseline | 660.27 | 160.2685 | 52406 | 37071 | 4.425% | 4.425% | 1.463 | 247 | minMonthlyNotional<50k |
| top2-baseline | 659.03 | 159.0288 | 50709 | 36057 | 4.431% | 4.431% | 1.474 | 228 | minMonthlyNotional<50k |
| top3-baseline | 659.18 | 159.1797 | 52146 | 36884 | 4.208% | 4.208% | 1.483 | 244 | minMonthlyNotional<50k |
| top4-baseline | 648.65 | 148.6526 | 56865 | 41917 | 4.776% | 4.776% | 1.391 | 258 | minMonthlyNotional<50k |
| top5-baseline | 612.09 | 112.0909 | 58032 | 39752 | 4.217% | 4.217% | 1.322 | 329 | minMonthlyNotional<50k |

Stress (2 bps slip + 1 bp/8h funding):

| Scenario | End | Net PnL | Avg monthly | Min monthly | Full DD | Monthly DD | PF | Trades | Flags |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| top1-slip2+fund1 | 586.93 | 86.9326 | 49373 | 36789 | 5.055% | 5.055% | 1.236 | 247 | avgMonthlyNotional<50k, minMonthlyNotional<50k, monthlyDD>5, fullDD>5 |
| top2-slip2+fund1 | 588.02 | 88.0162 | 47885 | 35791 | 5.334% | 4.935% | 1.246 | 228 | avgMonthlyNotional<50k, minMonthlyNotional<50k, fullDD>5 |
| top3-slip2+fund1 | 604.67 | 104.6656 | 50217 | 36606 | 5.116% | 5.116% | 1.294 | 244 | minMonthlyNotional<50k, monthlyDD>5, fullDD>5 |
| top4-slip2+fund1 | 571.43 | 71.4285 | 53346 | 41559 | 6.306% | 5.312% | 1.177 | 258 | minMonthlyNotional<50k, monthlyDD>5, fullDD>5 |
| top5-slip2+fund1 | 533.24 | 33.2403 | 54236 | 39441 | 6.310% | 5.354% | 1.089 | 329 | minMonthlyNotional<50k, monthlyDD>5, fullDD>5 |

Neighbors still passing avg≥50k, DD≤5, net≥0, PF≥1 at baseline: **5/5**

## Other symbols (same params, if data loaded)

| Scenario | End | Net PnL | Avg monthly | Min monthly | Full DD | Monthly DD | PF | Trades | Flags |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| BTCUSDT-winner-params | 435.74 | -64.2586 | 32889 | 15953 | 15.553% | 9.419% | 0.713 | 153 | avgMonthlyNotional<50k, minMonthlyNotional<50k, monthlyDD>5, fullDD>5, netPnL<0, PF<1 |
| ETHUSDT-winner-params | 437.08 | -62.9229 | 42263 | 29227 | 14.584% | 10.120% | 0.798 | 239 | avgMonthlyNotional<50k, minMonthlyNotional<50k, monthlyDD>5, fullDD>5, netPnL<0, PF<1 |

## Verdict

**research-only**

Use as research only. The average-volume target can pass while a month stays below 50k (Nov ~37k on the cloud winner), OOS/cold-start windows are small, and conservative friction eats a large share of the 500 USDC edge. Next step if pursued: paper trade with the same fee/slippage model — no API keys, no live orders.

### Caveats

- Slippage is applied on both entry and exit fills (buy worse / sell worse).
- Funding is a minimal 8h model (00:00/08:00/16:00 UTC) using candle open as mark; positive rate = longs pay.
- Walk-forward uses the same params (no re-optimization). Slice runs rebuild indicators on the slice only (cold start).
- exitOnOppositeSignal is present in params but unused by ATR_VOLATILITY_BREAKOUT (flat-or-enter logic).
- Paper trading only — no live keys, no order routing.
