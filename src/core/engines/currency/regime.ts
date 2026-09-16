import type { GameState } from "../../types";

/** Step21: Market Regime。年数ではなくStateから判定する（§29）。 */
export function updateMarketRegime(state: GameState): void {
  const c = state.currency;

  // SPECULATIVEへ入る閾値はBUBBLE分類(0.7)より低く設定する。そうしないと「SPECULATIVE regimeの
  // 広い価格レンジ」が使えないままbubblePressureが頭打ちになり、Bubbleが原理的に発生し得なくなるため
  // （価格レンジ拡大→価格上昇→Bubble Pressure上昇→レンジ拡大、という起動の芽を潰さない）。
  const enteringSpeculative =
    c.bubblePressure > 0.35 || (c.momentum > 0.3 && c.speculativeDemand > c.utilityDemand);

  if (c.crisisPressure > 0.55) {
    c.regime = "STRESS";
    state.flags["_lastStressYear"] = state.currentYear;
    return;
  }

  // crisisPressureは徐々にしか下がらないため(平滑化)、STRESS(>0.55)から一気にRECOVERY条件(<0.35)
  // の年へ移ることは稀で、多くの場合その中間(0.35〜0.55)の年を経由する。「直前の年がSTRESSだったか」
  // だけを見ると、その中間年を挟んだ時点でRECOVERYへ一切到達できなくなるため、直近数年以内に
  // STRESSだった記憶を残しておく。
  const lastStressYear = (state.flags["_lastStressYear"] as number) ?? -999;
  const recentlyStressed = state.currentYear - lastStressYear <= 5;

  if (recentlyStressed && c.crisisPressure < 0.35) {
    c.regime = "RECOVERY";
  } else if (enteringSpeculative) {
    c.regime = "SPECULATIVE";
  } else if (c.momentum > 0.2) {
    c.regime = "GROWTH";
  } else if (c.momentum < -0.25) {
    c.regime = "DECLINE";
  } else {
    c.regime = "STABLE";
  }
}
