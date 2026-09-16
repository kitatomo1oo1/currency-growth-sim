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
      return driver(effect.component, applied, trustLabel(effect.component, applied >= 0));
    }
    case "ModifyAwareness": {
      const before = c.awareness;
      c.awareness = clamp01(before + effect.delta);
      return driver("awareness", effect.delta, effect.delta >= 0 ? "話題になった" : "話題にならなくなった");
    }
    case "ModifyUtilityPotential": {
      c.utilityPotential = clamp01(c.utilityPotential + effect.delta);
      return driver("utilityPotential", effect.delta, effect.delta >= 0 ? "買い物で使う人が増えた" : "買い物での利用が減った");
    }
    case "ModifySavingPotential": {
      c.savingPotential = clamp01(c.savingPotential + effect.delta);
      return driver("savingPotential", effect.delta, effect.delta >= 0 ? "貯めておきたい人が増えた" : "貯める動機が薄れた");
    }
    case "ModifySpeculationPotential": {
      c.speculationPotential = clamp01(c.speculationPotential + effect.delta);
      return driver("speculationPotential", effect.delta, effect.delta >= 0 ? "値上がり狙いの資金が増えた" : "値上がり狙いの資金が引いた");
    }
    case "ModifyForeignPotential": {
      if (state.currencyDesign.exchangeRule === "CLOSED") return null;
      c.foreignPotential = clamp01(c.foreignPotential + effect.delta);
      return driver("foreignPotential", effect.delta, effect.delta >= 0 ? "海外から欲しい人が増えた" : "海外からの関心が薄れた");
    }
    case "ModifyLiquidity": {
      c.liquidity = clamp01(c.liquidity + effect.delta);
      return driver("liquidity", effect.delta, effect.delta >= 0 ? "取引しやすくなった" : "取引しにくくなった");
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
      return driver(
        "supply",
        effect.kind === "mint" ? effect.amountRatio : -effect.amountRatio,
        effect.kind === "mint" ? "通貨が新しく発行された" : "通貨の発行量が絞られた"
      );
    }
    case "ModifyMerchantPotential": {
      c.merchantPotential = clamp01(c.merchantPotential + effect.delta);
      return driver("merchantPotential", effect.delta, effect.delta >= 0 ? "使えるお店が増えた" : "使えるお店が減った");
    }
    case "ModifyGovernanceCapacity": {
      c.governanceCapacity = clamp01(c.governanceCapacity + effect.delta);
      return driver("governanceCapacity", effect.delta, effect.delta >= 0 ? "運営に余力が生まれた" : "運営の余力が減った");
    }
    case "ModifyPaymentEfficiency": {
      c.paymentEfficiency = clamp01(c.paymentEfficiency + effect.delta);
      return driver("paymentEfficiency", effect.delta, effect.delta >= 0 ? "支払いが速く便利になった" : "支払いの使い勝手が落ちた");
    }
    case "ModifyDivisibility": {
      c.divisibility = clamp01(c.divisibility + effect.delta);
      return driver("divisibility", effect.delta, effect.delta >= 0 ? "細かく分けて使えるようになった" : "細かく使いづらくなった");
    }
    case "ModifyFxExposure": {
      if (state.currencyDesign.exchangeRule === "CLOSED") return null;
      c.fxExposure = clamp01(c.fxExposure + effect.delta);
      return driver("fxExposure", effect.delta, effect.delta >= 0 ? "為替の影響を受けやすくなった" : "為替の影響が薄まった");
    }
    case "ModifyReserve": {
      if (effect.kind === "add") {
        c.reserveAssets += effect.amount;
      } else {
        c.reserveAssets = Math.max(0, c.reserveAssets - effect.amount);
      }
      return driver(
        "reserveAssets",
        effect.kind === "add" ? effect.amount : -effect.amount,
        effect.kind === "add" ? "いざという時の備えが増えた" : "いざという時の備えが減った"
      );
    }
    case "AddTrustScar": {
      c.trustScar = clamp01(c.trustScar + effect.amount);
      return driver("trustScar", effect.amount, effect.amount >= 0 ? "信用に傷がついた" : "信用の傷が和らいだ");
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

function trustLabel(component: string, positive: boolean): string {
  const labels: Record<string, [string, string]> = {
    issuerTrust: ["運営者を信じる人が増えた", "運営者への不安が広がった"],
    technicalTrust: ["仕組みへの安心感が増した", "仕組みへの不安が広がった"],
    monetaryTrust: ["お金として信じられるようになった", "お金としての信用が揺らいだ"],
    marketTrust: ["市場からの評価が上がった", "市場からの評価が下がった"],
    institutionalTrust: ["制度的な後ろ盾への信頼が増した", "制度的な後ろ盾への不安が出た"],
    policyCredibility: ["方針への信頼が増した", "方針への不信感が出た"],
  };
  const pair = labels[component];
  if (!pair) return component;
  return positive ? pair[0] : pair[1];
}
