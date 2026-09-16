import { describe, expect, it } from "vitest";
import type { CurrencyDesign } from "../types";
import { runSingleSimulation } from "../simulation/simulationRunner";

const designs: CurrencyDesign[] = [
  {
    name: "テスト小規模",
    symbol: "T1",
    homeCountryId: "japan",
    issuerType: "COMPANY",
    supplyRule: "FLEXIBLE",
    exchangeRule: "OPEN",
    priceRule: "FLOATING",
    launchScale: "SMALL",
    useCases: ["RETAIL"],
  },
  {
    name: "テスト固定供給",
    symbol: "T2",
    homeCountryId: "japan",
    issuerType: "ALGORITHMIC",
    supplyRule: "FIXED",
    exchangeRule: "OPEN",
    priceRule: "FLOATING",
    launchScale: "NATIONAL",
    useCases: ["SAVINGS_INVESTMENT"],
  },
  {
    name: "テストペッグ",
    symbol: "T3",
    homeCountryId: "japan",
    issuerType: "GOVERNMENT",
    supplyRule: "GRADUAL",
    exchangeRule: "OPEN",
    priceRule: "PEGGED",
    launchScale: "NATIONAL",
    useCases: ["RETAIL"],
  },
  {
    name: "テストクローズド",
    symbol: "T4",
    homeCountryId: "alt_republic",
    issuerType: "COMMUNITY",
    supplyRule: "AUTOMATIC",
    exchangeRule: "CLOSED",
    priceRule: "FLOATING",
    launchScale: "GLOBAL",
    useCases: ["SAVINGS_INVESTMENT"],
  },
];

describe("Invariants (§57)", () => {
  for (const design of designs) {
    it(`${design.name}: 50年間×20Seedで不変条件違反が発生しない`, () => {
      for (let i = 0; i < 20; i++) {
        expect(() => runSingleSimulation({ design, masterSeed: `invariant-${design.symbol}-${i}` })).not.toThrow();
      }
    });
  }
});
