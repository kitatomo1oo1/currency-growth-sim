import type { GameState } from "../../types";
import { clamp, clamp01 } from "../mathUtils";
import { simulationConfig } from "../../config";

/**
 * Step15: Inflation / Deflation（§19-21）。
 * monetaryGap = supplyGrowth - currencyActivityGrowth。単純な Supply+10%=Inflation+10% にしない。
 * §19の指示通り時間遅延(既定1年)を持たせるため、当年計算したgapは flags 経由で翌年に持ち越して適用する。
 */
export function updateInflationDeflation(state: GameState, supplyGrowth: number, currencyActivityGrowth: number): void {
  const c = state.currency;
  const design = state.currencyDesign;
  const trustFactor = clamp01(
    (c.issuerTrust + c.technicalTrust + c.monetaryTrust + c.marketTrust + c.institutionalTrust) / 5
  );

  const carryKey = "_carryMonetaryGap";
  const laggedGap = (state.flags[carryKey] as number) ?? 0;
  state.flags[carryKey] = clamp(supplyGrowth - currencyActivityGrowth, -2, 2);

  const inflationRaw = clamp01(
    0.5 * clamp01(laggedGap) + 0.3 * state.world.globalInflationPressure + 0.2 * c.monetaryInstability
  );
  const fixedSupplyDeflationBonus = design.supplyRule === "FIXED" ? 0.15 : 0;
  const deflationRaw = clamp01(0.6 * clamp01(-laggedGap) + fixedSupplyDeflationBonus * clamp01(currencyActivityGrowth));

  c.inflationPressure = clamp01(c.inflationPressure * 0.5 + inflationRaw * 0.5);
  c.deflationPressure = clamp01(c.deflationPressure * 0.5 + deflationRaw * 0.5);

  // Monetary Instability（§20）: Supply増→Inflation→Trust低下→Velocity上昇→さらにInflation、の自己強化ループ。
  const spiralInput = c.inflationPressure * clamp01(1 - trustFactor) * clamp01(c.velocity / 8);
  const spiralCfg = simulationConfig.monetaryInstability;
  c.monetaryInstability = clamp01(
    c.monetaryInstability * (1 - spiralCfg.spiralDecay) + spiralInput * spiralCfg.spiralGain
  );

  // Velocity: インフレが強いと通貨から早く逃げようとし上昇、デフレが強いと保有選好で低下（§21）。
  const velocityDelta = (c.inflationPressure - 0.3) * 0.6 - (c.deflationPressure - 0.3) * 0.4;
  c.velocity = clamp(c.velocity + velocityDelta, 0.5, 12);
}
