# EMA_CROSSOVER_ATR — Live O1 Bot Implementation Spec

Generated: 2026-05-17T18:36:49.286Z

Source: `rankings.topMaxMonthlyVolumeUnder10DD[0]` in `max-monthly-volume-10dd-search-final.json` (2026-05-17T17:45:19.581Z)

## 1. Strategy overview

EMA crossover with ATR-based initial stop, break-even, and trailing stop.
- **Style:** Trend-following on EMA(12)/EMA(21) cross; exits via stop/trail only (no opposite-signal exit in code)
- **Timeframe:** 1m candles
- **Position:** One position at a time
- **Objective:** Maximize notional volume under ≤10% max drawdown (search constraint; not enforced in-strategy)

## 2. Exact parameters

```json
{
  "atrPeriod": 14,
  "atrMult": 0.8,
  "trailStart": 0.1,
  "trailGap": 0.4,
  "takeProfitPct": 0,
  "breakEvenPct": 0.3,
  "maxHoldCandles": 0,
  "exitOnOppositeSignal": 0,
  "cooldownCandles": 3,
  "minAtrFilter": 0,
  "minEmaDistancePct": 0,
  "minMoveVsFeeMult": 2,
  "minVolumeMult": 1.2,
  "maxTradesPerDay": 999,
  "emaShort": 12,
  "emaLong": 21,
  "riskPct": 0.5,
  "leverage": 3,
  "minAtrPct": 0
}
```

### Parameters present in search JSON but NOT used by EMA_CROSSOVER_ATR code

- **minVolumeMult** = 1.2 — Not referenced in src/discovery/strategies/emaCrossoverAtr.ts
- **minAtrPct** = 0 — Not referenced in src/discovery/strategies/emaCrossoverAtr.ts
- **exitOnOppositeSignal** = 0 — Not referenced in src/discovery/strategies/emaCrossoverAtr.ts
- **minEmaDistancePct** = 0 — Not referenced in src/discovery/strategies/emaCrossoverAtr.ts

## 3. Required indicators

- EMA(12) on close
- EMA(21) on close
- ATR(14) on H/L/C

Use `technicalindicators` (or equivalent) with NaN padding for warmup bars.

## 4. Candle timeframe

**1m** — same as backtest (`BACKTEST_TIMEFRAME=1m`).

## 5. Entry logic (step-by-step)

1. Skip if position open
2. passVolatilityFilter: minAtrFilter must be >0 to apply (winner=0 → always pass)
3. Read EMA short/long at i-1 and i; read ATR at i
4. Detect bullish or bearish crossover (see long/short conditions)
5. Compute initial stop = close ± ATR*atrMult
6. passMinMoveVsFee: |entry-stop| >= close * feeRate * minMoveVsFeeMult
7. Queue or open position via signal()

**Execution mode:** nextOpen — Signal on bar i close; open at bar i+1 open with stop frozen from signal bar

## 6. Long entry conditions

- **Crossover:** `emaShort[i-1] <= emaLong[i-1] AND emaShort[i] > emaLong[i]`
- **Initial stop:** `stop = close[i] - atr[i] * atrMult`
- **Filters:**
  - Finite emaShort[i-1], emaShort[i], atr[i]
  - passMinMoveVsFee(close, stop)
  - canEnter: index >= cooldownUntil; maxTradesPerDay if <999
  - No open position

## 7. Short entry conditions

- **Crossover:** `emaShort[i-1] >= emaLong[i-1] AND emaShort[i] < emaLong[i]`
- **Initial stop:** `stop = close[i] + atr[i] * atrMult`

## 8. Stop loss calculation

- Initial long: `entryReference - atr[signalBar] * atrMult (0.8)`
- Initial short: `entryReference + atr[signalBar] * atrMult`
- Intrabar long: Exit if candle.low <= stopLoss (fill at stopLoss price)
- Intrabar short: Exit if candle.high >= stopLoss (fill at stopLoss price)

## 9. Position size calculation

```
qty = (balance * riskPct/100) / |entry - stop|; cap: (qty*entry)/leverage <= balance → qty = balance*leverage/entry
```

- riskPct = 0.5%
- leverage cap = 3x

## 10. Risk logic

- Risk per trade: **0.5%** of balance to initial stop
- Search constraint: 10% (selection criterion, not enforced in-strategy)
- Search constraint: 90 USDC on 100 start

## 11. Leverage logic

Does not multiply PnL; only sizing cap in calcQty. Param leverage = **3**.

## 12. Break-even logic

When unrealized profit ≥ **0.3%**, move stop to entry.

## 13. Trailing stop logic

- Activate when profit ≥ **0.1%**
- Trail gap **0.4%** behind close (ratchet only)

## 14. Exit logic

- Take profit: off
- Max hold: off
- Opposite signal exit: **no** (not implemented for this strategy)
- Stop / trail intrabar as in simulator

## 15. Max trades per day

Param `maxTradesPerDay=999` → **Unlimited (999 disables cap in canEnter)**.

## 16. Cooldown / re-entry

After each exit, block entries for **3** completed bars.

## 17. Fee assumptions

- Fee rate: **0.00035** per side (3.5 bps)
- `BACKTEST_FEE_RATE=0.00035` in search

## 18. State needed in live bot

- **balance:** USDC wallet / account equity for sizing
- **position:** null | { direction, entryTime, entryPrice, qty, stopLoss, trailingActive, breakEvenActive, entryFee }
- **pendingSignal:** null | { direction, signalBarTime, stopLoss } for next-open execution
- **cooldownUntilBarIndex:** integer bar index or timestamp of allowed next entry
- **tradesTodayByUtcDate:** Map<YYYY-MM-DD, count> if enforcing maxTradesPerDay < 999
- **lastProcessedCandleOpenTime:** for incremental 1m feed
- **diagnostics:** counters optional: signals, crossovers, skippedByFilter, etc.

## 19. Cache / persisted data

- **rollingCandles:** At least max(emaLong, atrPeriod) + 2 closed 1m bars for SOLUSD
- **computedSeries:** EMA(12), EMA(21), ATR(14) aligned to candle index
- **persistOptional:** Last 500-1000 1m OHLCV for restart; last indicator values; open position snapshot
- **doNotPersist:** Full trade history required only for analytics

## 20. Pseudocode

```text
onEachClosedBar(i):
  runBar()  // fill pending at open, then manageExits
  if position: return
  if i < cooldownUntil: return
  if !passVolatilityFilter(): return  // minAtrFilter=0 → pass
  ps, pl = emaShort[i-1], emaLong[i-1]
  cs, cl = emaShort[i], emaLong[i]
  a = atr[i]
  if not finite(ps,cs,a): return
  bull = ps <= pl and cs > cl
  bear = ps >= pl and cs < cl
  if not bull and not bear: return
  stop = close - a*atrMult if bull else close + a*atrMult
  if abs(close-stop) < close*feeRate*minMoveVsFeeMult: return
  signal(direction=bull?long:short, stop)
  // nextOpen: pending fills at bar i+1 open

manageExits on each bar while position:
  if maxHold exceeded: close at close
  if takeProfitPct hit: close at close
  if profit% >= breakEvenPct: stop = entry
  if profit% >= trailStart: trailingActive = true
  if trailingActive: ratchet stop by trailGap from close
  if long and low <= stop: exit at stop
  if short and high >= stop: exit at stop
  on close: cooldownUntil = i + cooldownCandles
```

## 21. TypeScript interfaces

```json
{
  "EmaCrossoverAtrParams": {
    "emaShort": "number",
    "emaLong": "number",
    "atrPeriod": "number",
    "atrMult": "number",
    "trailStart": "number",
    "trailGap": "number",
    "takeProfitPct": "number",
    "breakEvenPct": "number",
    "maxHoldCandles": "number",
    "cooldownCandles": "number",
    "minAtrFilter": "number",
    "minMoveVsFeeMult": "number",
    "maxTradesPerDay": "number",
    "riskPct": "number",
    "leverage": "number"
  },
  "LivePosition": {
    "direction": "'long' | 'short'",
    "entryTime": "number",
    "entryPrice": "number",
    "qty": "number",
    "stopLoss": "number",
    "trailingActive": "boolean",
    "breakEvenActive": "boolean"
  },
  "PendingSignal": {
    "direction": "'long' | 'short'",
    "signalIndex": "number",
    "stopLoss": "number"
  },
  "BotState": {
    "balance": "number",
    "position": "LivePosition | null",
    "pending": "PendingSignal | null",
    "cooldownUntilIndex": "number",
    "tradesToday": "Map<string, number>"
  }
}
```

## 22. Edge cases

- EMA/ATR NaN during warmup → no signal
- Signal on last bar with nextOpen → no fill (no i+1)
- stop distance zero → skip entry (skippedInvalidStop)
- qty capped by leverage may reduce risk below riskPct target
- Same-bar: manageExits runs after pending fill on entry bar
- Break-even and trailing both mutate stopLoss; stop check uses final stop
- UTC day boundary for tradesToday uses candle.openTime ISO date slice

## 23. Safety checks

- Reject entry if qty <= 0 or stop invalid
- Enforce max leverage notional cap before send order
- Live: hard stop max account drawdown / daily loss outside strategy
- Validate candle continuity (no duplicate/missing 1m timestamps)
- Do not double-enter while position or pending exists
- Round qty/price per O1 market lot size rules

## 24. Debug logs

- `BAR {time} emaS emaL atr close`
- `CROSSOVER bull|bear at {time}`
- `SIGNAL {dir} stop={stop} moveVsFee={ok}`
- `ENTRY {dir} price qty stop fee`
- `BE_ACTIVATED stop->entry`
- `TRAIL_ON / TRAIL_UPDATE stop={stop}`
- `EXIT {reason} price gross net fees balance`
- `SKIP cooldown|maxTrades|margin|invalidStop`

## 25. Verify live bot matches backtest

1. Replay same 30d SOLUSD_m2_1m.csv with entryMode=nextOpen, feeRate=0.00035, balance=100
2. Run emaCrossoverAtr with exact params; compare tradesCount, netPnL, maxDrawdownPct within tolerance
3. Match first/last 5 trades: direction, entry/exit times, prices, qty, exitReason
4. Compare weekly notional volume buckets
5. Shadow mode: log signals live without orders for 24h then replay

**Tolerances:**

```json
{
  "tradesCount": 0,
  "netPnLUsdc": 0.05,
  "maxDrawdownPct": 0.1,
  "totalNotionalUsdc": 50
}
```

## Validation metrics (30d search window)

| Metric | Value |
|--------|------:|
| Monthly notional volume (USDC) | 88431.41 |
| Daily notional volume (avg USDC) | 2947.71 |
| Trades count | 156 |
| Trades / day | 5.25 |
| Max drawdown % | 9.60 |
| End balance (USDC) | 91.44 |
| Net PnL (USDC) | -8.56 |
| Total fees (USDC) | 30.66 |
| Win rate % | 16.67 |
| Profit factor | 0.8239 |

## Weekly breakdown

| Week | Trades | Volume | Net PnL | Fees | Max DD % |
|------|-------:|-------:|--------:|-----:|---------:|
| 1 | 46 | 25652 | -9.09 | 8.98 | 9.60 |
| 2 | 13 | 7431 | 6.54 | 2.60 | 9.05 |
| 3 | 37 | 21296 | -0.54 | 7.45 | 7.75 |
| 4 | 58 | 32122 | -4.53 | 11.24 | 8.83 |
| 5 | 2 | 1105 | -0.95 | 0.39 | 8.56 |

## Re-validation on cached candles (explain-ema-winner)

| Metric | Search | Revalidated |
|--------|-------:|------------:|
| Trades | 156 | 155 |
| Net PnL | -8.56 | -8.06 |
| Max DD % | 9.60 | 9.11 |
| Monthly volume | 88431 | 88448 |

## Source files

- `src/discovery/strategies/emaCrossoverAtr.ts`
- `src/discovery/simulator.ts`
- `src/discovery/strategies/strategyCommon.ts`