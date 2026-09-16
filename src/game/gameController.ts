import type { CurrencyDesign, GameState, LedgerDriver, LedgerPolicyEntry, PolicyDefinition, YearRecord } from "../core/types";
import { createInitialGameState } from "../core/state/initialState";
import { processYear } from "../core/engines/yearProcessor";
import { allEvents } from "../core/data/events";
import { allPolicies } from "../core/data/policies";
import { getAvailablePolicyChoices, applyPolicy } from "../core/engines/policyEngine";
import { saveGameState, loadGameState, clearGameState, hasSavedGame } from "../core/storage/storage";

const TURN_LENGTH_YEARS = 5;

function generateMasterSeed(): string {
  // Math.random()はEconomic Core内では使用しないが、ゲーム開始時の初期Seed生成はUI層の乱数でよい
  // （プレイヤーには見えず、以後は完全にSeedから決定的に進行するため再現性には影響しない）。
  return `seed-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function startNewGame(design: CurrencyDesign, startYear = 2026): GameState {
  const state = createInitialGameState(design, generateMasterSeed(), startYear, 50);
  saveGameState(state);
  return state;
}

export function loadContinuedGame(): GameState | null {
  return loadGameState();
}

export function hasContinuableGame(): boolean {
  return hasSavedGame();
}

export function abandonSavedGame(): void {
  clearGameState();
}

export function isGameOver(state: GameState): boolean {
  return state.currentYear >= state.maxYear || state.currency.lifecycle === "DEAD";
}

export function getPolicyChoices(state: GameState): PolicyDefinition[] {
  return getAvailablePolicyChoices(state, allPolicies, 4);
}

export interface TurnResult {
  state: GameState;
  yearRecords: YearRecord[];
  gameOver: boolean;
  /** 選んだ政策そのものが直接もたらした効果。世界の出来事と混ざる前の結果を単独で見せるため。 */
  policyChosenLabel: string;
  policyEffectDrivers: LedgerDriver[];
}

/**
 * 5年ターンを1つ進める。policyIdが与えられればターン最初の年に適用する（誕生直後の最初のターンはNO_ACTION）。
 * DEADに至った場合やmaxYearに達した場合はその時点で打ち切る。
 */
export function advanceTurn(state: GameState, policyId: string): TurnResult {
  const applyResult = applyPolicy(state, policyId, allPolicies);
  const policyEntries: LedgerPolicyEntry[] = applyResult.applied && applyResult.ledgerEntry ? [applyResult.ledgerEntry] : [];

  const yearRecords: YearRecord[] = [];
  for (let i = 0; i < TURN_LENGTH_YEARS; i++) {
    if (isGameOver(state)) break;
    state.currentYear += 1;
    const record = processYear(state, allEvents, i === 0 ? policyEntries : []);
    yearRecords.push(record);
  }

  saveGameState(state);

  return {
    state,
    yearRecords,
    gameOver: isGameOver(state),
    policyChosenLabel: applyResult.ledgerEntry?.label ?? "",
    policyEffectDrivers: applyResult.drivers,
  };
}

export function getAllPolicies(): PolicyDefinition[] {
  return allPolicies;
}
