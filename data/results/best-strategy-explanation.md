# Best High-Volume Near-Breakeven Strategy — Human Explanation

**Source:** `data/results/strategy-discovery-final.json`  
**Generated:** 2026-05-17  
**Symbol:** SOLUSD (O1 market ID 2) · **Timeframe:** 1m · **Backtest window:** last 10,000 candles (~7 days in sample)  
**Discovery mode:** quick (two-stage progressive search)

---

## 1. Strategy name

**ATR_VOLATILITY_BREAKOUT**

A volatility-expansion breakout system: when price closes beyond a recent range by a multiple of ATR, it enters in the breakout direction with an ATR-based stop, then manages the trade with take-profit, trailing stop, and hard stop logic.

---

## 2. Full parameter list

### Saved in `bestHighVolumeNearBreakeven.params`

| Parameter | Value | Role |
|-----------|------:|------|
| `atrPeriod` | 14 | ATR length for range threshold and stop distance |
| `atrMult` | 0.8 | Carried from shared risk grid (not used in entry formula for this strategy) |
| `trailStart` | 0.1% | Activate trailing after 0.1% favorable move |
| `trailGap` | 0.5% | Trailing stop distance from close |
| `takeProfitPct` | 0.8% | Close at +0.8% unrealized profit |
| `breakEvenPct` | 0 | Break-even stop **disabled** |
| `maxHoldCandles` | 0 | No max-hold force exit |
| `exitOnOppositeSignal` | 1 | Enabled in config (no opposite-signal exit in ATR vol logic itself) |
| `cooldownCandles` | 2 | Wait 2 bars after exit before next entry |
| `minAtrFilter` | 0 | No minimum ATR filter |
| `minEmaDistancePct` | 0 | No EMA distance filter |
| `minMoveVsFeeMult` | 0 | No minimum move vs fee gate |
| `minVolumeMult` | 0 | No candle volume spike filter |
| `maxTradesPerDay` | 40 | Cap entries at 40 per UTC day |
| `riskPct` | 1.5% | Risk per trade vs balance |

### Entry defaults (used at runtime, not in JSON blob)

The final JSON omits entry keys because Stage 1 ENTRY `kept` was empty and seeds used `COMMON_DEFAULTS` only. The strategy code applies these defaults:

| Parameter | Value | Role |
|-----------|------:|------|
| `lookback` | **20** | Bars for range high/low (excluding current bar) |
| `breakoutMult` | **1.5** | Close must exceed range by `ATR × 1.5` |
| `stopMult` | **1.5** | Initial stop = entry ± `ATR × 1.5` |

### Execution / account (from run config)

| Setting | Value |
|---------|------:|
| `initialBalance` | 1,000 |
| `leverage` | 5× |
| `feeRate` | 0.035% per side (0.00035) |
| `entryMode` | `nextOpen` (signal on bar *i*, fill on bar *i+1* open) |

---

## 3. What market condition it tries to catch

This strategy targets **short bursts of directional volatility** after price compresses into a range:

- It measures a **20-bar range** (recent high/low).
- It requires a **close outside that range by more than 1.5× ATR(14)** — a volatility-adjusted breakout, not a bare Donchian touch.
- It works best when SOL makes **impulsive 1m moves** (expansion) rather than slow drifts or tight chop.
- It is **direction-agnostic**: long on upside expansion, short on downside expansion.

It does **not** try to predict trend reversals or mean-revert; it rides **momentum ignition** with quick exits when wrong.

---

## 4. Entry logic (step-by-step)

For each 1m bar index `i` (starting after `lookback`):

1. **Manage open position** (stops, TP, trail) and process any pending `nextOpen` fill.
2. If already in a position → skip new entries.
3. Read **ATR(14)** at `i`; if invalid → skip.
4. Compute **rangeHigh** = max(high) over bars `[i-20, i-1]` and **rangeLow** = min(low) over same window.
5. **Threshold** = `ATR × 1.5`.
6. **Long signal** if `close > rangeHigh + threshold`  
   → stop = `close - ATR × 1.5` (stored for fill).
7. **Short signal** if `close < rangeLow - threshold`  
   → stop = `close + ATR × 1.5`.
8. **Filters before fill:**
   - Not in **cooldown** (2 bars after last exit).
   - **Trades today** &lt; 40.
9. On signal with `nextOpen`: queue entry for **next bar open** at queued stop level.
10. **Position size** from risk model (see §10).

---

## 5. Exit logic (step-by-step)

On every bar while a position is open (priority order):

1. **Max hold** — skipped (`maxHoldCandles = 0`).
2. **Take profit** — if unrealized PnL ≥ **+0.8%**, exit at **close** (`take_profit`).
3. **Break-even** — disabled (`breakEvenPct = 0`).
4. **Trailing stop** — after **+0.1%** profit, trail at **0.5%** from close; tighten only in favorable direction.
5. **Hard stop** — if price hits `stopLoss` (initial or trailed): exit at stop (`stop` or `trail`).
6. **End of data** — force-close last position at final close if still open.

**Observed exit mix (140 trades):** 78 stop · 37 trail · 25 take_profit

There is **no** “opposite breakout” exit in the ATR vol module; `exitOnOppositeSignal` does not change this strategy’s code path.

---

## 6. Stop loss logic

- **Initial stop (long):** `entryPrice - ATR(14) × 1.5`
- **Initial stop (short):** `entryPrice + ATR(14) × 1.5`
- Stop is checked on **bar low/high** (intrabar touch).
- After trailing activates, stop can **only improve** (ratchet), never widen.

Typical stop distance ≈ 1.5 ATR ≈ **1–2% of price** on SOL 1m, which pairs with ~1.5% risk sizing to produce **~55–57 SOL qty** per trade (~$5k notional per side).

---

## 7. Trailing logic

| Setting | Value | Behavior |
|---------|------:|----------|
| `trailStart` | 0.1% | Very early activation — trail engages after a small favorable move |
| `trailGap` | 0.5% | Stop trails 0.5% behind **close** (wide vs tight scalps) |

- **Long:** candidate stop = `close × (1 - 0.005)`; keep if higher than current stop.
- **Short:** candidate stop = `close × (1 + 0.005)`; keep if lower than current stop.
- Exit labeled `trail` when stop was trailing at hit (37 trades).

Wide trail + early start lets winners run (several large `take_profit` and `trail` wins) while many losers still exit quickly on initial stop.

---

## 8. Take profit / break-even

| Feature | Setting | Used? |
|---------|--------:|-------|
| Take profit | **0.8%** | **Yes** — 25 exits at `take_profit` (best winners often TP) |
| Break-even | **0%** | **No** |

Take profit at 0.8% is relatively **tight** on 1m SOL — it crystallizes gains before reversals and adds trade count, which **increases volume** and helps gross PnL overcome fees when win size is sufficient.

---

## 9. Filters

| Filter | Setting | Effect |
|--------|---------|--------|
| **Volume filter** | `minVolumeMult = 0` | **Off** — no requirement vs volume SMA |
| **Volatility filter** | `minAtrFilter = 0` | **Off** — trades even in low ATR |
| **Cooldown** | **2 candles** | 2 minutes pause after each exit |
| **Max trades / day** | **40** | Blocks new entries after 40 opens per UTC day |
| **Min move vs fees** | `minMoveVsFeeMult = 0` | **Off** — no extra gate on stop distance vs fees |
| **EMA distance** | 0 | **Off** |

Promotion to Stage 2 favored **more trades** over strict fee gates; efficiency phase set `minVolumeMult = 0` and capped daily frequency at 40 instead of unlimited churn.

---

## 10. Risk / position size logic

```
riskAmount = balance × (riskPct / 100)     // 1.5% of equity
qty = riskAmount / |entryPrice - stopLoss|
```

If required margin `qty × entry / leverage` exceeds balance:

```
qty = (balance × leverage) / entryPrice
```

With ~$1,000 balance, ~1.5% risk, ~1.5 ATR stop, **qty ≈ 55–57 SOL** per trade → **totalVolume ≈ 8,691** over 140 trades (sum of qty per round-trip leg counted as volume metric in backtester).

Fees ≈ **$559** on **$8691** volume → **fees/volume ≈ 6.4%** (ratio of fee dollars to qty sum, not bps of notional).

---

## 11. Why this strategy produced high volume

1. **Frequent qualifying breakouts** — 1.5× ATR expansion on 1m with 20-bar lookback fires often in active SOL periods.
2. **140 trades in ~7 days** (~14.2 trades/day) — well above EMA-style crossover systems on the same window.
3. **Moderate position size** — ~55+ SOL per trade accumulates qty metric quickly.
4. **Short cooldown (2)** — re-enters soon after exits.
5. **Take profit at 0.8%** — closes and frees capital for new signals.
6. **Many small stop-outs** — losing trades still add volume (78 stop exits, often 1–3 bars).
7. **maxTradesPerDay = 40** — allows heavy activity without unlimited overtrading.

---

## 12. Why it avoided fee death better than EMA crossover

| Factor | ATR volatility breakout (this) | EMA crossover + ATR trail |
|--------|----------------------------------|---------------------------|
| Stage 1 screening | **Promoted** (volume + near breakeven potential) | **Rejected** (`maxDrawdownPct > 40`) |
| Entry style | Volatility expansion — fewer false crosses in chop | EMA cross — many whipsaws in 1m noise |
| Trade count | **140** (enough gross to pay fees) | Typically far fewer on same window |
| Win profile | Few large **TP** hits (+$50–73 net) pay fee bill | Often few trades; fees dominate small edges |
| Profit factor | **1.31** | Screening failed before deep optimize |
| Net vs fees | Gross wins **> total fees** (~$849 gross vs $559 fees implied) | Higher DD / poorer fee efficiency in screen |

EMA cross on 1m SOL tends to **lag and re-enter late**, producing clustered losses in chop while still paying round-trip fees. This breakout system **pays fees aggressively** but pairs that with:

- **Positive gross** on the window (PF &gt; 1),
- **Controlled DD** (14.3%),
- **TP/trail captures** on real moves,

so **net PnL stays positive** despite high fee drag — the definition of “high volume near breakeven” done well.

---

## 13. Metrics (from `bestHighVolumeNearBreakeven`)

| Metric | Value |
|--------|------:|
| **totalVolume** | 8,691.01 SOL (qty sum) |
| **netPnL** | +290.46 USDC |
| **netPnLPct** | +29.05% (on 1,000 start) |
| **totalFees** | 559.16 USDC |
| **tradesCount** | 140 |
| **winRate** | **25.0%** (35 wins / 105 losses) |
| **profitFactor** | 1.31 |
| **maxDrawdownPct** | 14.29% |
| **tradesPerDay** | 14.22 |
| **feesToVolumeRatio** | 0.0643 |
| **highVolumeBreakevenScore** | 557.60 |
| **passedStrictFilters** | true (trades≥50, volume≥1000, DD≤35%, PF≥0.85) |

---

## 14. Trade examples

*Times UTC from trade file `ATR_VOLATILITY_BREAKOUT_8680a0fcdb1b.json`*

### First 5 trades (chronological)

| # | Dir | Entry time | Entry | Exit | Qty | Net PnL | Exit |
|---|-----|------------|------:|-----:|----:|--------:|------|
| 1 | Short | 2026-05-08 02:03 | 87.84 | 87.89 | 56.92 | **-6.31** | stop |
| 2 | Short | 2026-05-08 02:28 | 87.82 | 87.74 | 56.58 | **+1.28** | stop |
| 3 | Short | 2026-05-08 04:44 | 88.05 | 88.03 | 56.50 | **-2.26** | stop |
| 4 | Long | 2026-05-08 08:48 | 88.57 | 88.47 | 56.04 | **-8.92** | stop |
| 5 | Long | 2026-05-08 14:06 | 88.73 | 88.89 | 55.44 | **+5.61** | trail |

### Best 5 trades (by net PnL)

| # | Dir | Entry time | Net PnL | Gross | Fees | Exit |
|---|-----|------------|--------:|------:|-----:|------|
| 1 | Short | 2026-05-15 13:32 | **+72.76** | +77.46 | 4.70 | take_profit |
| 2 | Short | 2026-05-10 20:45 | **+59.24** | +62.54 | 3.30 | take_profit |
| 3 | Short | 2026-05-13 12:32 | **+59.12** | +62.90 | 3.79 | take_profit |
| 4 | Long | 2026-05-15 06:31 | **+51.29** | +55.68 | 4.39 | take_profit |
| 5 | Long | 2026-05-14 14:46 | **+51.05** | +55.19 | 4.14 | take_profit |

### Worst 5 trades (by net PnL)

| # | Dir | Entry time | Net PnL | Gross | Fees | Exit |
|---|-----|------------|--------:|------:|-----:|------|
| 1 | Short | 2026-05-13 21:11 | **-21.79** | -17.62 | 4.17 | trail |
| 2 | Short | 2026-05-08 21:11 | **-17.77** | -14.06 | 3.71 | stop |
| 3 | Long | 2026-05-10 19:25 | **-17.23** | -13.99 | 3.24 | stop |
| 4 | Short | 2026-05-09 09:17 | **-16.34** | -12.72 | 3.62 | stop |
| 5 | Short | 2026-05-14 16:52 | **-16.15** | -11.69 | 4.47 | trail |

**Pattern:** Winners are mostly **take_profit** on strong impulse legs; losers are **stop** or **trail** with gross loss only slightly larger than fees — classic low win-rate, positive expectancy profile.

---

## 15. Weak points

### When it loses

- **False breakouts** — price pokes beyond range + ATR then reverses → stop within 1–3 bars (common).
- **Chop / low expansion** — many signals with little follow-through; fees eat small gross moves.
- **Trail on marginal winners** — trail can turn small open profit into loss (see worst #1, #5).
- **Low win rate (25%)** — long losing streaks are psychologically and statistically likely.
- **Short bias in sample** — several largest wins and losses are shorts; regime shift can hurt.

### Dangerous market conditions

- **Tight ranging markets** — repeated stop-outs both sides.
- **Sudden volatility spikes against position** — stop at 1.5 ATR may slip on fast wicks (backtest uses bar high/low).
- **Fee regime change** — strategy is **fee-sensitive**; higher taker fees shrink edge quickly.
- **News / gap bars** — 1m close logic may fill next open far from signal stop.

---

## 16. Next testing steps

1. **Full 30 days** — Re-run with `BACKTEST_MAX_CANDLES=0` or full cached 30d file; verify volume and netPnL hold with trades≥50.
2. **Different SOL periods** — Bull-only, bear-only, high-ATR weeks; check if breakoutMult / lookback need regime switching.
3. **Maker/taker fee variants** — Re-score with 0.01% maker / 0.035% taker vs all-taker; target netPnL ≥ 0 at realistic O1 fee tier.
4. **Paper live** — Deploy on O1 paper with `nextOpen` fills, log slippage vs backtest stops.
5. **Tune entry defaults** — Explicitly optimize `lookback`, `breakoutMult`, `stopMult` in ENTRY phase (currently implicit 20 / 1.5 / 1.5).
6. **Raise win rate or reduce stops** — Test slightly higher `breakoutMult` (fewer but cleaner trades) vs lower (more volume, more fee risk).

---

## Artifacts

- **Trades:** `data/results/trades/ATR_VOLATILITY_BREAKOUT_8680a0fcdb1b.json`
- **Equity:** `data/results/equity/ATR_VOLATILITY_BREAKOUT_8680a0fcdb1b.csv`
- **Full rankings:** `data/results/strategy-discovery-final.json` → `rankings.topHighVolumeNearBreakeven` (top 50)
