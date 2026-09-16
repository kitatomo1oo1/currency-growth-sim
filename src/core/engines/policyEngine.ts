import type { EffectInstruction, GameState, LedgerDriver, LedgerPolicyEntry, PolicyDefinition } from "../types";
import { applyEffects } from "./effectApi";
import { evalPrerequisite } from "./eventEngine";
import { clamp01 } from "./mathUtils";
import { simulationConfig } from "../config";

function isPolicyEligible(state: GameState, policy: PolicyDefinition): boolean {
  if (policy.id === "NO_ACTION") return true;
  if (!policy.prerequisites.every((p) => evalPrerequisite(state, p))) return false;
  if (policy.forbiddenIf.some((p) => evalPrerequisite(state, p))) return false;
  return state.currency.governanceCapacity >= policy.cost;
}

/**
 * §36: 24政策全部ではなく状況に応じ最大4択を提示する。正解/おすすめの意味は持たせない。
 * スコア上位を単純に並べると、同じカテゴリの政策(例: 普及系が3つ)が並んでしまい、
 * 見た目上どれも同じ意味に見えて選ぶ意味が薄れる。カテゴリが異なる代表を優先することで、
 * 提示される選択肢の幅そのものを広げる（該当カテゴリが不足する場合のみ同カテゴリで埋める）。
 */
export function getAvailablePolicyChoices(
  state: GameState,
  allPolicies: PolicyDefinition[],
  maxChoices = 4
): PolicyDefinition[] {
  const noAction = allPolicies.find((p) => p.id === "NO_ACTION");
  const eligible = allPolicies.filter((p) => p.id !== "NO_ACTION" && isPolicyEligible(state, p));
  const scored = eligible.map((p) => ({ p, score: p.relevanceScore(state) })).sort((a, b) => b.score - a.score);

  const slotsNeeded = Math.max(0, maxChoices - 1);
  const picks: PolicyDefinition[] = [];
  const usedCategories = new Set<string>();

  // 1巡目: カテゴリごとの最高スコアだけを、カテゴリの重複なく拾う
  for (const { p } of scored) {
    if (picks.length >= slotsNeeded) break;
    if (usedCategories.has(p.category)) continue;
    picks.push(p);
    usedCategories.add(p.category);
  }

  // カテゴリの種類が足りない場合のみ、残り枠をスコア順で埋める(同カテゴリの重複を許容)
  if (picks.length < slotsNeeded) {
    for (const { p } of scored) {
      if (picks.length >= slotsNeeded) break;
      if (picks.includes(p)) continue;
      picks.push(p);
    }
  }

  return noAction ? [noAction, ...picks] : picks;
}

function scaleEffect(effect: EffectInstruction, factor: number): EffectInstruction {
  switch (effect.type) {
    case "ModifyTrust":
    case "ModifyAwareness":
    case "ModifyUtilityPotential":
    case "ModifySavingPotential":
    case "ModifySpeculationPotential":
    case "ModifyForeignPotential":
    case "ModifyLiquidity":
    case "ModifyMerchantPotential":
    case "ModifyGovernanceCapacity":
    case "ModifyPaymentEfficiency":
    case "ModifyDivisibility":
    case "ModifyFxExposure":
      return { ...effect, delta: effect.delta * factor };
    case "ModifySupply":
      return { ...effect, amountRatio: effect.amountRatio * factor };
    case "ModifyReserve":
      return { ...effect, amount: effect.amount * factor };
    case "AddTrustScar":
      return { ...effect, amount: effect.amount * factor };
    default:
      return effect;
  }
}

export interface ApplyPolicyResult {
  applied: boolean;
  reason?: string;
  ledgerEntry?: LedgerPolicyEntry;
  /** この判断が直接もたらした効果。世界の出来事と混ざる前の、選択そのものの結果。 */
  drivers: LedgerDriver[];
}

/**
 * 政策の適用。5年ターンの節目でプレイヤー（またはSimulation Runner）が選択した時点で1回だけ呼ぶ
 * （§39の年次25ステップには含まれない、ターンレベルのアクション）。
 * 同一政策の連打にはDiminishing Returnを適用する（§37）。
 */
export function applyPolicy(state: GameState, policyId: string, allPolicies: PolicyDefinition[]): ApplyPolicyResult {
  const policy = allPolicies.find((p) => p.id === policyId);
  if (!policy) return { applied: false, reason: `未定義の政策IDです: ${policyId}`, drivers: [] };

  if (policy.id === "NO_ACTION") {
    state.policySequence.push({ year: state.currentYear, policyId: policy.id });
    return { applied: true, ledgerEntry: { policyId: policy.id, label: policy.label }, drivers: [] };
  }

  if (!isPolicyEligible(state, policy)) {
    return { applied: false, reason: "現在の状態では実行できません（前提条件未達または運営体制の余力不足）", drivers: [] };
  }

  const useCountKey = `_policyUseCount_${policy.id}`;
  const useCount = (state.flags[useCountKey] as number) ?? 0;
  const diminishing = Math.pow(simulationConfig.governance.diminishingReturnFactor, useCount);

  const effects = policy.buildImmediateEffects().map((e) => scaleEffect(e, diminishing));
  const drivers = applyEffects(state, effects, state.currentYear);

  if (policy.buildDelayedEffects) {
    for (const de of policy.buildDelayedEffects(state.currentYear)) {
      const scaled = { ...de, effects: de.effects.map((e) => scaleEffect(e, diminishing)) };
      state.delayedEffects.push({ ...scaled, id: `de-${state.nextDelayedEffectSeq++}`, createdYear: state.currentYear });
    }
  }

  state.currency.governanceCapacity = clamp01(state.currency.governanceCapacity - policy.cost);
  state.flags[useCountKey] = useCount + 1;
  state.policySequence.push({ year: state.currentYear, policyId: policy.id });

  return { applied: true, ledgerEntry: { policyId: policy.id, label: policy.label }, drivers };
}

/** 運営体制の余力は毎年自然に回復する。 */
export function recoverGovernanceCapacity(state: GameState): void {
  state.currency.governanceCapacity = clamp01(
    state.currency.governanceCapacity + simulationConfig.governance.naturalRecoveryPerYear
  );
}
