# Adaptive Regime RANGE Param Search

Generated: 2026-06-01T06:12:49.041Z
Source: **BINANCE_FUTURES**
Symbol/timeframe: **SOLUSDT 15m**
Period: 2025-11-02T00:00:00.000Z -> 2026-05-01T00:00:00.000Z
Search size: stage1=6720, stage2=12150, unique=18870

## Data quality

```
## SOLUSDT

- Source: **BINANCE_FUTURES**

- Cache: `/workspace/data/cache/binance_futures/SOLUSDT_1m_6m.json`
- Candles: **259,200** (~180 days)
- Coverage: **100%** (expected ~259,201)
- Gaps: 0 (largest 0 min, ~0 missing bars)
- Duplicates: 0
- Reliable for optimization: **YES**
```

## Ranking method

The stability score rewards positive net PnL, PF > 1, better average/worst monthly PnL, more profitable months, sufficient trade count, and low drawdown. It penalizes losing months, monthly PnL standard deviation, overtrading, too few trades, and cases where fees consume too much gross profit.

## Top 30 results

| Rank | Score | Net | Net % | PF | DD % | Trades | Tr/day | Fees/Gross+ % | Avg mo % | Worst mo % | +mo/-mo | StdDev | Params |
|-----:|------:|----:|------:|---:|-----:|-------:|-------:|--------------:|---------:|-----------:|--------:|-------:|--------|
| 1 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.2, rangeBandBufferPct=0, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 2 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.2, rangeBandBufferPct=0, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 3 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.2, rangeBandBufferPct=0.05, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 4 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.2, rangeBandBufferPct=0.05, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 5 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.2, rangeBandBufferPct=0.1, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 6 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.2, rangeBandBufferPct=0.1, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 7 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.2, rangeBandBufferPct=0.15, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 8 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.2, rangeBandBufferPct=0.15, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 9 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.3, rangeBandBufferPct=0, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 10 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.3, rangeBandBufferPct=0, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 11 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.3, rangeBandBufferPct=0.05, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 12 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.3, rangeBandBufferPct=0.05, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 13 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.3, rangeBandBufferPct=0.1, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 14 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.3, rangeBandBufferPct=0.1, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 15 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.3, rangeBandBufferPct=0.15, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 16 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.3, rangeBandBufferPct=0.15, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 17 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.4, rangeBandBufferPct=0, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 18 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.4, rangeBandBufferPct=0, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 19 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.4, rangeBandBufferPct=0.05, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 20 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.4, rangeBandBufferPct=0.05, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 21 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.4, rangeBandBufferPct=0.1, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 22 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.4, rangeBandBufferPct=0.1, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 23 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.4, rangeBandBufferPct=0.15, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 24 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.4, rangeBandBufferPct=0.15, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 25 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.5, rangeBandBufferPct=0, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 26 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.5, rangeBandBufferPct=0, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 27 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.5, rangeBandBufferPct=0.05, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 28 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.5, rangeBandBufferPct=0.05, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 29 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.5, rangeBandBufferPct=0.1, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |
| 30 | -4.4 | 0.70 | 0.70 | 7.89 | 0.10 | 5 | 0.028 | 34.48 | 0.12 | -0.10 | 3/1 | 0.20 | adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.5, rangeBandBufferPct=0.1, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6 |

## Monthly stability for top 30

### #1 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.2, rangeBandBufferPct=0, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #2 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.2, rangeBandBufferPct=0, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #3 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.2, rangeBandBufferPct=0.05, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #4 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.2, rangeBandBufferPct=0.05, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #5 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.2, rangeBandBufferPct=0.1, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #6 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.2, rangeBandBufferPct=0.1, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #7 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.2, rangeBandBufferPct=0.15, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #8 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.2, rangeBandBufferPct=0.15, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #9 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.3, rangeBandBufferPct=0, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #10 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.3, rangeBandBufferPct=0, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #11 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.3, rangeBandBufferPct=0.05, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #12 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.3, rangeBandBufferPct=0.05, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #13 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.3, rangeBandBufferPct=0.1, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #14 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.3, rangeBandBufferPct=0.1, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #15 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.3, rangeBandBufferPct=0.15, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #16 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.3, rangeBandBufferPct=0.15, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #17 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.4, rangeBandBufferPct=0, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #18 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.4, rangeBandBufferPct=0, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #19 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.4, rangeBandBufferPct=0.05, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #20 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.4, rangeBandBufferPct=0.05, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #21 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.4, rangeBandBufferPct=0.1, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #22 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.4, rangeBandBufferPct=0.1, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #23 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.4, rangeBandBufferPct=0.15, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #24 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.4, rangeBandBufferPct=0.15, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #25 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.5, rangeBandBufferPct=0, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #26 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.5, rangeBandBufferPct=0, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #27 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.5, rangeBandBufferPct=0.05, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #28 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.5, rangeBandBufferPct=0.05, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #29 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=70, rangeVwapDistPct=0.1, rangeTpPct=0.5, rangeBandBufferPct=0.1, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

### #30 score=-4.4 net=0.70% pf=7.89

Params: `adxRangeMax=16, rsiOversold=30, rsiOverbought=74, rangeVwapDistPct=0.1, rangeTpPct=0.5, rangeBandBufferPct=0.1, atrMult=0.8, riskMultRange=0.5, minMoveVsFeeMult=1, minVolumeMult=0, cooldownCandles=4, maxTradesPerDay=6`

| Month | Net | Net % | Gross | Fees | Trades | Win % | PF | DD % | Full month |
|-------|----:|------:|------:|-----:|-------:|------:|---:|-----:|:----------:|
| 2025-11 | 0.03 | 0.03 | 0.10 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2025-12 | 0.27 | 0.27 | 0.44 | 0.16 | 2 | 100.00 | 999.00 | 0.00 | yes |
| 2026-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |
| 2026-02 | 0.49 | 0.49 | 0.55 | 0.06 | 1 | 100.00 | 999.00 | 0.00 | yes |
| 2026-03 | -0.10 | -0.10 | -0.01 | 0.09 | 1 | 0.00 | 0.00 | 0.10 | yes |
| 2026-04 | 0.00 | 0.00 | 0.00 | 0.00 | 0 | 0.00 | 0.00 | 0.00 | yes |

## Conclusion

No range-only parameter set clears the stability bar. Based on this search, keeping RANGE disabled is safer than enabling these candidates live.

Best monthly shorthand: 2025-11: 0.03%/1tr; 2025-12: 0.27%/2tr; 2026-01: 0.00%/0tr; 2026-02: 0.49%/1tr; 2026-03: -0.10%/1tr; 2026-04: 0.00%/0tr
