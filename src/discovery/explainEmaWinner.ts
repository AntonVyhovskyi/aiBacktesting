import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { loadOrDownloadO1MinuteCandles, CacheMissingError } from "../backtest/fetchO1Candles.js";
import { filterCandlesByRange, resolveStrategyCandles } from "../backtest/candleTimeframe.js";
import { buildDiscoveryIndicatorCache } from "./indicatorCache.js";
import { mergeParams } from "./grids.js";
import { emaCrossoverAtr } from "./strategies/emaCrossoverAtr.js";
import { COMMON_DEFAULTS } from "./strategies/phasedGrids.js";
import { evaluateMaxVolume10DD, maxVolumeSummary } from "./maxVolume10DDEvaluation.js";
import { normalizeAtrDeepParams } from "./atrBreakoutDeepSearch.js";

const envNum = (v: string | undefined, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const bool = (v: string | undefined, fb: boolean) =>
  !v ? fb : v === "1" || v.toLowerCase() === "true";

type WinnerEntry = {
  strategyName: string;
  params: Record<string, number | string>;
  metrics: Record<string, number>;
  weekly?: unknown[];
  passesRiskConstraint?: boolean;
  maxVolumeWithRiskScore?: number;
};

type SearchFinalFile = {
  generatedAt: string;
  rankings: { topMaxMonthlyVolumeUnder10DD: WinnerEntry[] };
};

const FINAL_JSON = path.resolve("data/results/max-monthly-volume-10dd-search-final.json");
const OUT_MD = path.resolve("data/results/ema-crossover-atr-bot-spec.md");
const OUT_JSON = path.resolve("data/results/ema-crossover-atr-bot-spec.json");

const PARAMS_NOT_USED_BY_EMA_MODULE = [
  "minVolumeMult",
  "minAtrPct",
  "exitOnOppositeSignal",
  "minEmaDistancePct",
] as const;

const buildSpec = (input: {
  winner: WinnerEntry;
  searchGeneratedAt: string;
  revalidation: ReturnType<typeof maxVolumeSummary> | null;
  backtestConfig: Record<string, unknown>;
}) => {
  const p = input.winner.params;
  const m = input.winner.metrics;
  const feeRate = input.backtestConfig.feeRate as number;
  const entryMode = input.backtestConfig.entryMode as string;

  return {
    meta: {
      specVersion: "1.0.0",
      generatedAt: new Date().toISOString(),
      sourceResultFile: FINAL_JSON,
      sourceResultGeneratedAt: input.searchGeneratedAt,
      winnerRankKey: "rankings.topMaxMonthlyVolumeUnder10DD[0]",
      strategyName: "EMA_CROSSOVER_ATR",
      symbol: input.backtestConfig.symbol,
      marketId: input.backtestConfig.marketId,
      optimizationObjective: "max_monthly_notional_under_10pct_max_drawdown",
    },
    validationMetrics: {
      fromSearchResult: m,
      revalidatedOnCache: input.revalidation?.metrics ?? null,
    },
    backtestConfig: input.backtestConfig,
    parameters: { ...p },
    parametersInactiveForThisStrategy: PARAMS_NOT_USED_BY_EMA_MODULE.map((key) => ({
      key,
      value: p[key],
      reason: "Not referenced in src/discovery/strategies/emaCrossoverAtr.ts",
    })),
    strategyOverview: {
      family: "EMA crossover with ATR-based initial stop, break-even, and trailing stop",
      style: "Trend-following on EMA(12)/EMA(21) cross; exits via stop/trail only (no opposite-signal exit in code)",
      barsEvaluated: "Each closed 1m candle index i (loop starts at i=1)",
      singlePosition: true,
      profitNotRequired: true,
    },
    indicators: {
      emaShort: { period: p.emaShort, library: "technicalindicators.EMA", input: "close" },
      emaLong: { period: p.emaLong, library: "technicalindicators.EMA", input: "close" },
      atr: { period: p.atrPeriod, library: "technicalindicators.ATR", inputs: ["high", "low", "close"] },
      warmup: "First (period-1) bars padded with NaN; signals require finite EMA/ATR at bar i",
    },
    candleTimeframe: "1m",
    entryExecution: {
      mode: entryMode,
      description:
        entryMode === "nextOpen"
          ? "Signal on bar i close; open at bar i+1 open with stop frozen from signal bar"
          : "Signal and fill on bar i close",
      defaultInSearch: "nextOpen",
    },
    entryLogic: [
      "Skip if position open",
      "passVolatilityFilter: minAtrFilter must be >0 to apply (winner=0 → always pass)",
      "Read EMA short/long at i-1 and i; read ATR at i",
      "Detect bullish or bearish crossover (see long/short conditions)",
      "Compute initial stop = close ± ATR*atrMult",
      "passMinMoveVsFee: |entry-stop| >= close * feeRate * minMoveVsFeeMult",
      "Queue or open position via signal()",
    ],
    longEntryConditions: {
      crossover:
        "emaShort[i-1] <= emaLong[i-1] AND emaShort[i] > emaLong[i]",
      initialStop: "stop = close[i] - atr[i] * atrMult",
      filters: [
        "Finite emaShort[i-1], emaShort[i], atr[i]",
        "passMinMoveVsFee(close, stop)",
        "canEnter: index >= cooldownUntil; maxTradesPerDay if <999",
        "No open position",
      ],
    },
    shortEntryConditions: {
      crossover:
        "emaShort[i-1] >= emaLong[i-1] AND emaShort[i] < emaLong[i]",
      initialStop: "stop = close[i] + atr[i] * atrMult",
      filters: "Same as long",
    },
    stopLoss: {
      initial: {
        long: "entryReference - atr[signalBar] * atrMult (0.8)",
        short: "entryReference + atr[signalBar] * atrMult",
        note: "entryReference is signal bar close (nextOpen) or same-bar close (close mode)",
      },
      intrabar: {
        long: "Exit if candle.low <= stopLoss (fill at stopLoss price)",
        short: "Exit if candle.high >= stopLoss (fill at stopLoss price)",
      },
      breakEvenOverride: "When break-even activates, stopLoss := entryPrice",
      trailingOverride: "Trailing may ratchet stop only in favorable direction",
    },
    positionSize: {
      formula: "qty = (balance * riskPct/100) / |entry - stop|; cap: (qty*entry)/leverage <= balance → qty = balance*leverage/entry",
      riskPct: p.riskPct,
      leverage: p.leverage,
      rounding: "8 decimal places",
      rejectIf: "qty <= 0 or |entry-stop| <= 0",
    },
    riskLogic: {
      riskPerTradePctOfBalance: p.riskPct,
      maxDrawdownConstraintFromSearch: "10% (selection criterion, not enforced in-strategy)",
      minEndBalanceConstraintFromSearch: "90 USDC on 100 start",
    },
    leverageLogic: {
      paramLeverage: p.leverage,
      usage: "Caps notional: max position notional = balance * leverage",
      note: "Does not multiply PnL; only sizing cap in calcQty",
    },
    breakEvenLogic: {
      enabled: Number(p.breakEvenPct) > 0,
      triggerPct: p.breakEvenPct,
      rule: "If unrealized profit % >= breakEvenPct, set stopLoss = entryPrice and breakEvenActive=true",
      profitPctLong: "((close - entry) / entry) * 100",
      profitPctShort: "((entry - close) / entry) * 100",
    },
    trailingStopLogic: {
      trailStartPct: p.trailStart,
      trailGapPct: p.trailGap,
      activate: "When profit % >= trailStart, trailingActive=true",
      updateLong: "candidate = close * (1 - trailGap/100); stop = max(stop, candidate)",
      updateShort: "candidate = close * (1 + trailGap/100); stop = min(stop, candidate)",
      exitReason: "trail if trailingActive else stop",
    },
    exitLogic: {
      takeProfitPct: p.takeProfitPct,
      takeProfitActive: Number(p.takeProfitPct) > 0,
      maxHoldCandles: p.maxHoldCandles,
      maxHoldActive: Number(p.maxHoldCandles) > 0,
      oppositeSignalExit: false,
      endOfBacktest: "Force close at last candle close if still open",
      priorityOrder: ["max_hold", "take_profit", "break_even_update", "trailing_update", "stop_hit"],
    },
    maxTradesPerDay: {
      param: p.maxTradesPerDay,
      behavior: "If maxTradesPerDay < 999, count entries per UTC day key YYYY-MM-DD; skip when count >= limit",
      winnerEffective: "Unlimited (999 disables cap in canEnter)",
    },
    cooldownReentry: {
      cooldownCandles: p.cooldownCandles,
      rule: "After exit at index x, block new entries until index >= x + cooldownCandles",
    },
    feeAssumptions: {
      feeRatePerSide: feeRate,
      feeRateBps: feeRate * 10_000,
      entryFee: "entryPrice * qty * feeRate",
      exitFee: "exitPrice * qty * feeRate",
      netPnL: "grossPnL - entryFee - exitFee",
    },
    liveBotState: {
      balance: "USDC wallet / account equity for sizing",
      position: "null | { direction, entryTime, entryPrice, qty, stopLoss, trailingActive, breakEvenActive, entryFee }",
      pendingSignal: "null | { direction, signalBarTime, stopLoss } for next-open execution",
      cooldownUntilBarIndex: "integer bar index or timestamp of allowed next entry",
      tradesTodayByUtcDate: "Map<YYYY-MM-DD, count> if enforcing maxTradesPerDay < 999",
      lastProcessedCandleOpenTime: "for incremental 1m feed",
      diagnostics: "counters optional: signals, crossovers, skippedByFilter, etc.",
    },
    cacheAndStoredData: {
      rollingCandles: "At least max(emaLong, atrPeriod) + 2 closed 1m bars for SOLUSD",
      computedSeries: "EMA(12), EMA(21), ATR(14) aligned to candle index",
      persistOptional: "Last 500-1000 1m OHLCV for restart; last indicator values; open position snapshot",
      doNotPersist: "Full trade history required only for analytics",
    },
    pseudocode: seePseudocodeBlock(),
    typescriptInterfaces: seeInterfacesBlock(),
    edgeCases: [
      "EMA/ATR NaN during warmup → no signal",
      "Signal on last bar with nextOpen → no fill (no i+1)",
      "stop distance zero → skip entry (skippedInvalidStop)",
      "qty capped by leverage may reduce risk below riskPct target",
      "Same-bar: manageExits runs after pending fill on entry bar",
      "Break-even and trailing both mutate stopLoss; stop check uses final stop",
      "UTC day boundary for tradesToday uses candle.openTime ISO date slice",
    ],
    safetyChecks: [
      "Reject entry if qty <= 0 or stop invalid",
      "Enforce max leverage notional cap before send order",
      "Live: hard stop max account drawdown / daily loss outside strategy",
      "Validate candle continuity (no duplicate/missing 1m timestamps)",
      "Do not double-enter while position or pending exists",
      "Round qty/price per O1 market lot size rules",
    ],
    debugLogs: [
      "BAR {time} emaS emaL atr close",
      "CROSSOVER bull|bear at {time}",
      "SIGNAL {dir} stop={stop} moveVsFee={ok}",
      "ENTRY {dir} price qty stop fee",
      "BE_ACTIVATED stop->entry",
      "TRAIL_ON / TRAIL_UPDATE stop={stop}",
      "EXIT {reason} price gross net fees balance",
      "SKIP cooldown|maxTrades|margin|invalidStop",
    ],
    liveVerification: {
      steps: [
        "Replay same 30d SOLUSD_m2_1m.csv with entryMode=nextOpen, feeRate=0.00035, balance=100",
        "Run emaCrossoverAtr with exact params; compare tradesCount, netPnL, maxDrawdownPct within tolerance",
        "Match first/last 5 trades: direction, entry/exit times, prices, qty, exitReason",
        "Compare weekly notional volume buckets",
        "Shadow mode: log signals live without orders for 24h then replay",
      ],
      tolerances: {
        tradesCount: 0,
        netPnLUsdc: 0.05,
        maxDrawdownPct: 0.1,
        totalNotionalUsdc: 50,
      },
    },
    weeklyBreakdown: input.winner.weekly ?? [],
    implementationSourceFiles: [
      "src/discovery/strategies/emaCrossoverAtr.ts",
      "src/discovery/simulator.ts",
      "src/discovery/strategies/strategyCommon.ts",
    ],
  };
};

function seePseudocodeBlock(): string {
  return `
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
`.trim();
}

function seeInterfacesBlock(): Record<string, unknown> {
  return {
    EmaCrossoverAtrParams: {
      emaShort: "number",
      emaLong: "number",
      atrPeriod: "number",
      atrMult: "number",
      trailStart: "number",
      trailGap: "number",
      takeProfitPct: "number",
      breakEvenPct: "number",
      maxHoldCandles: "number",
      cooldownCandles: "number",
      minAtrFilter: "number",
      minMoveVsFeeMult: "number",
      maxTradesPerDay: "number",
      riskPct: "number",
      leverage: "number",
    },
    LivePosition: {
      direction: "'long' | 'short'",
      entryTime: "number",
      entryPrice: "number",
      qty: "number",
      stopLoss: "number",
      trailingActive: "boolean",
      breakEvenActive: "boolean",
    },
    PendingSignal: {
      direction: "'long' | 'short'",
      signalIndex: "number",
      stopLoss: "number",
    },
    BotState: {
      balance: "number",
      position: "LivePosition | null",
      pending: "PendingSignal | null",
      cooldownUntilIndex: "number",
      tradesToday: "Map<string, number>",
    },
  };
}

const specToMarkdown = (spec: ReturnType<typeof buildSpec>): string => {
  const p = spec.parameters;
  const m = spec.validationMetrics.fromSearchResult;
  const lines: string[] = [
    "# EMA_CROSSOVER_ATR — Live O1 Bot Implementation Spec",
    "",
    `Generated: ${spec.meta.generatedAt}`,
    "",
    `Source: \`rankings.topMaxMonthlyVolumeUnder10DD[0]\` in \`max-monthly-volume-10dd-search-final.json\` (${spec.meta.sourceResultGeneratedAt})`,
    "",
    "## 1. Strategy overview",
    "",
    spec.strategyOverview.family + ".",
    `- **Style:** ${spec.strategyOverview.style}`,
    `- **Timeframe:** ${spec.candleTimeframe} candles`,
    `- **Position:** ${spec.strategyOverview.singlePosition ? "One position at a time" : "Multiple"}`,
    `- **Objective:** Maximize notional volume under ≤10% max drawdown (search constraint; not enforced in-strategy)`,
    "",
    "## 2. Exact parameters",
    "",
    "```json",
    JSON.stringify(p, null, 2),
    "```",
    "",
    "### Parameters present in search JSON but NOT used by EMA_CROSSOVER_ATR code",
    "",
    ...spec.parametersInactiveForThisStrategy.map(
      (x) => `- **${x.key}** = ${JSON.stringify(x.value)} — ${x.reason}`
    ),
    "",
    "## 3. Required indicators",
    "",
    `- EMA(${p.emaShort}) on close`,
    `- EMA(${p.emaLong}) on close`,
    `- ATR(${p.atrPeriod}) on H/L/C`,
    "",
    "Use `technicalindicators` (or equivalent) with NaN padding for warmup bars.",
    "",
    "## 4. Candle timeframe",
    "",
    `**${spec.candleTimeframe}** — same as backtest (\`BACKTEST_TIMEFRAME=1m\`).`,
    "",
    "## 5. Entry logic (step-by-step)",
    "",
    ...spec.entryLogic.map((s, i) => `${i + 1}. ${s}`),
    "",
    `**Execution mode:** ${spec.entryExecution.mode} — ${spec.entryExecution.description}`,
    "",
    "## 6. Long entry conditions",
    "",
    `- **Crossover:** \`${spec.longEntryConditions.crossover}\``,
    `- **Initial stop:** \`${spec.longEntryConditions.initialStop}\``,
    "- **Filters:**",
    ...spec.longEntryConditions.filters.map((f) => `  - ${f}`),
    "",
    "## 7. Short entry conditions",
    "",
    `- **Crossover:** \`${spec.shortEntryConditions.crossover}\``,
    `- **Initial stop:** \`${spec.shortEntryConditions.initialStop}\``,
    "",
    "## 8. Stop loss calculation",
    "",
    `- Initial long: \`${spec.stopLoss.initial.long}\``,
    `- Initial short: \`${spec.stopLoss.initial.short}\``,
    `- Intrabar long: ${spec.stopLoss.intrabar.long}`,
    `- Intrabar short: ${spec.stopLoss.intrabar.short}`,
    "",
    "## 9. Position size calculation",
    "",
    "```",
    spec.positionSize.formula,
    "```",
    "",
    `- riskPct = ${spec.positionSize.riskPct}%`,
    `- leverage cap = ${spec.positionSize.leverage}x`,
    "",
    "## 10. Risk logic",
    "",
    `- Risk per trade: **${spec.riskLogic.riskPerTradePctOfBalance}%** of balance to initial stop`,
    `- Search constraint: ${spec.riskLogic.maxDrawdownConstraintFromSearch}`,
    `- Search constraint: ${spec.riskLogic.minEndBalanceConstraintFromSearch}`,
    "",
    "## 11. Leverage logic",
    "",
    spec.leverageLogic.note + `. Param leverage = **${spec.leverageLogic.paramLeverage}**.`,
    "",
    "## 12. Break-even logic",
    "",
    spec.breakEvenLogic.enabled
      ? `When unrealized profit ≥ **${spec.breakEvenLogic.triggerPct}%**, move stop to entry.`
      : "Disabled.",
    "",
    "## 13. Trailing stop logic",
    "",
    `- Activate when profit ≥ **${spec.trailingStopLogic.trailStartPct}%**`,
    `- Trail gap **${spec.trailingStopLogic.trailGapPct}%** behind close (ratchet only)`,
    "",
    "## 14. Exit logic",
    "",
    `- Take profit: ${spec.exitLogic.takeProfitActive ? spec.exitLogic.takeProfitPct + "%" : "off"}`,
    `- Max hold: ${spec.exitLogic.maxHoldActive ? spec.exitLogic.maxHoldCandles + " candles" : "off"}`,
    `- Opposite signal exit: **no** (not implemented for this strategy)`,
    `- Stop / trail intrabar as in simulator`,
    "",
    "## 15. Max trades per day",
    "",
    `Param \`maxTradesPerDay=${spec.maxTradesPerDay.param}\` → **${spec.maxTradesPerDay.winnerEffective}**.`,
    "",
    "## 16. Cooldown / re-entry",
    "",
    `After each exit, block entries for **${spec.cooldownReentry.cooldownCandles}** completed bars.`,
    "",
    "## 17. Fee assumptions",
    "",
    `- Fee rate: **${spec.feeAssumptions.feeRatePerSide}** per side (${spec.feeAssumptions.feeRateBps} bps)`,
    `- \`BACKTEST_FEE_RATE=0.00035\` in search`,
    "",
    "## 18. State needed in live bot",
    "",
    ...Object.entries(spec.liveBotState).map(([k, v]) => `- **${k}:** ${v}`),
    "",
    "## 19. Cache / persisted data",
    "",
    ...Object.entries(spec.cacheAndStoredData).map(([k, v]) => `- **${k}:** ${v}`),
    "",
    "## 20. Pseudocode",
    "",
    "```text",
    spec.pseudocode,
    "```",
    "",
    "## 21. TypeScript interfaces",
    "",
    "```json",
    JSON.stringify(spec.typescriptInterfaces, null, 2),
    "```",
    "",
    "## 22. Edge cases",
    "",
    ...spec.edgeCases.map((e) => `- ${e}`),
    "",
    "## 23. Safety checks",
    "",
    ...spec.safetyChecks.map((s) => `- ${s}`),
    "",
    "## 24. Debug logs",
    "",
    ...spec.debugLogs.map((l) => `- \`${l}\``),
    "",
    "## 25. Verify live bot matches backtest",
    "",
    ...spec.liveVerification.steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    "**Tolerances:**",
    "",
    "```json",
    JSON.stringify(spec.liveVerification.tolerances, null, 2),
    "```",
    "",
    "## Validation metrics (30d search window)",
    "",
    "| Metric | Value |",
    "|--------|------:|",
    `| Monthly notional volume (USDC) | ${m.totalMonthlyNotionalVolume?.toFixed(2)} |`,
    `| Daily notional volume (avg USDC) | ${m.averageDailyNotionalVolume?.toFixed(2)} |`,
    `| Trades count | ${m.tradesCount} |`,
    `| Trades / day | ${m.tradesPerDay?.toFixed(2)} |`,
    `| Max drawdown % | ${m.maxDrawdownPct?.toFixed(2)} |`,
    `| End balance (USDC) | ${m.endBalance?.toFixed(2)} |`,
    `| Net PnL (USDC) | ${m.netPnL?.toFixed(2)} |`,
    `| Total fees (USDC) | ${m.totalFees?.toFixed(2)} |`,
    `| Win rate % | ${m.winRate?.toFixed(2)} |`,
    `| Profit factor | ${m.profitFactor?.toFixed(4)} |`,
    "",
    "## Weekly breakdown",
    "",
    "| Week | Trades | Volume | Net PnL | Fees | Max DD % |",
    "|------|-------:|-------:|--------:|-----:|---------:|",
  ];

  for (const w of spec.weeklyBreakdown as Array<Record<string, unknown>>) {
    lines.push(
      `| ${w.weekIndex} | ${w.tradesCount} | ${Number(w.notionalVolumeUsdc).toFixed(0)} | ${Number(w.netPnL).toFixed(2)} | ${Number(w.totalFees).toFixed(2)} | ${Number(w.maxDrawdownPct).toFixed(2)} |`
    );
  }

  if (spec.validationMetrics.revalidatedOnCache) {
    const r = spec.validationMetrics.revalidatedOnCache;
    lines.push(
      "",
      "## Re-validation on cached candles (explain-ema-winner)",
      "",
      "| Metric | Search | Revalidated |",
      "|--------|-------:|------------:|",
      `| Trades | ${m.tradesCount} | ${r.tradesCount} |`,
      `| Net PnL | ${m.netPnL?.toFixed(2)} | ${r.netPnL?.toFixed(2)} |`,
      `| Max DD % | ${m.maxDrawdownPct?.toFixed(2)} | ${r.maxDrawdownPct?.toFixed(2)} |`,
      `| Monthly volume | ${m.totalMonthlyNotionalVolume?.toFixed(0)} | ${r.totalMonthlyNotionalVolume?.toFixed(0)} |`
    );
  }

  lines.push(
    "",
    "## Source files",
    "",
    ...spec.implementationSourceFiles.map((f) => `- \`${f}\``)
  );

  return lines.join("\n");
};

const main = async () => {
  if (!fs.existsSync(FINAL_JSON)) {
    console.error(`Missing ${FINAL_JSON}. Run max-volume-10dd-search first.`);
    process.exit(1);
  }

  const finalDoc = JSON.parse(fs.readFileSync(FINAL_JSON, "utf8")) as SearchFinalFile;
  const winner = finalDoc.rankings.topMaxMonthlyVolumeUnder10DD[0];
  if (!winner) {
    console.error("No winner in topMaxMonthlyVolumeUnder10DD");
    process.exit(1);
  }

  const symbol = process.env.O1_SYMBOL ?? "SOLUSD";
  const marketId = envNum(process.env.O1_MARKET_ID, 2);
  const backtestDays = envNum(process.env.BACKTEST_DAYS, 30);
  const startBalance = envNum(process.env.BACKTEST_INITIAL_BALANCE, 100);
  const feeRate = envNum(process.env.BACKTEST_FEE_RATE, 0.00035);
  const entryMode = process.env.BACKTEST_ENTRY_MODE === "close" ? "close" : "nextOpen";
  const endTimeMs = Date.now();
  const startTimeMs = endTimeMs - backtestDays * 86400000;

  let revalidation: ReturnType<typeof maxVolumeSummary> | null = null;

  try {
    const load = await loadOrDownloadO1MinuteCandles(
      { webServerUrl: process.env.O1_WEB_SERVER_URL ?? "https://zo-mainnet.n1.xyz", symbol, marketId },
      {
        cacheDir: path.resolve(process.env.BACKTEST_CACHE_DIR ?? "data/cache"),
        startTimeMs,
        endTimeMs,
        backtestDays,
        countback: 500,
        maxRetries: 5,
        retryDelayMs: 1500,
        forceRefresh: bool(process.env.BACKTEST_FORCE_REFRESH, false),
      }
    );
    const candles = resolveStrategyCandles(
      filterCandlesByRange(load.candles, startTimeMs, endTimeMs),
      process.env.BACKTEST_TIMEFRAME ?? "1m"
    );
    const rangeStart = candles[0]!.openTime;
    const rangeEnd = (candles[candles.length - 1]?.closeTime ?? endTimeMs) + 1;
    const merged = normalizeAtrDeepParams(
      mergeParams(emaCrossoverAtr.defaults, COMMON_DEFAULTS, winner.params)
    );
    const cache = buildDiscoveryIndicatorCache(candles, emaCrossoverAtr.indicatorReq);
    const result = emaCrossoverAtr.run({
      candles,
      cache,
      params: merged,
      initialBalance: startBalance,
      entryMode,
      feeRate,
      leverage: envNum(process.env.BACKTEST_LEVERAGE, 5),
      riskPct: envNum(process.env.BACKTEST_RISK_PCT, 1),
      backtestMsSpan: rangeEnd - rangeStart,
    });
    revalidation = maxVolumeSummary(
      evaluateMaxVolume10DD(result, rangeStart, rangeEnd, startBalance)
    );
  } catch (e) {
    if (e instanceof CacheMissingError) console.warn(`[WARN] Revalidation skipped: ${e.message}`);
    else console.warn(`[WARN] Revalidation skipped:`, e);
  }

  const backtestConfig = {
    symbol,
    marketId,
    timeframe: "1m",
    backtestDays,
    initialBalance: startBalance,
    entryMode,
    feeRate,
    BACKTEST_FORCE_REFRESH: false,
  };

  const spec = buildSpec({
    winner,
    searchGeneratedAt: finalDoc.generatedAt,
    revalidation,
    backtestConfig,
  });

  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(spec, null, 2));
  fs.writeFileSync(OUT_MD, specToMarkdown(spec));

  const m = winner.metrics;
  console.log("\n=== EMA CROSSOVER ATR WINNER SPEC ===\n");
  console.log(`strategyName: ${winner.strategyName}`);
  console.log(`params: ${JSON.stringify(winner.params)}`);
  console.log(
    `metrics: monthlyVol=${m.totalMonthlyNotionalVolume?.toFixed(0)} dailyVol=${m.averageDailyNotionalVolume?.toFixed(0)} trades=${m.tradesCount} (${m.tradesPerDay?.toFixed(1)}/d) DD=${m.maxDrawdownPct?.toFixed(2)}% end=${m.endBalance?.toFixed(2)} netPnL=${m.netPnL?.toFixed(2)} fees=${m.totalFees?.toFixed(2)} WR=${m.winRate?.toFixed(1)}% PF=${m.profitFactor?.toFixed(3)}`
  );
  if (revalidation) {
    const r = revalidation.metrics;
    console.log(
      `revalidated: trades=${r.tradesCount} netPnL=${r.netPnL?.toFixed(2)} DD=${r.maxDrawdownPct?.toFixed(2)}% monthlyVol=${r.totalMonthlyNotionalVolume?.toFixed(0)}`
    );
  }
  console.log(`\nWrote:\n  ${OUT_MD}\n  ${OUT_JSON}\n`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
