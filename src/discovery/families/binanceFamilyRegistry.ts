import type { FamilyStrategyPack } from "../strategies/families/familyKit.js";
import { emaTrendContinuationFamily } from "../strategies/families/emaTrendContinuation.js";
import { rsiMeanReversionFamily } from "../strategies/families/rsiMeanReversion.js";
import { vwapPullbackFamily } from "../strategies/families/vwapPullback.js";
import { donchianBreakoutFamily } from "../strategies/families/donchianBreakout.js";
import { bollingerMeanReversionFamily } from "../strategies/families/bollingerMeanReversion.js";
import { atrVolatilityBreakoutFamily } from "../strategies/families/atrVolatilityBreakout.js";
import { sessionOpeningRangeFamily } from "../strategies/families/sessionOpeningRangeBreakout.js";
import { trendWithBtcFilterFamily } from "../strategies/families/trendWithBtcFilter.js";

export const BINANCE_STRATEGY_FAMILIES: FamilyStrategyPack[] = [
  emaTrendContinuationFamily,
  rsiMeanReversionFamily,
  vwapPullbackFamily,
  donchianBreakoutFamily,
  bollingerMeanReversionFamily,
  atrVolatilityBreakoutFamily,
  sessionOpeningRangeFamily,
  trendWithBtcFilterFamily,
];
