# Best Autonomous Search Candidate Export

Exported: 2026-05-17T16:41:23.853Z
Partial snapshot: 2026-05-17T16:41:21.437Z (running, 67700/100000 variants)

## Primary best (overall score)

**Strategy:** BOLLINGER_MEAN_REVERSION
**Target achieved:** false
**Why not achieved:** averageTradesPerDay=1.983101 < 2; netPnL=-5.322185 < 0; profitFactor=0.76884 < 0.9

```
[CHECK] failed: averageTradesPerDay=1.983101 < 2, netPnL=-5.322185 < 0, profitFactor=0.76884 < 0.9
```

### Params
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

### Key metrics
| Metric | Value |
|--------|-------|
| Avg weekly notional (USDC) | 14,518.788 |
| Total notional (USDC) | 58,075.153 |
| Net PnL | -5.322185 USDC (-5.322185%) |
| Gross PnL | 15.004118 |
| Total fees | 20.326304 |
| Profit factor | 0.76884 |
| Max drawdown | 6.86263% |
| Win rate | 44.067797% |
| Trades | 59 (1.98/day) |
| Stable weeks | 3 profitable/near-breakeven |

### Failed requirements
- averageTradesPerDay=1.983101 < 2
- netPnL=-5.322185 < 0
- profitFactor=0.76884 < 0.9

### Weekly breakdown
- **W1** 2026-04-17 → 2026-04-24: trades=59 notional=58075 net=-5.32 fees=20.33 dd=6.9%
- **W2** 2026-04-24 → 2026-05-01: trades=0 notional=0 net=0.00 fees=0.00 dd=0.0%
- **W3** 2026-05-01 → 2026-05-08: trades=0 notional=0 net=0.00 fees=0.00 dd=0.0%
- **W4** 2026-05-08 → 2026-05-15: trades=0 notional=0 net=0.00 fees=0.00 dd=0.0%
- **W5** 2026-05-15 → 2026-05-17: trades=0 notional=0 net=0.00 fees=0.00 dd=0.0%

### Artifacts
- Trades: `C:\Users\vygov\OneDrive\Desktop\aiBacktesting\data\results\trades\BOLLINGER_MEAN_REVERSION_e9f79aa53f83.json`
- Equity: `C:\Users\vygov\OneDrive\Desktop\aiBacktesting\data\results\equity\BOLLINGER_MEAN_REVERSION_e9f79aa53f83.csv`

## BOLLINGER high-weekly-volume variant (topHighVolume #1)

**Note:** This variant drives `progress.bestWeeklyVolume=105216` but has poor PnL.
**Net PnL:** -99.78969 | **PF:** 0.472086

```
[CHECK] failed: stableWeeks=0/4 < 3, netPnL=-99.78969 < 0, maxDrawdownPct=99.792553 > 35, maxWeeklyDrawdownPct=99.698077 > 25, profitFactor=0.472086 < 0.9, feesVsGrossProfit=3.204824 > 2 (fees=145.049397 gross=45.259707)
```

Failed: stableWeeks=0/4 < 3; netPnL=-99.78969 < 0; maxDrawdownPct=99.792553 > 35; maxWeeklyDrawdownPct=99.698077 > 25; profitFactor=0.472086 < 0.9; feesVsGrossProfit=3.204824 > 2 (fees=145.049397 gross=45.259707)

## Full data

See `C:\Users\vygov\OneDrive\Desktop\aiBacktesting\data\results\best-autonomous-candidate-full.json` for complete metrics, daily breakdown, best/worst trades, and targetCheck.
