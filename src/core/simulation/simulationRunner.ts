import type { CurrencyDesign, GameState, PolicyDefinition } from "../types";
import { createInitialGameState } from "../state/initialState";
import { processYear } from "../engines/yearProcessor";
import { allEvents } from "../data/events";
import { allPolicies } from "../data/policies";
import { getAvailablePolicyChoices, applyPolicy } from "../engines/policyEngine";
import { buildFinalSummary, classifyCurrencyType } from "../engines/historyGenerator";

export type PolicyStrategy = (state: GameState, choices: PolicyDefinition[]) => string;

export interface SimulationRunOptions {
  design: CurrencyDesign;
  masterSeed: string;
  startYear?: number;
  maxYears?: number;
  policyStrategy?: PolicyStrategy;
}

export interface SimulationRunResult {
  masterSeed: string;
  finalValue: number;
  peakValue: number;
  maxDrawdown: number;
  holders: number;
  regularUsers: number;
  merchantCount: number;
  bubbleCount: number;
  crashCount: number;
  recoveryCount: number;
  foreignCountries: number;
  utilityShare: number;
  speculationShare: number;
  finalType: string[];
  lifespan: number;
  finalLifecycle: string;
}

export const NO_ACTION_STRATEGY: PolicyStrategy = () => "NO_ACTION";

function isDead(state: GameState): boolean {
  return state.currency.lifecycle === "DEAD";
}

/** UIを介さずGameStateを直接ドライブする（§56 Simulation Runner）。 */
export function runSingleSimulation(options: SimulationRunOptions): { state: GameState; result: SimulationRunResult } {
  const startYear = options.startYear ?? 2026;
  const maxYears = options.maxYears ?? 50;
  const state = createInitialGameState(options.design, options.masterSeed, startYear, maxYears);
  const strategy = options.policyStrategy ?? NO_ACTION_STRATEGY;
  const turnLength = 5;

  while (state.currentYear < state.maxYear && !isDead(state)) {
    const choices = getAvailablePolicyChoices(state, allPolicies);
    const policyId = strategy(state, choices);
    const applyResult = applyPolicy(state, policyId, allPolicies);
    const policyEntries = applyResult.applied && applyResult.ledgerEntry ? [applyResult.ledgerEntry] : [];

    for (let i = 0; i < turnLength; i++) {
      if (state.currentYear >= state.maxYear) break;
      if (isDead(state)) break;
      state.currentYear += 1;
      processYear(state, allEvents, i === 0 ? policyEntries : []);
    }
  }

  const summary = buildFinalSummary(state);
  const finalType = classifyCurrencyType(state);

  let bubbleCount = 0;
  let crashCount = 0;
  let recoveryCount = 0;
  let wasAboveBubbleThreshold = false;
  let prevRegime: string | undefined;
  for (const r of state.history) {
    const aboveThreshold = r.bubbleLevel === "BUBBLE" || r.bubbleLevel === "EXTREME";
    if (aboveThreshold && !wasAboveBubbleThreshold) bubbleCount++;
    wasAboveBubbleThreshold = aboveThreshold;
    if (r.crashOccurred) crashCount++;
    if (r.regime === "RECOVERY" && prevRegime !== "RECOVERY") recoveryCount++;
    prevRegime = r.regime;
  }

  const c = state.currency;
  const totalDemand = c.utilityDemand + c.savingDemand + c.speculativeDemand + c.foreignDemand || 1;

  const result: SimulationRunResult = {
    masterSeed: options.masterSeed,
    finalValue: summary.finalValue,
    peakValue: summary.peakValue,
    maxDrawdown: summary.maxDrawdown,
    holders: summary.holders,
    regularUsers: summary.regularUsers,
    merchantCount: summary.merchantCount,
    bubbleCount,
    crashCount,
    recoveryCount,
    foreignCountries: summary.foreignCountryCount,
    utilityShare: c.utilityDemand / totalDemand,
    speculationShare: c.speculativeDemand / totalDemand,
    finalType,
    lifespan: summary.lifespanYears,
    finalLifecycle: summary.finalLifecycle,
  };

  return { state, result };
}

export function runBatchSimulations(
  baseOptions: Omit<SimulationRunOptions, "masterSeed">,
  count: number,
  seedPrefix = "batch"
): SimulationRunResult[] {
  const results: SimulationRunResult[] = [];
  for (let i = 0; i < count; i++) {
    const { result } = runSingleSimulation({ ...baseOptions, masterSeed: `${seedPrefix}-${i}` });
    results.push(result);
  }
  return results;
}
