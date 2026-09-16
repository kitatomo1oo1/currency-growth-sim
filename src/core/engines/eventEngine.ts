import type { EventDefinition, EventPrerequisite, GameState, LedgerDriver, LedgerEventEntry } from "../types";
import type { RngStream } from "../seed";
import { applyEffects } from "./effectApi";

function readPrereqValue(state: GameState, key: EventPrerequisite["key"]): number | string | boolean {
  if (key === "hasForeignAdoption") return Object.keys(state.currency.foreignAdoption).length > 0;
  if (key === "regime") return state.currency.regime;
  if (key === "lifecycle") return state.currency.lifecycle;
  if (key === "exchangeRule") return state.currencyDesign.exchangeRule;
  if (key === "supplyRule") return state.currencyDesign.supplyRule;
  if (key === "priceRule") return state.currencyDesign.priceRule;
  if (key === "issuerType") return state.currencyDesign.issuerType;
  if (key === "launchScale") return state.currencyDesign.launchScale;
  return state.currency[key] as number;
}

export function evalPrerequisite(state: GameState, p: EventPrerequisite): boolean {
  const actual = readPrereqValue(state, p.key);
  if (typeof actual === "boolean" || typeof p.value === "boolean") {
    return p.op === "eq" ? actual === p.value : actual !== p.value;
  }
  if (typeof actual === "string" || typeof p.value === "string") {
    return p.op === "eq" ? actual === p.value : actual !== p.value;
  }
  switch (p.op) {
    case "lt":
      return actual < p.value;
    case "lte":
      return actual <= p.value;
    case "gt":
      return actual > p.value;
    case "gte":
      return actual >= p.value;
    case "eq":
      return actual === p.value;
    case "neq":
      return actual !== p.value;
    default:
      return false;
  }
}

function isEligible(state: GameState, ev: EventDefinition): boolean {
  if (!ev.repeatable && state.flags[`_eventFired_${ev.id}`]) return false;
  if ((state.eventCooldowns[ev.id] ?? 0) > state.currentYear) return false;
  if (ev.conflictTags.some((tag) => (state.activeConflictTags[tag] ?? 0) > state.currentYear)) return false;
  if (!ev.prerequisites.every((p) => evalPrerequisite(state, p))) return false;
  if (ev.forbiddenIf.some((p) => evalPrerequisite(state, p))) return false;
  return true;
}

/** Recent Category Penalty（§33）: 同じカテゴリのニュースが連発しないよう重みを逓減させる。完全禁止はしない。 */
function effectiveWeight(state: GameState, ev: EventDefinition): number {
  let weight = Math.max(0, ev.baseWeight * (state.eventWeightModifiers[ev.id] ?? 1));
  const recent = state.recentEventCategories[ev.category];
  if (recent && state.currentYear - recent.lastYear <= 2) {
    weight *= Math.pow(0.55, recent.count);
  }
  return Math.max(0.03, weight);
}

function removeConflicting(pool: EventDefinition[], picked: EventDefinition): EventDefinition[] {
  return pool.filter((ev) => ev.id !== picked.id && !ev.conflictTags.some((t) => picked.conflictTags.includes(t)));
}

/**
 * Step4: External events。60イベント原型から、当年の状態に合致するものを重み付き抽選し
 * Effect API経由でのみStateへ作用させる（§32-33）。矛盾するイベントの同時発生をconflictTagsで防ぐ。
 */
export interface EventSelectionResult {
  entries: LedgerEventEntry[];
  drivers: LedgerDriver[];
}

export function selectAndApplyEvents(
  state: GameState,
  eventRng: RngStream,
  allEvents: EventDefinition[]
): EventSelectionResult {
  let pool = allEvents.filter((ev) => isEligible(state, ev));
  const count = eventRng.intRange(1, 3);
  const chosen: EventDefinition[] = [];

  for (let i = 0; i < count && pool.length > 0; i++) {
    const weighted = pool.map((ev) => ({ item: ev, weight: effectiveWeight(state, ev) }));
    const pick = eventRng.weightedPick(weighted);
    if (!pick) break;
    chosen.push(pick);
    pool = removeConflicting(pool, pick);
  }

  const entries: LedgerEventEntry[] = [];
  const drivers: LedgerDriver[] = [];
  for (const ev of chosen) {
    const severity = eventRng.range(ev.severityRange.min, ev.severityRange.max);
    const effects = ev.buildImmediateEffects(severity);
    drivers.push(...applyEffects(state, effects, state.currentYear));

    if (ev.buildDelayedEffects) {
      for (const de of ev.buildDelayedEffects(severity, state.currentYear)) {
        state.delayedEffects.push({ ...de, id: `de-${state.nextDelayedEffectSeq++}`, createdYear: state.currentYear });
      }
    }

    state.eventCooldowns[ev.id] = state.currentYear + ev.cooldownYears;
    const recent = state.recentEventCategories[ev.category] ?? { count: 0, lastYear: -999 };
    recent.count = state.currentYear - recent.lastYear <= 2 ? recent.count + 1 : 1;
    recent.lastYear = state.currentYear;
    state.recentEventCategories[ev.category] = recent;
    for (const tag of ev.conflictTags) {
      state.activeConflictTags[tag] = state.currentYear + Math.max(1, ev.cooldownYears);
    }
    if (!ev.repeatable) {
      state.flags[`_eventFired_${ev.id}`] = true;
    }
    for (const topic of ev.learningTopics) {
      if (!state.learnedTopics.includes(topic)) state.learnedTopics.push(topic);
    }

    entries.push({ eventId: ev.id, label: ev.label, category: ev.category, severity, headline: ev.textTemplate });
  }

  return { entries, drivers };
}
