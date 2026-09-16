import type { EffectInstruction, TrustComponent } from "../types";

// Event/Policyの効果記述を簡潔にするための小さなDSL。severity(0..1)でスケールする値はs引数を使う。
export const trust = (component: TrustComponent, amount: number): EffectInstruction => ({
  type: "ModifyTrust",
  component,
  delta: amount,
});
export const awareness = (amount: number): EffectInstruction => ({ type: "ModifyAwareness", delta: amount });
export const utilityPotential = (amount: number): EffectInstruction => ({ type: "ModifyUtilityPotential", delta: amount });
export const savingPotential = (amount: number): EffectInstruction => ({ type: "ModifySavingPotential", delta: amount });
export const speculationPotential = (amount: number): EffectInstruction => ({
  type: "ModifySpeculationPotential",
  delta: amount,
});
export const foreignPotential = (amount: number): EffectInstruction => ({ type: "ModifyForeignPotential", delta: amount });
export const merchantPotential = (amount: number): EffectInstruction => ({ type: "ModifyMerchantPotential", delta: amount });
export const liquidity = (amount: number): EffectInstruction => ({ type: "ModifyLiquidity", delta: amount });
export const governance = (amount: number): EffectInstruction => ({ type: "ModifyGovernanceCapacity", delta: amount });
export const paymentEfficiency = (amount: number): EffectInstruction => ({ type: "ModifyPaymentEfficiency", delta: amount });
export const divisibility = (amount: number): EffectInstruction => ({ type: "ModifyDivisibility", delta: amount });
export const fxExposure = (amount: number): EffectInstruction => ({ type: "ModifyFxExposure", delta: amount });
export const trustScar = (amount: number): EffectInstruction => ({ type: "AddTrustScar", amount });
export const mint = (ratio: number): EffectInstruction => ({ type: "ModifySupply", kind: "mint", amountRatio: ratio });
export const burn = (ratio: number): EffectInstruction => ({ type: "ModifySupply", kind: "burn", amountRatio: ratio });
export const reserve = (kind: "add" | "remove", amount: number): EffectInstruction => ({
  type: "ModifyReserve",
  kind,
  amount,
});
export const setFlag = (key: string, value: boolean | number): EffectInstruction => ({ type: "SetFlag", key, value });
