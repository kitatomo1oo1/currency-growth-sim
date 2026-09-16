import type { GameState } from "../types";
import { clamp01 } from "./mathUtils";

/**
 * Lifecycle判定（§4）。暴落や一時的な休眠だけではゲームを終了させない。
 * DEADは「復活可能性を失った」と言える状態が複数年続いた場合のみ確定させる。
 */
export function updateLifecycle(state: GameState): void {
  const c = state.currency;
  const trustFactor = clamp01(
    (c.issuerTrust + c.technicalTrust + c.monetaryTrust + c.marketTrust + c.institutionalTrust) / 5
  );

  // merchantActivityRate/awarenessはEventのランダムな増減に左右されやすく、holdersが
  // 実際に消滅寸前まで縮んでいてもこれらだけが単独で高止まりすることがある。
  // 最も安定して「ほぼ誰にも使われていない」を表す絶対人数を主指標にする。
  const dormantCondition = c.regularUsers < 10 && c.holders < 50;
  const deadCandidateCondition = dormantCondition && trustFactor < 0.15 && c.holders < 10;

  state.flags["_deadStreak"] = deadCandidateCondition ? ((state.flags["_deadStreak"] as number) ?? 0) + 1 : 0;
  state.flags["_dormantStreak"] = dormantCondition ? ((state.flags["_dormantStreak"] as number) ?? 0) + 1 : 0;

  const deadStreak = (state.flags["_deadStreak"] as number) ?? 0;
  const dormantStreak = (state.flags["_dormantStreak"] as number) ?? 0;

  if (deadStreak >= 5) {
    c.lifecycle = "DEAD";
  } else if (c.regime === "STRESS" || c.crisisPressure > 0.5) {
    c.lifecycle = "STRESSED";
  } else if (dormantStreak >= 3) {
    c.lifecycle = "DORMANT";
  } else {
    c.lifecycle = "ACTIVE";
  }

  state.lifecycleState = c.lifecycle;
}
