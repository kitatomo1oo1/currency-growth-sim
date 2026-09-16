import type { EffectInstruction, GameState, LedgerDriver } from "../types";
import { clamp01 } from "./mathUtils";

/**
 * Effect APIの唯一の適用口。Event/Policy/DelayedEffectはこの関数を通してのみ
 * GameStateへ作用できる（個別ロジックで直接Stateを触らない、§38）。
 * GameStateを直接ミューテートし、生じた変化をLedgerDriverとして返す。
 */
export function applyEffect(state: GameState, effect: EffectInstruction, currentYear: number): LedgerDriver | null {
  const c = state.currency;

  switch (effect.type) {
    case "ModifyTrust": {
      const before = c[effect.component];
      const scarDamping = 1 - c.trustScar * 0.6;
      const applied = effect.delta > 0 ? effect.delta * Math.max(0.2, scarDamping) : effect.delta;
      c[effect.component] = clamp01(before + applied);
      return driver(effect.component, applied, trustLabel(effect.component));
    }
    case "ModifyAwareness": {
      const before = c.awareness;
      c.awareness = clamp01(before + effect.delta);
      return driver("awareness", effect.delta, "認知度");
    }
    case "ModifyUtilityPotential": {
      c.utilityPotential = clamp01(c.utilityPotential + effect.delta);
      return driver("utilityPotential", effect.delta, "実需ポテンシャル");
    }
    case "ModifySavingPotential": {
      c.savingPotential = clamp01(c.savingPotential + effect.delta);
      return driver("savingPotential", effect.delta, "貯蓄ポテンシャル");
    }
    case "ModifySpeculationPotential": {
      c.speculationPotential = clamp01(c.speculationPotential + effect.delta);
      return driver("speculationPotential", effect.delta, "投機ポテンシャル");
    }
    case "ModifyForeignPotential": {
      if (state.currencyDesign.exchangeRule === "CLOSED") return null;
      c.foreignPotential = clamp01(c.foreignPotential + effect.delta);
      return driver("foreignPotential", effect.delta, "海外需要ポテンシャル");
    }
    case "ModifyLiquidity": {
      c.liquidity = clamp01(c.liquidity + effect.delta);
      return driver("liquidity", effect.delta, "流動性");
    }
    case "ModifySupply": {
      if (state.currencyDesign.supplyRule === "FIXED") return null;
      const amount = c.totalSupply * effect.amountRatio;
      if (effect.kind === "mint") {
        c.totalSupply += amount;
        c.circulatingSupply += amount;
        // PEGGEDは新規発行分を準備資産で裏付ける(§27)。裏付けなしで発行し続けるとreserveRatioが
        // 経過年数だけで必然的にゼロへ向かってしまい、"危機"ではなく"確定した崩壊"になってしまうため。
        // 実際の危機は需給ギャップによるredemptionPressure経由の準備消耗(peg.ts)で表現する。
        if (state.currencyDesign.priceRule === "PEGGED") {
          const pegTarget = (state.flags["pegTargetValue"] as number) ?? c.baseValue;
          c.reserveAssets += amount * pegTarget;
        }
      } else {
        const burnAmount = Math.min(amount, c.circulatingSupply);
        c.circulatingSupply -= burnAmount;
        c.totalSupply -= burnAmount;
      }
      return driver("supply", effect.kind === "mint" ? effect.amountRatio : -effect.amountRatio, "通貨供給量");
    }
    case "ModifyMerchantPotential": {
      c.merchantPotential = clamp01(c.merchantPotential + effect.delta);
      return driver("merchantPotential", effect.delta, "加盟店ポテンシャル");
    }
    case "ModifyGovernanceCapacity": {
      c.governanceCapacity = clamp01(c.governanceCapacity + effect.delta);
      return driver("governanceCapacity", effect.delta, "運営体制の余力");
    }
    case "ModifyPaymentEfficiency": {
      c.paymentEfficiency = clamp01(c.paymentEfficiency + effect.delta);
      return driver("paymentEfficiency", effect.delta, "決済効率");
    }
    case "ModifyDivisibility": {
      c.divisibility = clamp01(c.divisibility + effect.delta);
      return driver("divisibility", effect.delta, "分割性");
    }
    case "ModifyFxExposure": {
      if (state.currencyDesign.exchangeRule === "CLOSED") return null;
      c.fxExposure = clamp01(c.fxExposure + effect.delta);
      return driver("fxExposure", effect.delta, "為替エクスポージャー");
    }
    case "ModifyReserve": {
      if (effect.kind === "add") {
        c.reserveAssets += effect.amount;
      } else {
        c.reserveAssets = Math.max(0, c.reserveAssets - effect.amount);
      }
      return driver("reserveAssets", effect.kind === "add" ? effect.amount : -effect.amount, "準備資産");
    }
    case "AddTrustScar": {
      c.trustScar = clamp01(c.trustScar + effect.amount);
      return driver("trustScar", effect.amount, "信用の傷跡");
    }
    case "AddDelayedEffect": {
      state.delayedEffects.push({
        ...effect.delayedEffect,
        id: `de-${state.nextDelayedEffectSeq++}`,
        createdYear: currentYear,
      });
      return null;
    }
    case "ModifyEventWeight": {
      state.eventWeightModifiers[effect.eventId] =
        (state.eventWeightModifiers[effect.eventId] ?? 1) * effect.multiplier;
      return null;
    }
    case "SetFlag": {
      state.flags[effect.key] = effect.value;
      return null;
    }
    default:
      return null;
  }
}

export function applyEffects(state: GameState, effects: EffectInstruction[], currentYear: number): LedgerDriver[] {
  const drivers: LedgerDriver[] = [];
  for (const effect of effects) {
    const d = applyEffect(state, effect, currentYear);
    if (d) drivers.push(d);
  }
  return drivers;
}

function driver(key: string, delta: number, label: string): LedgerDriver {
  return { key, label, magnitude: Math.abs(delta), direction: delta >= 0 ? "up" : "down" };
}

function trustLabel(component: string): string {
  const labels: Record<string, string> = {
    issuerTrust: "発行体への信用",
    technicalTrust: "技術的信用",
    monetaryTrust: "通貨としての信用",
    marketTrust: "市場からの信用",
    institutionalTrust: "制度的信用",
    policyCredibility: "政策の信頼性",
  };
  return labels[component] ?? component;
}
