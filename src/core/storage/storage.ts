import type { GameState } from "../types";
import { GAME_STATE_VERSION } from "../state/version";

export const STORAGE_KEY = "currency-growth-sim:gameState";

export interface SaveResult {
  success: boolean;
  error?: string;
}

/** §55: 重要操作後にlocalStorageへ自動保存する。 */
export function saveGameState(state: GameState): SaveResult {
  try {
    const json = JSON.stringify(state);
    window.localStorage.setItem(STORAGE_KEY, json);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** version不一致時のMigrationフック。現状はv1.0.0のみのため通すだけ。 */
function migrateGameState(state: GameState): GameState {
  if (state.version !== GAME_STATE_VERSION) {
    return { ...state, version: GAME_STATE_VERSION };
  }
  return state;
}

export function loadGameState(): GameState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    return migrateGameState(parsed);
  } catch {
    return null;
  }
}

export function clearGameState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}

export function hasSavedGame(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
