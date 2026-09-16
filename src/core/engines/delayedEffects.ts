import type { EffectCondition, GameState, LedgerDelayedEntry, LedgerDriver } from "../types";
import { applyEffects } from "./effectApi";

function readConditionValue(state: GameState, condition: EffectCondition): number | string {
  if (condition.key === "worldCrisis") return state.world.globalCrisisPressure;
  if (condition.key === "regime") return state.currency.regime;
  const value = state.currency[condition.key];
  return value as number | string;
}

function evaluateCondition(state: GameState, condition: EffectCondition): boolean {
  const actual = readConditionValue(state, condition);
  const expected = condition.value;
  if (typeof actual === "string" || typeof expected === "string") {
    return condition.op === "eq" ? actual === expected : actual !== expected;
  }
  switch (condition.op) {
    case "lt":
      return actual < (expected as number);
    case "lte":
      return actual <= (expected as number);
    case "gt":
      return actual > (expected as number);
    case "gte":
      return actual >= (expected as number);
    case "eq":
      return actual === (expected as number);
    default:
      return false;
  }
}

/**
 * Step3: Mature delayed effects。過去の判断が未来へ影響する仕組みの中核（§34）。
 * cancelConditionsのいずれかが真なら効果を適用せずキャンセル扱いにする。
 */
export interface DelayedEffectMaturationResult {
  matured: LedgerDelayedEntry[];
  drivers: LedgerDriver[];
}

export function matureDelayedEffects(state: GameState): DelayedEffectMaturationResult {
  const matured: LedgerDelayedEntry[] = [];
  const drivers: LedgerDriver[] = [];
  const remaining = [];

  for (const de of state.delayedEffects) {
    if (de.cancelled) continue;
    if (de.triggerYear > state.currentYear) {
      remaining.push(de);
      continue;
    }

    const cancelled = (de.cancelConditions ?? []).some((cond) => evaluateCondition(state, cond));
    if (!cancelled) {
      const modified = (de.modifyConditions ?? []).some((cond) => evaluateCondition(state, cond));
      drivers.push(...applyEffects(state, de.effects, state.currentYear));
      matured.push({ sourceId: de.sourceId, sourceLabel: de.sourceLabel, sourceType: de.sourceType, createdYear: de.createdYear });
      void modified; // modifyConditionsは将来の拡張余地として保持（初版では発火可否のみ判定）
    }
    // triggerYearに到達したものは適用可否に関わらずキューから除去する
  }

  state.delayedEffects = remaining;
  return { matured, drivers };
}
