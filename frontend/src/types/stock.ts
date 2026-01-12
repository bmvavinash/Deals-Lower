export interface ZerodhaStock {
  Instrument: string;
  Qty: number;
  AvgCost: number;
  LTP: number;
  CurVal: number;
  PnL: number;
  NetChg: number;
  DayChg: number;
  Type: string;
  Sector: string;
  Exchange: string;
}

export interface XAlphaCrypto {
  [key: string]: any;
}

export interface StockRecommendation {
  Instrument: string;
  stockMatch: boolean;
  durationMatch: boolean;
  lowPriceMatch: boolean;
  targetMatch: boolean;
  stoplossMatch: boolean;
  RecommendationScore: number;
  Platform: string;
  CreatedTimestamp: string;
  UpdatedTimestamp: string;
}


















