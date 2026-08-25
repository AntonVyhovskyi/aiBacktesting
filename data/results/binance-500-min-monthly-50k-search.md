# Binance 500 Balance / Min Monthly 50k Notional Search

Generated: 2026-05-01T00:00:00.000Z

## Target

- Start balance: **500 USDC**
- Every full month notional: **>= 50,000 USDC** (not only average)
- Max monthly drawdown: **<= 5%**
- Full-period max drawdown: **<= 5%**
- Net PnL >= 0 and PF >= 1

## Verdict

**No candidate passed all target filters.**

On this 6-month SOLUSDT window the same 5760-variant grid produces **zero PASS** when every full month must print ≥ 50,000 USDC notional (with DD ≤ 5%, net ≥ 0, PF ≥ 1).

Closest attempts still fail the volume floor and/or the DD cap:

- Highest min-month among DD-safe rows: **41,917 USDC** (still ~8k short of 50k).
- Highest min-month overall in the top-30: **~46,804 USDC**, but max DD **6.17%** (fails the 5% cap).

Raising November/February/April activity enough to clear 50k each month, without lifting DD above 5%, is not available in this grid.



## Top passed candidates

| Rank | TF | Avg monthly | Min monthly | Total notional | Net PnL | Max monthly DD | Full DD | PF | Trades | Status |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| - | - | - | - | - | - | - | - | - | - | - |

## Top overall / closest candidates

| Rank | TF | Avg monthly | Min monthly | Total notional | Net PnL | Max monthly DD | Full DD | PF | Trades | Status |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | 15m | 52406.49 | 37071.33 | 314438.95 | 160.268462 | 4.4248% | 4.4248% | 1.4629 | 247 | minMonthlyNotional<50k |
| 2 | 15m | 52146.03 | 36884.36 | 312876.18 | 159.179667 | 4.2078% | 4.2078% | 1.4828 | 244 | minMonthlyNotional<50k |
| 3 | 15m | 50708.61 | 36056.53 | 304251.68 | 159.028756 | 4.4305% | 4.4305% | 1.4735 | 228 | minMonthlyNotional<50k |
| 4 | 15m | 47688.77 | 31274.01 | 286132.61 | 161.048204 | 4.3624% | 4.3624% | 1.5123 | 225 | minMonthlyNotional<50k |
| 5 | 15m | 47599.27 | 31153.90 | 285595.64 | 158.146119 | 4.0396% | 4.0396% | 1.5252 | 223 | minMonthlyNotional<50k |
| 6 | 15m | 56865.07 | 41917.29 | 341190.41 | 148.652619 | 4.7756% | 4.7756% | 1.3909 | 258 | minMonthlyNotional<50k |
| 7 | 15m | 41180.36 | 26924.81 | 247082.13 | 155.290302 | 3.4768% | 3.6927% | 1.5815 | 186 | minMonthlyNotional<50k |
| 8 | 15m | 40945.46 | 26675.65 | 245672.77 | 148.647211 | 4.3844% | 4.3844% | 1.5482 | 194 | minMonthlyNotional<50k |
| 9 | 15m | 30556.50 | 15773.68 | 183339.01 | 156.005737 | 2.3361% | 2.5432% | 1.8665 | 130 | minMonthlyNotional<50k |
| 10 | 15m | 41123.62 | 26768.09 | 246741.72 | 148.090591 | 3.6985% | 3.6985% | 1.5654 | 193 | minMonthlyNotional<50k |
| 11 | 15m | 49723.73 | 35928.34 | 298342.40 | 140.506576 | 4.4305% | 5.0640% | 1.4416 | 226 | minMonthlyNotional<50k, fullDD>5 |
| 12 | 15m | 37187.04 | 24039.41 | 223122.22 | 147.196677 | 3.1696% | 3.2666% | 1.6195 | 177 | minMonthlyNotional<50k |
| 13 | 15m | 72171.72 | 46689.99 | 433030.30 | 140.757081 | 6.1728% | 6.1728% | 1.2950 | 334 | minMonthlyNotional<50k, monthlyDD>5, fullDD>5 |
| 14 | 15m | 34266.64 | 19984.21 | 205599.86 | 145.025233 | 3.1990% | 3.5169% | 1.6666 | 165 | minMonthlyNotional<50k |
| 15 | 15m | 30392.18 | 15844.03 | 182353.07 | 146.496785 | 2.4311% | 2.7919% | 1.8546 | 129 | minMonthlyNotional<50k |
| 16 | 15m | 40774.59 | 26306.71 | 244647.54 | 139.019121 | 3.4768% | 3.4768% | 1.5433 | 185 | minMonthlyNotional<50k |
| 17 | 15m | 55649.35 | 41722.99 | 333896.08 | 132.730586 | 4.7756% | 5.8096% | 1.3701 | 255 | minMonthlyNotional<50k, fullDD>5 |
| 18 | 15m | 41113.11 | 30092.67 | 246678.68 | 130.104825 | 3.7048% | 3.7048% | 1.4780 | 228 | minMonthlyNotional<50k |
| 19 | 15m | 42776.14 | 30996.07 | 256656.84 | 129.023002 | 3.6997% | 3.6997% | 1.4555 | 248 | minMonthlyNotional<50k |
| 20 | 15m | 38799.12 | 26134.56 | 232794.70 | 131.647278 | 3.6473% | 3.6473% | 1.5146 | 225 | minMonthlyNotional<50k |
| 21 | 15m | 71675.34 | 46804.43 | 430052.04 | 129.382667 | 6.1728% | 6.1728% | 1.2588 | 337 | minMonthlyNotional<50k, monthlyDD>5, fullDD>5 |
| 22 | 15m | 42062.40 | 30996.07 | 252374.38 | 128.317876 | 3.6473% | 3.6473% | 1.4609 | 244 | minMonthlyNotional<50k |
| 23 | 15m | 32882.04 | 22162.78 | 197292.25 | 133.157226 | 3.4768% | 3.4768% | 1.6190 | 151 | minMonthlyNotional<50k |
| 24 | 15m | 36803.24 | 24008.87 | 220819.42 | 131.624060 | 3.1696% | 3.1696% | 1.5795 | 176 | minMonthlyNotional<50k |
| 25 | 15m | 43200.91 | 31553.79 | 259205.43 | 125.696549 | 4.5912% | 4.5912% | 1.4325 | 199 | minMonthlyNotional<50k |
| 26 | 15m | 40674.39 | 30092.67 | 244046.32 | 126.614722 | 3.7048% | 3.7048% | 1.4702 | 226 | minMonthlyNotional<50k |
| 27 | 15m | 38407.01 | 26134.56 | 230442.04 | 128.568237 | 3.6473% | 3.6473% | 1.5078 | 223 | minMonthlyNotional<50k |
| 28 | 15m | 43400.78 | 31675.96 | 260404.70 | 124.136994 | 4.5912% | 5.1935% | 1.4420 | 198 | minMonthlyNotional<50k, fullDD>5 |
| 29 | 15m | 46324.00 | 35005.12 | 277944.01 | 119.800958 | 3.9946% | 3.9946% | 1.3863 | 259 | minMonthlyNotional<50k |
| 30 | 15m | 27379.20 | 13515.17 | 164275.22 | 133.814246 | 2.3057% | 2.5070% | 1.8243 | 122 | minMonthlyNotional<50k |
