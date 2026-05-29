export type NormalizedCandle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};

export type EntryExecutionMode = "close" | "nextOpen";

export type O1FetchConfig = {
  webServerUrl: string;
  symbol: string;
  marketId: number;
};
