import type {
  BubbleLevel,
  CurrencyStateSnapshot,
  GameState,
  LedgerDelayedEntry,
  LedgerDriver,
  LedgerEventEntry,
  LedgerPolicyEntry,
  YearRecord,
} from "../types";
import type { PriceContribution } from "./currency/price";

function driversFromContributions(contributions: PriceContribution[]): LedgerDriver[] {
  return contributions
    .filter((c) => Math.abs(c.value) > 1e-6)
    .map((c) => ({ key: c.key, label: c.label, magnitude: Math.abs(c.value), direction: c.value >= 0 ? "up" : "down" }));
}

function categorize(drivers: LedgerDriver[], keys: string[]): LedgerDriver[] {
  return drivers.filter((d) => keys.some((k) => d.key.toLowerCase().includes(k.toLowerCase())));
}

export function buildCurrencySnapshot(state: GameState): CurrencyStateSnapshot {
  const c = state.currency;
  const overallTrust =
    (c.issuerTrust + c.technicalTrust + c.monetaryTrust + c.marketTrust + c.institutionalTrust) / 5;
  const foreignCountryCount = Object.values(c.foreignAdoption).filter((a) => a.activeUsers > 0).length;

  return {
    baseValue: c.baseValue,
    fundamentalValue: c.fundamentalValue,
    holders: c.holders,
    activeUsers: c.activeUsers,
    regularUsers: c.regularUsers,
    merchantCount: c.merchantCount,
    circulatingSupply: c.circulatingSupply,
    totalSupply: c.totalSupply,
    awareness: c.awareness,
    liquidity: c.liquidity,
    overallTrust,
    inflationPressure: c.inflationPressure,
    deflationPressure: c.deflationPressure,
    bubblePressure: c.bubblePressure,
    crisisPressure: c.crisisPressure,
    fxExposure: c.fxExposure,
    foreignCountryCount,
    utilityDemand: c.utilityDemand,
    savingDemand: c.savingDemand,
    speculativeDemand: c.speculativeDemand,
    foreignDemand: c.foreignDemand,
  };
}

export interface YearRecordInputs {
  valueBefore: number;
  priceContributions: PriceContribution[];
  effectDrivers: LedgerDriver[]; // Event/Policy/DelayedEffectのapplyEffectsから集めたもの
  events: LedgerEventEntry[];
  policies: LedgerPolicyEntry[];
  maturedDelayedEffects: LedgerDelayedEntry[];
  bubbleLevel: BubbleLevel;
  crashOccurred: boolean;
}

/** Step23: Explainability Ledger。「なぜ？」UIは必ずここから生成し、後付け理由を作らない（§40）。 */
export function buildYearRecord(state: GameState, inputs: YearRecordInputs): YearRecord {
  const priceDrivers = driversFromContributions(inputs.priceContributions);
  const allDrivers = [...priceDrivers, ...inputs.effectDrivers];

  const positiveDrivers = allDrivers
    .filter((d) => d.direction === "up")
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 4);
  const negativeDrivers = allDrivers
    .filter((d) => d.direction === "down")
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 4);

  return {
    year: state.currentYear,
    valueBefore: inputs.valueBefore,
    valueAfter: state.currency.baseValue,
    positiveDrivers,
    negativeDrivers,
    events: inputs.events,
    policies: inputs.policies,
    maturedDelayedEffects: inputs.maturedDelayedEffects,
    inflationDrivers: categorize(allDrivers, ["supply", "reserve", "inflation", "monetaryinstability"]),
    adoptionDrivers: categorize(allDrivers, ["awareness", "utilitypotential", "merchantpotential", "foreignpotential"]),
    trustDrivers: categorize(allDrivers, ["trust", "credibility"]),
    fxDrivers: categorize(allDrivers, ["fx", "foreign"]),
    regime: state.currency.regime,
    lifecycle: state.currency.lifecycle,
    bubbleLevel: inputs.bubbleLevel,
    crashOccurred: inputs.crashOccurred,
    snapshot: buildCurrencySnapshot(state),
  };
}
