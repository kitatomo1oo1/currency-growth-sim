import type { GameState, TrustComponent } from "../../types";
import { clamp01 } from "../mathUtils";
import { simulationConfig } from "../../config";

const TRUST_COMPONENTS: TrustComponent[] = [
  "issuerTrust",
  "technicalTrust",
  "monetaryTrust",
  "marketTrust",
  "institutionalTrust",
  "policyCredibility",
];

/**
 * Step18: Trust（内生ドリフト）。Event/Policyによる外生ショックはStep4で既に適用済みで、
 * ここでは価格安定性・危機圧力に応じた自然な信用の上下だけを扱う。
 * trustScarが大きいほど回復が遅くなる（§10「大きく壊れた翌年に簡単に全回復させない」）。
 */
export function updateTrustDrift(state: GameState): void {
  const c = state.currency;
  const cfg = simulationConfig.trust;

  const stabilityBonus = clamp01(1 - c.volatility) * 0.15;
  const crisisDrag = c.crisisPressure * 0.25;
  const target = clamp01(0.55 + stabilityBonus - crisisDrag);
  const scarDamp = Math.max(0.15, 1 - c.trustScar * cfg.scarRecoveryDamping);

  for (const component of TRUST_COMPONENTS) {
    const current = c[component];
    const diff = target - current;
    const rate = diff > 0 ? cfg.naturalRecoveryRate * scarDamp : cfg.naturalRecoveryRate * 1.5;
    c[component] = clamp01(current + diff * rate);
  }

  c.trustScar = clamp01(c.trustScar - cfg.scarDecayPerYear);
}
