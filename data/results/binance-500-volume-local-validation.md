# Local validation — 500 USDC / 50k monthly volume candidate

Generated: 2026-08-25 (local Cursor Agent on `cursor/no-loss-volume-strategy-35b9`)

## Setup

- Repo: `AntonVyhovskyi/aiBacktesting`, branch `cursor/no-loss-volume-strategy-35b9`
- Data: Binance USD-M futures **SOLUSDT 1m**, 6×30d ending `BACKTEST_END_TIME_MS=1777593600000` (2026-05-01T00:00:00.000Z)
- Cache: `data/cache/binance_futures/SOLUSDT_1m_6m.json` — **259,201** candles, **100%** coverage, 0 gaps (REST `/fapi/v1/klines`; `data.binance.vision` zip fallback is in the loader if REST returns 451)
- Also loaded for transfer check: BTCUSDT and ETHUSDT 1m, same window, 259,201 candles each
- Fee: **0.00035 per side**, start **500 USDC**, no live keys
- Command: `BACKTEST_END_TIME_MS=1777593600000 npm run binance-500-volume-target-search`
- Hardening: `npm run binance-500-volume-hardening`

## Reproduction

**Yes — bit-identical on the metrics that matter.** Cloud winner `ATR_VOLATILITY_BREAKOUT` 15m / `r30-l3-volume` locally prints:

| Field | Cloud | Local |
|---|---:|---:|
| End balance | 660.268462 | 660.268462 |
| Net PnL | +160.268462 (+32.05%) | +160.268462 |
| Avg monthly notional | 52,406.49 | 52,406.49 |
| Min monthly notional | 37,071.33 | 37,071.33 |
| Max DD | 4.424832% | 4.424832% |
| PF | 1.462911 | 1.462911 |
| Trades | 247 | 247 |

Full grid re-run: **5760** variants, **8 PASS** on the average-monthly rule, same winner and same top-5. Cloud original kept as `binance-500-volume-target-search.cloud.md`. Only cosmetic diffs: local artifact paths, and `tradesPerDay` 1.372143 vs 1.372222 (last 15m bar at 2026-05-01T00:00 adds ~15 minutes to the span; no extra trade).

November 2025 is still the weak month: notional **37,071**, net **−2.31 USDC**, PF 0.95.

## Walk-forward / OOS (same params, no re-fit)

- Anchored 70/30: IS net **+136.97** (186 trades, DD 4.42%, PF 1.56); OOS cold-start net **+18.29** (61 trades, DD 4.03%, PF 1.23). Full-run trades that fall in the OOS window: **+23.29**.
- Rolling 3-window WF (50/15/35, cold-start indicators): OOS net **positive in 3/3** windows (24.20 / 6.64 / 11.72), DD inside 5% on every OOS slice.

SOLUSDT 15m is stable out-of-sample **on this window**, but windows are short and params were chosen on the full sample.

## Slippage and funding

| Scenario | Net PnL | Avg monthly | Max DD | Pass avg+DD? |
|---|---:|---:|---:|:---:|
| Baseline (fee only) | +160.27 | 52,406 | 4.42% | yes (min month still 37k) |
| 1 bp slippage both sides | +127.37 | 51,008 | 4.74% | yes |
| 2 bp slippage | +86.71 | 49,359 | **5.06%** | no |
| Funding +1 bp / 8h | +160.52 | 52,421 | 4.42% | yes |
| Funding +3 bp / 8h | +161.02 | 52,450 | 4.42% | yes |
| 2 bp slip + 1 bp/8h funding | +86.93 | 49,373 | **5.06%** | no |

Funding is a **minimal 8h model** (00:00/08:00/16:00 UTC, candle open as mark). Positive rate = longs pay / shorts receive. On this candidate it is slightly **net helpful** (more short-side receive than long-side pay) — not a robustness win. **Slippage is the real tax**: 2 bps both sides cuts ~73 USDC of the 160 edge and pushes DD through 5%.

## Neighbors (cloud top-5)

All five still PASS the original average-volume + DD≤5 filters at baseline (0 slip). Under 2 bps + 1 bp/8h funding **none** stay inside DD 5% and 50k average together. The family is tight around one SOL 15m fit, not a wide plateau.

## Other symbols (same winner params)

- **BTCUSDT**: net **−64.26**, DD **15.6%**, PF 0.71 — fail
- **ETHUSDT**: net **−62.92**, DD **14.6%**, PF 0.80 — fail

Do not transfer these params off SOLUSDT.

## Harder target: every month ≥ 50k

Same 5760 grid, extra filter `minMonthlyNotional ≥ 50,000`.

**No PASS.** Closest DD-safe min-month is **41,917**. Rows that reach ~46.8k min-month print DD **~6.17%**. Report: `binance-500-min-monthly-50k-search.md`.

## Verdict

**research-only**

Not paper-ready: one losing / sub-50k month, 2 bps friction breaks the DD cap, params do not transfer to BTC/ETH, and the “every month ≥50k” goal has no candidate on this window.

If pursued later, paper-trade **SOLUSDT 15m only** with the baseline params, assume ≥1–2 bps slippage, log funding from the exchange, and stop if monthly DD > 5% or a month prints < 40k notional. No live routing and no API keys from this work.

Details: `binance-500-atr-breakout-hardening.md`.
