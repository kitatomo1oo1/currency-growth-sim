import type { GameState } from "../../types";
import { clamp, safeDiv } from "../mathUtils";

/**
 * Step11: Supply。SupplyRuleごとの自動増減を処理し、供給成長率を返す（Step15 Inflationで使用）。
 * FIXEDはPolicy/Eventからの増減も effectApi 側で遮断済み（仕様監査 §7-3）。
 * FLEXIBLEは自動変化を持たず、Policy/EventのModifySupplyのみで変化する。
 */
/**
 * PEGGEDは新規発行分を準備資産で裏付ける(§27)。effectApi.ts の ModifySupply(mint)と同じ理由で、
 * ここ(GRADUAL/AUTOMATICの自動発行経路)でも同様に適用しないと、自動増発だけがreserveRatioを
 * 際限なく希薄化させてしまい、"危機"ではなく時間経過だけで確定する崩壊になってしまう。
 */
function mintWithPegBacking(state: GameState, amount: number): void {
  const c = state.currency;
  c.totalSupply += amount;
  c.circulatingSupply += amount;
  if (state.currencyDesign.priceRule === "PEGGED" && amount > 0) {
    const pegTarget = (state.flags["pegTargetValue"] as number) ?? c.baseValue;
    c.reserveAssets += amount * pegTarget;
  }
}

export function updateSupply(state: GameState): number {
  const c = state.currency;
  const design = state.currencyDesign;
  const prevTotalSupply = c.totalSupply;

  switch (design.supplyRule) {
    case "GRADUAL": {
      const growthRate = 0.03;
      const minted = c.totalSupply * growthRate;
      mintWithPegBacking(state, minted);
      break;
    }
    case "AUTOMATIC": {
      // 擬似アルゴリズム的供給調整: 市場価格がファンダメンタルズを上回れば拡張、下回れば縮小
      const gap = safeDiv(c.baseValue - c.fundamentalValue, c.fundamentalValue || c.baseValue || 1);
      const adjust = clamp(gap * 0.5, -0.05, 0.05);
      const amount = c.totalSupply * adjust;
      if (amount >= 0) {
        mintWithPegBacking(state, amount);
      } else {
        const burn = Math.min(-amount, c.circulatingSupply);
        c.circulatingSupply -= burn;
        c.totalSupply -= burn;
      }
      break;
    }
    case "FIXED":
    case "FLEXIBLE":
    default:
      break; // 変化なし（FLEXIBLEはPolicy経由のみ、既にStep4で反映済み）
  }

  return safeDiv(c.totalSupply - prevTotalSupply, prevTotalSupply);
}
