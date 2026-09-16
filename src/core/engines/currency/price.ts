import type { GameState, MarketRegime } from "../../types";
import { clamp, clampMin0, lerp, safeDiv } from "../mathUtils";
import { simulationConfig } from "../../config";
import { applyPegMechanics } from "./peg";

/** Step12: Fundamental Value（§14）。内部分析専用、ユーザーへ断定表示しない。 */
export function updateFundamentalValue(state: GameState): void {
  const c = state.currency;
  const transactionMoneyDemand = safeDiv(c.transactionVolume, c.velocity);
  const storeOfValueComponent = c.savingDemand;
  const fundamentalMarketCap = transactionMoneyDemand + storeOfValueComponent;
  c.fundamentalValue = clampMin0(safeDiv(fundamentalMarketCap, c.circulatingSupply, c.baseValue)) || c.baseValue;
}

type PriceBucket = "NORMAL" | "SPECULATIVE" | "CRISIS";

function mapRegimeToBucket(regime: MarketRegime): PriceBucket {
  switch (regime) {
    case "SPECULATIVE":
      return "SPECULATIVE";
    case "STRESS":
      return "CRISIS";
    default:
      return "NORMAL";
  }
}

function liquiditySensitivityMultiplier(liquidity: number): number {
  const cfg = simulationConfig.liquidity;
  if (liquidity <= cfg.low) return cfg.lowSensitivityMultiplier;
  if (liquidity >= cfg.high) return cfg.highSensitivityMultiplier;
  const t = (liquidity - cfg.low) / (cfg.high - cfg.low);
  return lerp(cfg.lowSensitivityMultiplier, cfg.highSensitivityMultiplier, t);
}

export interface PriceContribution {
  key: string;
  label: string;
  value: number; // 符号付き寄与
}

export interface MarketValueResult {
  contributions: PriceContribution[];
}

/**
 * Step13: Market Value（§15）。需要圧力-供給圧力-売却圧力を中心に、Trust/Liquidity/World/Regimeを
 * 通して価格を形成する。Regime/Trust/Liquidityは「前年確定値」（今年分はまだ未確定のため）。
 * PEGGEDはここでpeg.tsへ委譲し、Reserve Pressure機構を経由させる（§27）。
 * Explainability Ledger用に、価格変化への各寄与をcontributionsとして返す。
 */
export function updateMarketValue(state: GameState): MarketValueResult {
  const c = state.currency;
  const design = state.currencyDesign;
  const cfg = simulationConfig.price;

  const priceGapRatio = clamp(safeDiv(c.fundamentalValue - c.baseValue, c.baseValue), -1, 1);
  const totalDemand = c.utilityDemand + c.savingDemand + c.speculativeDemand + c.foreignDemand;
  const speculativeShare = safeDiv(c.speculativeDemand, totalDemand + 1e-9);

  const rawPressure =
    cfg.weights.fundamentalGap * priceGapRatio +
    cfg.weights.momentum * c.momentum +
    cfg.weights.speculativeShare * (speculativeShare - 0.3) -
    cfg.weights.sellingPressure * c.sellingPressure;

  const liquidityMultiplier = liquiditySensitivityMultiplier(c.liquidity);
  const bucket = mapRegimeToBucket(c.regime);
  const range = cfg.rangeByRegime[bucket];

  const priceChangeRaw = clamp(cfg.sensitivity * rawPressure * liquidityMultiplier, range.min, range.max);

  const prevBaseValue = c.baseValue;

  if (design.priceRule === "PEGGED") {
    c.baseValue = Math.max(0.0001, applyPegMechanics(state, priceChangeRaw));
  } else {
    c.baseValue = Math.max(0.0001, prevBaseValue * (1 + priceChangeRaw));
  }

  const realizedReturn = safeDiv(c.baseValue - prevBaseValue, prevBaseValue);
  c.returnHistory.push(realizedReturn);
  if (c.returnHistory.length > 8) c.returnHistory.shift();

  // volatilityは実現リターンの絶対値を指数平滑して更新（Normalized Indexのため0..1に収める）
  c.volatility = clamp(c.volatility * 0.6 + Math.min(1, Math.abs(realizedReturn)) * 0.4, 0, 1);

  const fundamentalGapValue = cfg.weights.fundamentalGap * priceGapRatio;
  const momentumValue = cfg.weights.momentum * c.momentum;
  const speculativeShareValue = cfg.weights.speculativeShare * (speculativeShare - 0.3);
  const sellingPressureValue = -cfg.weights.sellingPressure * c.sellingPressure;

  return {
    contributions: [
      {
        key: "fundamentalGap",
        label: fundamentalGapValue >= 0 ? "実際の使われ方より高く買われている" : "実際の使われ方より安く見られている",
        value: fundamentalGapValue,
      },
      {
        key: "momentum",
        label: momentumValue >= 0 ? "値上がりの勢いがついている" : "値下がりの勢いがついている",
        value: momentumValue,
      },
      {
        key: "speculativeShare",
        label: speculativeShareValue >= 0 ? "値上がり狙いの取引が増えている" : "値上がり狙いの取引が落ち着いている",
        value: speculativeShareValue,
      },
      { key: "sellingPressure", label: "手放したい人が増えている", value: sellingPressureValue },
    ],
  };
}
