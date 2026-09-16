import type { GameState } from "../types";

export interface InvariantViolation {
  key: string;
  message: string;
}

const NORMALIZED_01_FIELDS = [
  "awareness",
  "liquidity",
  "volatility",
  "issuerTrust",
  "technicalTrust",
  "monetaryTrust",
  "marketTrust",
  "institutionalTrust",
  "policyCredibility",
  "trustScar",
  "inflationPressure",
  "deflationPressure",
  "bubblePressure",
  "crisisPressure",
  "monetaryInstability",
  "fxExposure",
  "alternativeCaptureRate",
  "divisibility",
  "paymentEfficiency",
  "redemptionPressure",
  "pegConfidence",
  "governanceCapacity",
  "utilityPotential",
  "savingPotential",
  "speculationPotential",
  "foreignPotential",
  "merchantPotential",
  "merchantActivityRate",
  "merchantTransactionShare",
] as const;

/** Step24: Invariant validation（§57）。開発環境では黙ってClampせず、違反を明示的に検出する。 */
export function checkInvariants(state: GameState): InvariantViolation[] {
  const c = state.currency;
  const violations: InvariantViolation[] = [];

  const push = (key: string, condition: boolean, message: string) => {
    if (!condition) violations.push({ key, message });
  };

  // Finite Number / NaN / Infinity チェック（全数値フィールド横断）
  for (const [key, value] of Object.entries(c)) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      violations.push({ key, message: `数値が不正です(NaN/Infinity): ${key} = ${value}` });
    }
  }

  push("regularUsers<=activeUsers", c.regularUsers <= c.activeUsers, "regularUsersがactiveUsersを超えています");
  push("activeUsers<=holders", c.activeUsers <= c.holders, "activeUsersがholdersを超えています");
  push("circulatingSupply<=totalSupply", c.circulatingSupply <= c.totalSupply + 1e-6, "circulatingSupplyがtotalSupplyを超えています");

  push("holders>=0", c.holders >= 0, "holdersが負数です");
  push("activeUsers>=0", c.activeUsers >= 0, "activeUsersが負数です");
  push("regularUsers>=0", c.regularUsers >= 0, "regularUsersが負数です");
  push("merchantCount>=0", c.merchantCount >= 0, "merchantCountが負数です");
  push("totalSupply>=0", c.totalSupply >= 0, "totalSupplyが負数です");
  push("circulatingSupply>=0", c.circulatingSupply >= 0, "circulatingSupplyが負数です");
  push("baseValue>0", c.baseValue > 0, "baseValueが0以下です");
  push("velocity>=0", c.velocity >= 0, "velocityが負数です");

  for (const field of NORMALIZED_01_FIELDS) {
    const value = c[field];
    push(field, value >= -1e-6 && value <= 1 + 1e-6, `${field}が0..1の範囲外です(${value})`);
  }

  const homeCountry = state.countries[state.currencyDesign.homeCountryId];
  const foreignHoldersSum = Object.values(c.foreignAdoption).reduce((sum, a) => sum + a.activeUsers, 0);
  const domesticHolders = c.holders - foreignHoldersSum;
  if (homeCountry) {
    push(
      "domesticHolders<=population",
      domesticHolders <= homeCountry.population + 1e-3,
      "国内利用者が対象国内人口を超えています"
    );
  }

  const worldPopulation = Object.values(state.countries).reduce((sum, country) => sum + country.population, 0);
  push("holders<=worldPopulation", c.holders <= worldPopulation + 1e-3, "利用者数が世界人口を超えています");

  for (const [countryId, adoption] of Object.entries(c.foreignAdoption)) {
    const country = state.countries[countryId];
    if (!country) continue;
    push(
      `foreignAdoption.${countryId}<=population`,
      adoption.activeUsers <= country.population + 1e-3,
      `${countryId}の利用者数がその国の人口を超えています`
    );
  }

  return violations;
}

export function assertInvariants(state: GameState): void {
  const violations = checkInvariants(state);
  if (violations.length > 0) {
    const detail = violations.map((v) => `- [${v.key}] ${v.message}`).join("\n");
    throw new Error(`不変条件違反 (year=${state.currentYear}):\n${detail}`);
  }
}
