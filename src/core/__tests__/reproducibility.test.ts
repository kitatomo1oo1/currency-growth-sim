import { describe, expect, it } from "vitest";
import type { CurrencyDesign } from "../types";
import { runSingleSimulation, type PolicyStrategy } from "../simulation/simulationRunner";

const design: CurrencyDesign = {
  name: "再現性テスト用",
  symbol: "RPR",
  homeCountryId: "japan",
  issuerType: "COMPANY",
  supplyRule: "FLEXIBLE",
  exchangeRule: "OPEN",
  priceRule: "FLOATING",
  launchScale: "NATIONAL",
  useCases: ["RETAIL", "ECOMMERCE"],
};

function makeStrategy(sequence: string[]): PolicyStrategy {
  let idx = 0;
  return () => sequence[Math.min(idx++, sequence.length - 1)];
}

describe("Reproducibility (§58)", () => {
  it("同一Design+MasterSeed+PolicySequenceは100回とも完全一致する", () => {
    const sequence = ["NO_ACTION", "adoption_merchant_support", "market_liquidity_provision", "NO_ACTION"];
    const baseline = runSingleSimulation({ design, masterSeed: "repro-seed-A", policyStrategy: makeStrategy(sequence) })
      .result;

    for (let i = 0; i < 100; i++) {
      const repeat = runSingleSimulation({
        design,
        masterSeed: "repro-seed-A",
        policyStrategy: makeStrategy(sequence),
      }).result;
      expect(repeat).toEqual(baseline);
    }
  });

  it("MasterSeedが異なれば結果はほぼ確実に異なる", () => {
    const sequence = ["NO_ACTION"];
    const a = runSingleSimulation({ design, masterSeed: "seed-X", policyStrategy: makeStrategy(sequence) }).result;
    const b = runSingleSimulation({ design, masterSeed: "seed-Y", policyStrategy: makeStrategy(sequence) }).result;
    expect(a).not.toEqual(b);
  });
});
