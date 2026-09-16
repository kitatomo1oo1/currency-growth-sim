import type { GameState } from "../types";

function unlock(state: GameState, topic: string): void {
  if (!state.learnedTopics.includes(topic)) state.learnedTopics.push(topic);
}

/**
 * Step22: Learning detection。ユーザーが実際に体験した概念だけを解放する（§42）。
 * イベント側でも learningTopics 経由で解放されるが、ここでは価格変動そのものから生じる
 * 基礎的な概念（需要と供給、インフレ等）を検出する。
 */
export function detectLearning(state: GameState, realizedReturn: number): void {
  const c = state.currency;

  if (state.currentYear > state.startYear) {
    unlock(state, "需要と供給");
  }

  if (Math.abs(realizedReturn) > 0.001) {
    unlock(state, "通貨供給");
  }
  if (c.inflationPressure > 0.4) unlock(state, "インフレ");
  if (c.deflationPressure > 0.4) unlock(state, "デフレ");
  if (c.bubblePressure > 0.7) unlock(state, "バブル");
  if (c.liquidity < 0.3) unlock(state, "流動性");
  if (c.trustScar > 0.05) unlock(state, "信用");
  if (state.currencyDesign.priceRule === "PEGGED") unlock(state, "固定価格");
  if (c.redemptionPressure > 0.4) unlock(state, "ペッグ危機");

  const foreignCountryCount = Object.values(c.foreignAdoption).filter((a) => a.activeUsers > 0).length;
  if (c.fxExposure > 0.15 && foreignCountryCount > 0) {
    unlock(state, "為替");
    if (realizedReturn > 0.05) unlock(state, "通貨高");
    if (realizedReturn < -0.05) unlock(state, "通貨安");
  }
}

export function unlockCrash(state: GameState): void {
  unlock(state, "暴落");
  unlock(state, "バブル");
}
