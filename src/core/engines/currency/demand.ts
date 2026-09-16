import type { GameState } from "../../types";
import { clamp01, clampMin0, logisticSigned } from "../mathUtils";
import { simulationConfig } from "../../config";

/** momentumは直近3年のreturnから算出し、ロジスティックで圧縮して無限発散を防ぐ（§13）。 */
export function updateMomentum(state: GameState): void {
  const h = state.currency.returnHistory;
  const r1 = h[h.length - 1] ?? 0;
  const r2 = h[h.length - 2] ?? 0;
  const r3 = h[h.length - 3] ?? 0;
  const raw = 0.5 * r1 + 0.3 * r2 + 0.2 * r3;
  state.currency.momentum = logisticSigned(raw, 2.2);
}

/**
 * Annual Processing Order §39 のステップ5〜9をまとめて処理する。
 * Step5: Human behavior（安定性要因の算出）
 * Step6: Utility demand
 * Step7: Saving demand
 * Step8: Speculative demand
 * Step9: Foreign demand
 * ここで参照する trust/awareness/potential 等は、既にStep4(Event)で当年分が反映済みの値。
 * 価格(baseValue)はまだ当年分が確定していないため、前年確定値をそのまま使う（循環禁止、§39末尾）。
 */
export function updateHumanBehaviorAndDemand(state: GameState): void {
  const c = state.currency;
  const design = state.currencyDesign;

  updateMomentum(state);

  const stabilityFactor = clamp01(1 - c.volatility);
  const usability = clamp01(0.5 * c.paymentEfficiency + 0.5 * c.divisibility);
  const merchantCoverage = clamp01(0.6 * c.merchantPotential + 0.4 * c.merchantActivityRate);
  const trustFactor = clamp01(
    (c.issuerTrust + c.technicalTrust + c.monetaryTrust + c.marketTrust + c.institutionalTrust) / 5
  );

  const spending = simulationConfig.behavior.baseSpendingPerActiveUser;

  // §24: 既存通貨危機。信用低下分の一部だけがプレイヤー通貨へ流れる（100%ではない）。
  // 獲得率(alternativeCaptureRate)自体もプレイヤー通貨のTrust/Usability/Exchange Accessで変わる。
  const homeCountry = state.countries[design.homeCountryId];
  const exchangeAccessBonus = design.exchangeRule === "OPEN" ? 0.15 : design.exchangeRule === "LIMITED" ? 0.05 : 0;
  c.alternativeCaptureRate = clamp01(0.15 + trustFactor * 0.35 + usability * 0.2 + exchangeAccessBonus);
  const incumbentDistrust = homeCountry ? clamp01(1 - homeCountry.incumbentCurrencyTrust) : 0;
  const captureBoost = incumbentDistrust * c.alternativeCaptureRate; // 0..1程度、実需への緩やかな押し上げに留める

  // Step6: Utility Demand（§12の式に準拠）
  c.utilityDemand = clampMin0(
    c.activeUsers *
      spending *
      usability *
      merchantCoverage *
      trustFactor *
      stabilityFactor *
      (0.4 + c.utilityPotential) *
      (1 + captureBoost * 0.4)
  );

  // Step7: Saving Demand。PEGGEDは値上益期待が乏しいため貯蓄動機をやや弱める。
  const pegDamp = design.priceRule === "PEGGED" ? 0.6 : 1;
  c.savingDemand = clampMin0(
    c.holders * spending * 0.35 * c.savingPotential * (0.3 + trustFactor * 0.7) * pegDamp
  );

  // Step8: Speculative Demand。momentum・awareness・投機ポテンシャルから形成。実需が薄くても発生しうる。
  const hypeFactor = clamp01(0.5 + c.momentum * 0.5);
  c.speculativeDemand = clampMin0(
    c.holders * spending * 0.5 * c.speculationPotential * hypeFactor * (0.3 + c.awareness * 0.7)
  );

  // Step9: Foreign Demand。CLOSEDは常に0（仕様監査 §7-2）。
  if (design.exchangeRule === "CLOSED") {
    c.foreignDemand = 0;
  } else {
    const exchangeFactor = design.exchangeRule === "OPEN" ? 1 : 0.5;
    c.foreignDemand = clampMin0(
      c.foreignPotential * spending * 400 * exchangeFactor * (0.3 + trustFactor * 0.7) * (0.3 + c.awareness * 0.7)
    );
  }

  // Inflation計算(monetaryGap)がStep15時点で必要とするため、需要が出揃った時点で活動量を確定する。
  c.transactionVolume = c.utilityDemand;
  c.currencyActivityVolume =
    c.utilityDemand + c.speculativeDemand * 0.5 + c.foreignDemand * 0.5 + c.savingDemand * 0.1;
}
