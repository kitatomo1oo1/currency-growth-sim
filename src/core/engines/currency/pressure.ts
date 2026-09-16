import type { GameState } from "../../types";
import { clamp01 } from "../mathUtils";

/** Step10: Selling Pressure。下降モメンタム・信用低下・利確売りから形成。 */
export function updateSellingPressure(state: GameState): void {
  const c = state.currency;
  const trustFactor = clamp01(
    (c.issuerTrust + c.technicalTrust + c.monetaryTrust + c.marketTrust + c.institutionalTrust) / 5
  );
  const downMomentum = clamp01(-c.momentum);
  const profitTaking = c.bubblePressure * clamp01(c.momentum);
  // trustFactor=0.5(平均的)を基準に、それを下回った分だけ売り圧力へ寄与させる。
  // (1-trustFactor)のように常時ベースラインを持たせると、平均的な信用水準でも恒常的な
  // 下落圧力が生じてしまい、投機による価格上昇(Bubble)が原理的に起こり得なくなるため。
  const lowTrustPressure = clamp01(0.5 - trustFactor) * 2;

  c.sellingPressure = clamp01(0.45 * downMomentum + 0.25 * lowTrustPressure + 0.3 * profitTaking);
}
