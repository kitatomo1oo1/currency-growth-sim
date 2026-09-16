import type { GameState } from "../../types";
import { clamp, clamp01, clampMin0, safeDiv } from "../mathUtils";

/**
 * Step16: Adoption。holders/activeUsers/regularUsersを更新する。
 * この時点ではStep18のTrust更新は未実行のため、trustFactorは前年確定値を参照する（循環禁止）。
 * regularUsers <= activeUsers <= holders は「holders基準の比率遷移」として導出することで常に保証する
 * （仕様監査 §2: 独立更新にすると不変条件が壊れやすいため）。
 */
export function updateAdoption(state: GameState): void {
  const c = state.currency;
  const design = state.currencyDesign;
  const homeCountry = state.countries[design.homeCountryId];

  const trustFactor = clamp01(
    (c.issuerTrust + c.technicalTrust + c.monetaryTrust + c.marketTrust + c.institutionalTrust) / 5
  );
  const stabilityFactor = clamp01(1 - c.volatility);

  const acquisition =
    clamp01(c.awareness * 0.5) * (0.3 + trustFactor * 0.7) * (0.4 + stabilityFactor * 0.6) * (0.6 + clamp01(c.momentum) * 0.4);
  const churn = clamp01(0.04 + (1 - trustFactor) * 0.12 + c.volatility * 0.15);
  const netRate = clamp(acquisition - churn, -0.35, 1.2);

  const foreignHoldersSum = Object.values(c.foreignAdoption).reduce((sum, a) => sum + a.activeUsers, 0);
  const domesticHolders = Math.max(0, c.holders - foreignHoldersSum);

  const newHoldersUnbounded = clampMin0(c.holders * (1 + netRate));
  const totalGrowth = newHoldersUnbounded - c.holders;

  const foreignShare = design.exchangeRule === "CLOSED" ? 0 : clamp01(c.foreignPotential * 0.6 + c.fxExposure * 0.4);
  const domesticGrowth = totalGrowth * (1 - foreignShare);
  const foreignGrowth = totalGrowth * foreignShare;

  const newDomesticHolders = clamp(domesticHolders + domesticGrowth, 0, homeCountry.population);

  const foreignIds = Object.keys(c.foreignAdoption);
  for (const id of foreignIds) {
    const entry = c.foreignAdoption[id];
    if (entry) entry.awareness = clamp01(entry.awareness * 0.85 + c.foreignPotential * c.awareness * 0.3);
  }

  if (foreignIds.length > 0 && foreignGrowth !== 0) {
    const per = foreignGrowth / foreignIds.length;
    for (const id of foreignIds) {
      const country = state.countries[id];
      const entry = c.foreignAdoption[id];
      if (!country || !entry) continue;
      entry.activeUsers = clamp(entry.activeUsers + per, 0, country.population);
    }
  }

  const newForeignHoldersSum = Object.values(c.foreignAdoption).reduce((sum, a) => sum + a.activeUsers, 0);
  c.holders = Math.round(clampMin0(newDomesticHolders + newForeignHoldersSum));

  const activeRatioTarget = clamp01(0.4 + trustFactor * 0.3 + stabilityFactor * 0.2);
  const regularRatioOfActiveTarget = clamp01(0.25 + trustFactor * 0.35 - c.volatility * 0.2);

  c.activeUsers = Math.round(clamp(c.holders * activeRatioTarget, 0, c.holders));
  c.regularUsers = Math.round(clamp(c.activeUsers * regularRatioOfActiveTarget, 0, c.activeUsers));

  // 認知度は放っておくと自然に薄れる（口コミ・広報等のEvent/Policyが認知度を押し上げ続けない限り）。
  // これがないと「誰も話題にしなくなった」状態(DORMANT)へ自然には向かわない。
  c.awareness = clamp01(c.awareness * 0.97);
}

/** Step17: Merchant Activity。加盟店数・稼働率・取引シェアを更新する。 */
export function updateMerchantActivity(state: GameState): void {
  const c = state.currency;
  const activityIntensity = safeDiv(c.utilityDemand, c.activeUsers * 120 + 1);
  const merchantGrowthRate = clamp(c.merchantPotential * 0.3 + clamp01(activityIntensity) * 0.2 - 0.02, -0.2, 0.5);

  c.merchantCount = Math.max(0, Math.round(c.merchantCount * (1 + merchantGrowthRate)));
  c.merchantActivityRate = clamp01(c.merchantActivityRate * 0.7 + c.merchantPotential * 0.3);

  const totalDemand = c.utilityDemand + c.savingDemand + c.speculativeDemand + c.foreignDemand;
  c.merchantTransactionShare = clamp01(safeDiv(c.utilityDemand, totalDemand + 1e-9));

  // 加盟店ポテンシャルも支援が続かなければ自然に下がる(店舗側の取り扱い停止・離脱)。
  c.merchantPotential = clamp01(c.merchantPotential * 0.985);
}
