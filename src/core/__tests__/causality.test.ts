import { describe, expect, it } from "vitest";
import type { CurrencyDesign } from "../types";
import { createInitialGameState } from "../state/initialState";
import { updateHumanBehaviorAndDemand } from "../engines/currency/demand";
import { updateFundamentalValue } from "../engines/currency/price";
import { applyEffect } from "../engines/effectApi";
import { applyPegMechanics } from "../engines/currency/peg";
import { updateInflationDeflation } from "../engines/currency/inflationDeflation";

function baseDesign(overrides: Partial<CurrencyDesign> = {}): CurrencyDesign {
  return {
    name: "因果性テスト",
    symbol: "CAU",
    homeCountryId: "japan",
    issuerType: "COMPANY",
    supplyRule: "FLEXIBLE",
    exchangeRule: "OPEN",
    priceRule: "FLOATING",
    launchScale: "NATIONAL",
    useCases: ["RETAIL"],
    ...overrides,
  };
}

describe("Causality Tests (§59)", () => {
  it("Supply: 需要を固定したまま供給だけ増やすとFundamental Valueは下がる", () => {
    const state = createInitialGameState(baseDesign(), "causality-supply", 2026);
    updateHumanBehaviorAndDemand(state);
    updateFundamentalValue(state);
    const before = state.currency.fundamentalValue;

    applyEffect(state, { type: "ModifySupply", kind: "mint", amountRatio: 0.5 }, state.currentYear);
    updateFundamentalValue(state); // 需要(transactionVolume/savingDemand)は据え置き、供給のみ変化させた効果を見る

    expect(state.currency.fundamentalValue).toBeLessThan(before);
  });

  it("Speculation: 実需ほぼゼロでも投機ポテンシャルが高ければSpeculative Demandが実需を上回りうる", () => {
    const state = createInitialGameState(baseDesign(), "causality-speculation", 2026);
    state.currency.utilityPotential = 0;
    state.currency.merchantPotential = 0;
    state.currency.paymentEfficiency = 0;
    state.currency.divisibility = 0;
    state.currency.speculationPotential = 0.9;
    state.currency.momentum = 0.6;
    state.currency.awareness = 0.9;

    updateHumanBehaviorAndDemand(state);

    expect(state.currency.speculativeDemand).toBeGreaterThan(state.currency.utilityDemand);
    expect(state.currency.speculativeDemand).toBeGreaterThan(0);
  });

  it("Exchange CLOSED: foreignPotentialが高くてもForeign Demandは常に0", () => {
    const state = createInitialGameState(baseDesign({ exchangeRule: "CLOSED" }), "causality-closed", 2026);
    state.currency.foreignPotential = 0.9;
    state.currency.awareness = 0.9;

    updateHumanBehaviorAndDemand(state);

    expect(state.currency.foreignDemand).toBe(0);
  });

  it("PEGGED: 需給差分は自由な価格変化ではなくReserve Pressureへ転換される", () => {
    const state = createInitialGameState(baseDesign({ priceRule: "PEGGED" }), "causality-peg", 2026);
    const pegTarget = state.flags["pegTargetValue"] as number;
    const before = { redemption: state.currency.redemptionPressure, reserve: state.currency.reserveAssets };

    const result = applyPegMechanics(state, -0.4); // 供給超過・売却圧力を模擬

    expect(state.currency.redemptionPressure).toBeGreaterThan(before.redemption);
    expect(state.currency.reserveAssets).toBeLessThanOrEqual(before.reserve);
    // pegConfidenceが十分高い(初期0.8)間は目標値近傍に留まる
    expect(Math.abs(result - pegTarget) / pegTarget).toBeLessThan(0.5);
  });

  it("Trust Accident: 特定コンポーネントへの信用ショックは他コンポーネントを変化させない", () => {
    const state = createInitialGameState(baseDesign(), "causality-trust-accident", 2026);
    const before = { ...state.currency };

    applyEffect(state, { type: "ModifyTrust", component: "technicalTrust", delta: -0.3 }, state.currentYear);

    expect(state.currency.technicalTrust).not.toBeCloseTo(before.technicalTrust, 5);
    expect(state.currency.issuerTrust).toBeCloseTo(before.issuerTrust, 10);
    expect(state.currency.monetaryTrust).toBeCloseTo(before.monetaryTrust, 10);
    expect(state.currency.marketTrust).toBeCloseTo(before.marketTrust, 10);
    expect(state.currency.institutionalTrust).toBeCloseTo(before.institutionalTrust, 10);
  });

  it("Incumbent Currency Crisis: 既存通貨信用低下分は部分的にしかプレイヤー通貨へ流入しない", () => {
    const stateDistrust = createInitialGameState(baseDesign(), "causality-incumbent-1", 2026);
    stateDistrust.countries[stateDistrust.currencyDesign.homeCountryId].incumbentCurrencyTrust = 0;
    updateHumanBehaviorAndDemand(stateDistrust);
    const demandWithFullDistrust = stateDistrust.currency.utilityDemand;

    const stateTrust = createInitialGameState(baseDesign(), "causality-incumbent-2", 2026);
    stateTrust.countries[stateTrust.currencyDesign.homeCountryId].incumbentCurrencyTrust = 1;
    updateHumanBehaviorAndDemand(stateTrust);
    const demandWithFullTrust = stateTrust.currency.utilityDemand;

    // 完全不信でも需要が2倍を大きく超えるような極端な流入にはならない(最大1.4倍が設計上の上限)
    expect(demandWithFullDistrust / demandWithFullTrust).toBeLessThan(2);
    expect(demandWithFullDistrust).toBeGreaterThanOrEqual(demandWithFullTrust);
  });

  it("Deflation: FIXED Supply＋活動急増でDeflation Pressureは上昇するが即崩壊はしない", () => {
    const state = createInitialGameState(baseDesign({ supplyRule: "FIXED" }), "causality-deflation", 2026);
    updateInflationDeflation(state, 0, 0.8); // 供給成長0、活動成長80%を模擬

    expect(state.currency.deflationPressure).toBeGreaterThan(0);
    expect(state.currency.deflationPressure).toBeLessThanOrEqual(1);
    expect(Number.isFinite(state.currency.velocity)).toBe(true);
  });

  it("Mass Issuance: 1回の大量発行だけではMonetary Instabilityは即座に高騰しない(時間遅延あり)", () => {
    const state = createInitialGameState(baseDesign(), "causality-mass-issuance", 2026);
    applyEffect(state, { type: "ModifySupply", kind: "mint", amountRatio: 3.0 }, state.currentYear);

    updateInflationDeflation(state, 3.0, 0.05); // 供給成長300%を模擬、ただしlagにより初回は反映されない

    expect(state.currency.monetaryInstability).toBeLessThan(0.3);
  });
});
