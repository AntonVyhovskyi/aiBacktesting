# Stable Profit 6-Month Search Report
Generated: 2026-05-20T17:27:50.392Z
Search completed: 2026-05-20T17:27:50.377Z
Candle cache: `C:\Users\vygov\OneDrive\Desktop\aiBacktesting\data\cache\SOLUSD_market2_1m_6m.json`
## Target
Find strategies with **≥+10% net PnL in every full calendar month** over 6 months, with low drawdown, profit factor ≥1.2, fees included, and no single-month dominance.
**Target achieved:** NO
## Best candidate
**Strategy:** `RSI_ADX_TREND`
### Parameters
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
  "maxTradesPerDay": 20,
  "riskPct": 0.5,
  "leverage": 3
}
```
### Full 6-month metrics
| Metric | Value |
|--------|------:|
| Net PnL | 0.34 USDC (0.34%) |
| Gross PnL | 4.19 USDC |
| Total fees | 3.85 USDC |
| Trades | 24 |
| Win rate | 50.0% |
| Profit factor | 1.087 |
| Max drawdown | 2.56% |
| Avg monthly PnL % | 0.06% |
| Worst month PnL % | 0.00% |
| Best month PnL % | 0.34% |
| Profitable months | 1 |
| Months ≥10% | 0 |
| One-month dominance | 100.0% |
### Monthly results
| Month | Net PnL | Net % | Trades | Fees | Max DD % | PF |
|-------|--------:|------:|-------:|-----:|---------:|---:|
| 2025-12 | 0.34 | 0.34% | 24 | 3.85 | 2.56 | 1.09 |
| 2026-01 | 0.00 | 0.00% | 0 | 0.00 | 0.00 | 0.00 |
| 2026-02 | 0.00 | 0.00% | 0 | 0.00 | 0.00 | 0.00 |
| 2026-03 | 0.00 | 0.00% | 0 | 0.00 | 0.00 | 0.00 |
| 2026-04 | 0.00 | 0.00% | 0 | 0.00 | 0.00 | 0.00 |
| 2026-05 | 0.00 | 0.00% | 0 | 0.00 | 0.00 | 0.00 |
### Requirement checklist
| Requirement | Pass | Actual |
|-------------|:----:|--------|
| Full calendar months | ✗ | 4 |
| All months profitable | ✗ | 1/4 |
| Each month net PnL % | ✗ | worst=0% best=0.341021% |
| Full-period max drawdown | ✓ | 2.555489% |
| Per-month max drawdown | ✓ | 0% max |
| Profit factor | ✗ | 1.087364 |
| Trades per month | ✗ | min=0 |
| One-month profit dominance | ✗ | 100% |
### Why it failed
- full_months_count: 4 (need >= 6)
- all_months_profitable: 1/4 (need 6/6)
- monthly_pnl_pct: worst=0% best=0.341021% (need >= 10% every month)
- profit_factor: 1.087364 (need >= 1.2)
- trades_per_month: min=0 (need >= 30 each full month)
- one_month_dominance: 100% (need <= 40%)
## Risks
- Past 6-month stability does not guarantee future +10%/month.
- High trade counts increase fee sensitivity on O1.
- Calendar-month boundaries can hide intra-month drawdown clusters.
- Parameter neighborhoods were only lightly checked unless target was achieved.
## Paper trading suitability
**Not recommended for paper trading yet** — fails one or more hard monthly consistency requirements.
Treat as research baseline only.
## What to improve next
1. Tighten entries (higher `minMoveVsFeeMult`, volume/ADX filters) to raise win rate.
2. Reduce `maxTradesPerDay` if fees dominate.
3. Add regime filter (skip low-vol or trending chop months).
4. Walk-forward on months 1–4 train / 5–6 validate.
5. Re-run search with `STABLE_PROFIT_DISCOVERY_MODE=full` if budget allows.
## Artifacts
- Tested variants: 14978 (8.7 min)
- Full JSON: `data/results/stable-profit-6m-search-final.json`