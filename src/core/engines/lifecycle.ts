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

  // holdersの絶対数だけで判定すると、NATIONAL/GLOBAL規模で始めた通貨は初期人数が
  // 大きいため実質的に絶対死なない、という規模依存の不公平が生まれる。
  // ピーク時からの相対的な縮小で判定することで、どの規模で始めても
  // 「見捨てれば終わりうる」という緊張感を保つ。
  const peakHolders = Math.max((state.flags["_peakHolders"] as number) ?? 0, c.holders);
  state.flags["_peakHolders"] = peakHolders;

  // merchantActivityRate/awarenessはEventのランダムな増減に左右されやすく、holdersが
  // 実際に消滅寸前まで縮んでいてもこれらだけが単独で高止まりすることがある。
  // 最も安定して「ほぼ誰にも使われていない」を表す絶対人数を主指標にする。
  // §21の完成判定「通貨が完全にDEADとなり復活可能性を失った場合のみ50年未満で終了できる」を
  // 実際に到達しうるリスクにするため、閾値・継続年数は放置すれば現実的に起こる水準に調整している。
  const dormantCondition = c.regularUsers < 15 && c.holders < Math.max(80, peakHolders * 0.08);
  // 「見捨てられて終わる」には2つの経路がある。(1)信用崩壊: 使われなくなった上に信用も失った
  // 場合は数年で終わる。(2)忘却: 信用自体は崩れていなくても、誰にも使われない状態が長く
  // 続けば、いずれ存在自体が忘れられて終わる。トラスト崩壊だけを条件にすると、
  // 「嫌われてはいないが誰も使っていない」通貨がいつまでも終われない(trustFactorは
  // Trust Engineの目標値へ回帰するだけで、利用者数の少なさ自体には反応しないため)。
  const trustCollapseCandidate = dormantCondition && trustFactor < 0.25 && c.holders < Math.max(25, peakHolders * 0.03);

  state.flags["_deadStreak"] = trustCollapseCandidate ? ((state.flags["_deadStreak"] as number) ?? 0) + 1 : 0;
  state.flags["_dormantStreak"] = dormantCondition ? ((state.flags["_dormantStreak"] as number) ?? 0) + 1 : 0;

  const deadStreak = (state.flags["_deadStreak"] as number) ?? 0;
  const dormantStreak = (state.flags["_dormantStreak"] as number) ?? 0;
  const TRUST_COLLAPSE_DEAD_THRESHOLD = 3;
  const ABANDONMENT_DEAD_THRESHOLD = 10;

  if (deadStreak >= TRUST_COLLAPSE_DEAD_THRESHOLD || dormantStreak >= ABANDONMENT_DEAD_THRESHOLD) {
    c.lifecycle = "DEAD";
  } else if (c.regime === "STRESS" || c.crisisPressure > 0.5) {
    c.lifecycle = "STRESSED";
  } else if (dormantStreak >= 3) {
    c.lifecycle = "DORMANT";
  } else {
    c.lifecycle = "ACTIVE";
  }

  state.lifecycleState = c.lifecycle;
  // UIが警告表示に使う「消滅までの近さ」(0..1)。どちらの経路でも近い方を採用する。
  const trustCollapseRisk = deadStreak / TRUST_COLLAPSE_DEAD_THRESHOLD;
  const abandonmentRisk = dormantStreak / ABANDONMENT_DEAD_THRESHOLD;
  state.flags["_deadRisk"] = Math.min(1, Math.max(trustCollapseRisk, abandonmentRisk));
}
