import type { CountryState, GameState } from "../../types";
import { clamp01, safeDiv } from "../mathUtils";

/**
 * 共通Numeraireを介したクロスレート計算（§23）。
 * FX(自通貨, 対象国通貨) = 自通貨のNumeraire建て価値 × 対象国のNumeraire換算値
 */
export function computeExchangeRate(
  baseValueInHomeCurrency: number,
  homeCountry: CountryState,
  targetCountry: CountryState
): number {
  const valueInNumeraire = safeDiv(baseValueInHomeCurrency, homeCountry.numeraireExchangeRate);
  return valueInNumeraire * targetCountry.numeraireExchangeRate;
}

/**
 * Step14: FX。海外国ごとのレートをUI/Ledger用に確定し、fxExposureをOPEN Exchangeの実態に合わせて微調整する。
 * CLOSED Exchangeは常にfxExposure=0（仕様監査 §7-2、effectApi側でも変更を遮断済み）。
 */
export function updateForeignExchange(state: GameState): void {
  const c = state.currency;
  const design = state.currencyDesign;

  if (design.exchangeRule === "CLOSED") {
    c.fxExposure = 0;
    return;
  }

  const homeCountry = state.countries[design.homeCountryId];
  const foreignCountryIds = Object.keys(state.countries).filter((id) => id !== design.homeCountryId);

  let totalForeignAwareness = 0;
  for (const id of foreignCountryIds) {
    const adoption = c.foreignAdoption[id];
    totalForeignAwareness += adoption?.awareness ?? 0;
  }

  // 海外での認知・利用実態が育つほどfxExposureは自然に高まる（OPENなら海外開始前でも小さく存在しうる、§23）。
  const activityBonus = c.foreignDemand > 0 ? 0.02 : 0;
  const organicExposure = clamp01(0.05 + totalForeignAwareness * 0.5 + activityBonus);
  c.fxExposure = clamp01(Math.max(c.fxExposure * 0.95, organicExposure));

  void homeCountry; // レート自体はUI側でcomputeExchangeRateを都度呼び出して算出する
}
