# EMA_ATR_WINNER_LEGACY — Logic Audit

Source strategy: `src/discovery/strategies/emaCrossoverAtr.ts` (same logic as this family port).
Winner params: `max-monthly-volume-10dd-search-final.json` → EMA_CROSSOVER_ATR rank #1 under ≤10% DD.

## Entry

- **Signal bar:** closed candle index `i` (loop from `i=1`).
- **Long:** `emaShort[i-1] <= emaLong[i-1]` AND `emaShort[i] > emaLong[i]` (bullish cross).
- **Short:** `emaShort[i-1] >= emaLong[i-1]` AND `emaShort[i] < emaLong[i]` (bearish cross).
- **Initial stop:** long `close[i] - ATR[i]*atrMult`; short `close[i] + ATR[i]*atrMult` (atrMult=0.8).
- **Filter:** `passMinMoveVsFee` — stop distance ≥ `close * feeRate * minMoveVsFeeMult` (mult=2).
- **Filter:** `passVolatilityFilter` — inactive when `minAtrFilter=0` (winner).
- **NOT used despite JSON:** minVolumeMult, minAtrPct, minEmaDistancePct, exitOnOppositeSignal.
- **Execution:** `nextOpen` — signal on bar `i`, fill at bar `i+1` open; stop frozen from signal bar.

## Exit (simulator `manageExits`, not in strategy file)

- **Take profit:** off (`takeProfitPct=0`).
- **Max hold:** off (`maxHoldCandles=0`).
- **Opposite signal exit:** not implemented for this strategy.
- **Break-even:** when unrealized profit ≥ `breakEvenPct` (0.3%), stop → entry price.
- **Trailing:** when profit ≥ `trailStart` (0.1%), trail stop ratchets `trailGap` (0.4%) behind close.
- **Stop loss:** intrabar — long if `low <= stopLoss`; short if `high >= stopLoss` (fill at stop).

## Risk sizing

- `qty = (balance * riskPct/100) / |entry - stop|`, capped by leverage (riskPct=0.5%, leverage=3).

## Cooldown

- After exit: no entries for `cooldownCandles` (3) bars.

## Lookahead / indexing review

| Check | Verdict |
|-------|---------|
| EMA cross uses i-1 and i only | OK — closed-bar signal |
| ATR at i for stop from close[i] | OK — same bar as signal |
| nextOpen entry | OK — no fill on signal close |
| Exits before entries on same bar (`runBar`) | OK |
| Future EMA values | None |

## Original O1 result context

- Optimized for **max notional volume** under **≤10% DD**, ~30d **SOLUSD O1** cache, not 12m Binance.
- Reported: ~156 trades, -8.55% net, 9.6% DD, PF 0.82 (selection ≠ profitability).

## Winner parameters

```json
{
  "atrPeriod": 14,
  "atrMult": 0.8,
  "trailStart": 0.1,
  "trailGap": 0.4,
  "takeProfitPct": 0,
  "breakEvenPct": 0.3,
  "maxHoldCandles": 0,
  "exitOnOppositeSignal": 1,
  "cooldownCandles": 3,
  "minAtrFilter": 0,
  "minEmaDistancePct": 0,
  "minMoveVsFeeMult": 2,
  "minVolumeMult": 1.2,
  "maxTradesPerDay": 999,
  "emaShort": 12,
  "emaLong": 21,
  "riskPct": 0.5,
  "leverage": 3
}
```

### Inactive in code

- `minVolumeMult`
- `minAtrPct`
- `exitOnOppositeSignal`
- `minEmaDistancePct`