import type { GameState, YearRecord } from "../types";
import { safeDiv } from "./mathUtils";

export interface TimelineMilestone {
  year: number;
  title: string;
  description: string;
}

/** §17: 最終画面向けの縦型タイムライン。最大約10個の主要節目を抽出する（後付け理由は作らない、Ledgerから導出）。 */
export function extractTimeline(state: GameState, maxMilestones = 10): TimelineMilestone[] {
  const history = state.history;
  if (history.length === 0) return [];

  const scored = history.map((r, i) => {
    let score = 0;
    if (r.crashOccurred) score += 10;

    const prev = i > 0 ? history[i - 1] : undefined;
    if (!prev || prev.bubbleLevel !== r.bubbleLevel) {
      if (r.bubbleLevel === "BUBBLE" || r.bubbleLevel === "EXTREME") score += 6;
    }
    if (!prev || prev.lifecycle !== r.lifecycle) score += 5;

    const priceChangeAbs = Math.abs(safeDiv(r.valueAfter - r.valueBefore, r.valueBefore));
    score += Math.min(5, priceChangeAbs * 8);

    const prevForeign = prev?.snapshot.foreignCountryCount ?? 0;
    if (prevForeign === 0 && r.snapshot.foreignCountryCount > 0) score += 6;

    score += r.events.reduce((sum, e) => sum + e.severity, 0);
    if (r.policies.length > 0) score += 2;

    return { record: r, score };
  });

  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxMilestones)
    .sort((a, b) => a.record.year - b.record.year);

  return top.map(({ record }) => buildMilestone(record));
}

function buildMilestone(r: YearRecord): TimelineMilestone {
  if (r.crashOccurred) {
    return { year: r.year, title: "価格が大きく下落した", description: "投機的な期待が急速に剥がれ落ちました" };
  }
  if (r.events.length > 0) {
    const topEvent = [...r.events].sort((a, b) => b.severity - a.severity)[0];
    return { year: r.year, title: topEvent.headline, description: describeMoveDirection(r) };
  }
  return { year: r.year, title: describeMoveDirection(r), description: `${r.lifecycle} / ${r.regime}` };
}

function describeMoveDirection(r: YearRecord): string {
  const change = safeDiv(r.valueAfter - r.valueBefore, r.valueBefore);
  if (change > 0.05) return "価格が上昇した";
  if (change < -0.05) return "価格が下落した";
  return "落ち着いた1年だった";
}

export interface FinalSummary {
  initialValue: number;
  finalValue: number;
  peakValue: number;
  maxDrawdown: number; // 0..1、ピークからの最大下落率
  holders: number;
  regularUsers: number;
  merchantCount: number;
  foreignCountryCount: number;
  currencyActivityVolume: number;
  lifespanYears: number;
  finalLifecycle: string;
}

export function buildFinalSummary(state: GameState): FinalSummary {
  const history = state.history;
  const c = state.currency;
  const initialValue = history[0]?.valueBefore ?? c.baseValue;

  let peak = initialValue;
  let maxDrawdown = 0;
  for (const r of history) {
    if (r.valueAfter > peak) peak = r.valueAfter;
    const drawdown = safeDiv(peak - r.valueAfter, peak);
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return {
    initialValue,
    finalValue: c.baseValue,
    peakValue: peak,
    maxDrawdown,
    holders: c.holders,
    regularUsers: c.regularUsers,
    merchantCount: c.merchantCount,
    foreignCountryCount: Object.values(c.foreignAdoption).filter((a) => a.activeUsers > 0).length,
    currencyActivityVolume: c.currencyActivityVolume,
    lifespanYears: state.currentYear - state.startYear,
    finalLifecycle: c.lifecycle,
  };
}

/** §53: 最終状態からの記述的分類。順位付け・優劣判定はしない。複合型を許可する。 */
export function classifyCurrencyType(state: GameState): string[] {
  const c = state.currency;
  const totalDemand = c.utilityDemand + c.savingDemand + c.speculativeDemand + c.foreignDemand || 1;
  const utilityShare = c.utilityDemand / totalDemand;
  const savingShare = c.savingDemand / totalDemand;
  const speculationShare = c.speculativeDemand / totalDemand;
  const foreignShare = c.foreignDemand / totalDemand;
  const foreignCountries = Object.values(c.foreignAdoption).filter((a) => a.activeUsers > 0).length;

  const types: string[] = [];
  if (c.lifecycle === "DEAD") types.push("衰退型");
  if (utilityShare > 0.45) types.push("日常決済型");
  if (foreignShare > 0.4 && foreignCountries >= 2) types.push("世界決済型");
  else if (foreignShare > 0.3 && foreignCountries >= 1) types.push("国際送金型");
  if (speculationShare > 0.4 && savingShare < 0.2) types.push("投機型");
  else if (savingShare > 0.35) types.push("投資資産型");
  if (types.length === 0) types.push("国内安定型");
  return Array.from(new Set(types));
}
