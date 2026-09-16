import type { EventDefinition, GameState, LedgerPolicyEntry, YearRecord } from "../types";
import { deriveSeeds, yearStream } from "../seed";
import { safeDiv } from "./mathUtils";
import { updateWorld } from "./worldEngine";
import { updateCountries } from "./countryEngine";
import { matureDelayedEffects } from "./delayedEffects";
import { selectAndApplyEvents } from "./eventEngine";
import { updateHumanBehaviorAndDemand } from "./currency/demand";
import { updateSellingPressure } from "./currency/pressure";
import { updateSupply } from "./currency/supply";
import { updateFundamentalValue, updateMarketValue } from "./currency/price";
import { updateForeignExchange } from "./currency/fx";
import { updateInflationDeflation } from "./currency/inflationDeflation";
import { updateAdoption, updateMerchantActivity } from "./currency/adoption";
import { updateTrustDrift } from "./currency/trust";
import { updateBubbleAndCrisisPressure, evaluateCrash } from "./currency/bubbleCrisis";
import { updateMarketRegime } from "./currency/regime";
import { updateLifecycle } from "./lifecycle";
import { detectLearning, unlockCrash } from "./learningEngine";
import { buildYearRecord } from "./explainability";
import { checkInvariants } from "./invariants";
import { recoverGovernanceCapacity } from "./policyEngine";

/**
 * Annual Processing Order（§39）の25ステップを固定順序で実行する。
 * state.currentYear は呼び出し側（Game Controller / Simulation Runner）が処理対象の年へ
 * 進めてから呼ぶこと。Policyはターン境界での単発アクションのため、ここでは含めず
 * appliedPolicyEntries として当年のLedgerへ添付するだけにする。
 */
export function processYear(
  state: GameState,
  allEvents: EventDefinition[],
  appliedPolicyEntries: LedgerPolicyEntry[] = []
): YearRecord {
  const seeds = deriveSeeds(state.masterSeed);
  const worldRng = yearStream(seeds.worldSeed, state.currentYear, "world");
  const eventRng = yearStream(seeds.eventSeed, state.currentYear, "event");
  const marketRng = yearStream(seeds.marketSeed, state.currentYear, "market");

  const valueBefore = state.currency.baseValue;
  const prevFundamentalValue = state.currency.fundamentalValue;
  const prevUtilityDemand = state.currency.utilityDemand;
  const prevCurrencyActivityVolume = state.currency.currencyActivityVolume;

  updateWorld(state, worldRng); // Step1
  updateCountries(state); // Step2
  const { matured, drivers: delayedDrivers } = matureDelayedEffects(state); // Step3
  const { entries: eventEntries, drivers: eventDrivers } = selectAndApplyEvents(state, eventRng, allEvents); // Step4

  updateHumanBehaviorAndDemand(state); // Step5-9

  updateSellingPressure(state); // Step10

  const supplyGrowth = updateSupply(state); // Step11
  const currencyActivityGrowth = safeDiv(
    state.currency.currencyActivityVolume - prevCurrencyActivityVolume,
    prevCurrencyActivityVolume || 1
  );

  updateFundamentalValue(state); // Step12
  const marketResult = updateMarketValue(state); // Step13
  updateForeignExchange(state); // Step14
  updateInflationDeflation(state, supplyGrowth, currencyActivityGrowth); // Step15

  updateAdoption(state); // Step16
  updateMerchantActivity(state); // Step17
  updateTrustDrift(state); // Step18

  const bubbleLevel = updateBubbleAndCrisisPressure(state, prevFundamentalValue, prevUtilityDemand); // Step19
  const crashResult = evaluateCrash(state, marketRng); // Step20
  if (crashResult.occurred) unlockCrash(state);

  updateMarketRegime(state); // Step21
  recoverGovernanceCapacity(state);

  updateLifecycle(state);

  const realizedReturn = state.currency.returnHistory[state.currency.returnHistory.length - 1] ?? 0;
  detectLearning(state, realizedReturn); // Step22

  const yearRecord = buildYearRecord(state, {
    valueBefore,
    priceContributions: marketResult.contributions,
    effectDrivers: [...delayedDrivers, ...eventDrivers],
    events: eventEntries,
    policies: appliedPolicyEntries,
    maturedDelayedEffects: matured,
    bubbleLevel,
    crashOccurred: crashResult.occurred,
  }); // Step23

  const violations = checkInvariants(state); // Step24
  if (violations.length > 0) {
    const detail = violations.map((v) => `- [${v.key}] ${v.message}`).join("\n");
    throw new Error(`不変条件違反 (year=${state.currentYear}):\n${detail}`);
  }

  state.history.push(yearRecord); // Step25
  return yearRecord;
}
