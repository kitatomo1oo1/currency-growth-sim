import type { GameState } from "../../types";
import { clamp01, lerp, safeDiv } from "../mathUtils";
import { simulationConfig } from "../../config";

/**
 * PEGGED通貨の価格決定（§27）。需給差分を自由な価格変化ではなくReserve Pressureへ転換する。
 * 準備不足→Confidence低下→Redemption増加→Reserve減少→Confidenceさらに低下、の危機ループを表現する。
 * rawPressure は仮に自由価格制だった場合の需給圧力（-1..1程度）。
 */
export function applyPegMechanics(state: GameState, rawPressure: number): number {
  const c = state.currency;
  const pegTarget = (state.flags["pegTargetValue"] as number) ?? c.baseValue;
  const cfg = simulationConfig.peg;

  const requiredReserve = c.circulatingSupply * pegTarget * cfg.reserveRatioTarget;
  c.reserveRatio = safeDiv(c.reserveAssets, requiredReserve, 0);

  const gapMagnitude = clamp01(Math.abs(rawPressure));
  // 供給超過・売却圧力(rawPressure<0)は償還要求を強く押し上げる。需要超過は新規発行で吸収しやすい。
  const redemptionGain = gapMagnitude * cfg.redemptionPressureGainOnGap * (rawPressure < 0 ? 1 : 0.3);
  c.redemptionPressure = clamp01(c.redemptionPressure * 0.5 + redemptionGain);

  const reserveDrain = c.reserveAssets * c.redemptionPressure * 0.1;
  c.reserveAssets = Math.max(0, c.reserveAssets - reserveDrain);

  // Confidenceは当年のフロー圧力(redemptionPressure)だけでなく、準備の実際の厚み(reserveRatio)にも直接反応する。
  // そうしないと準備がほぼ枯渇していても信認が回復し続けてしまい、§27の危機ループが成立しない。
  const reserveThinness = clamp01(1 - c.reserveRatio);
  c.pegConfidence = clamp01(
    c.pegConfidence -
      c.redemptionPressure * 0.15 -
      reserveThinness * 0.12 +
      (1 - c.redemptionPressure) * 0.05 * clamp01(c.reserveRatio)
  );

  if (c.pegConfidence < cfg.depegConfidenceThreshold) {
    const freeFloatValue = pegTarget * (1 + rawPressure);
    const blend = clamp01(1 - c.pegConfidence / cfg.depegConfidenceThreshold);
    return lerp(pegTarget, freeFloatValue, blend);
  }

  return pegTarget;
}
