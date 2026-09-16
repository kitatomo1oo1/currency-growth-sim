import type { BubbleLevel, GameState } from "../../types";
import type { RngStream } from "../../seed";
import { average, clamp01, safeDiv } from "../mathUtils";
import { simulationConfig } from "../../config";

function classifyBubbleLevel(pressure: number): BubbleLevel {
  const t = simulationConfig.bubble.thresholds;
  if (pressure < t.NORMAL) return "NORMAL";
  if (pressure < t.WATCH) return "WATCH";
  if (pressure < t.HOT) return "HOT";
  if (pressure < t.BUBBLE) return "BUBBLE";
  return "EXTREME";
}

/**
 * Step19: Bubble / Crisis Pressure（§17-18）。単なる価格上昇ではなく、実需の伴わない上昇を検出する。
 * 同じ価格+200%でも実需成長+180%なら低いPressure、実需成長+2%なら高いPressureになる（§17の例）。
 */
export function updateBubbleAndCrisisPressure(
  state: GameState,
  prevFundamentalValue: number,
  prevUtilityDemand: number
): BubbleLevel {
  const c = state.currency;

  const valuationGap = safeDiv(c.baseValue - c.fundamentalValue, c.fundamentalValue || c.baseValue || 1);
  const valuationGapPositive = clamp01(valuationGap);

  const totalDemand = c.utilityDemand + c.savingDemand + c.speculativeDemand + c.foreignDemand;
  const speculationShare = clamp01(safeDiv(c.speculativeDemand, totalDemand + 1e-9));

  // 直近リターンの「変化量」ではなく「大きさそのもの」を見る。安定して急騰し続ける相場は
  // 前年比の差分こそ小さいが、明確にバブル的である(§17の指摘: 継続的な急騰を検出したい)。
  const r = c.returnHistory;
  const recentReturns = [r[r.length - 1] ?? 0, r[r.length - 2] ?? 0];
  const priceAcceleration = clamp01(average(recentReturns.map((x) => Math.abs(x))) * 2);

  const utilityGrowth = clamp01(safeDiv(c.utilityDemand - prevUtilityDemand, prevUtilityDemand || 1));
  void prevFundamentalValue;

  const socialHype = c.awareness;
  const illiquidity = 1 - c.liquidity;

  // valuationGapPositive(価格がファンダメンタルズよりどれだけ乖離しているか)を主因とし、
  // 投機シェアが高いほどその乖離を「バブルらしさ」として増幅する(§17の趣旨: 価格上昇+実需が
  // 伴わない乖離こそがBubble)。socialHype/illiquidity/priceAccelerationは補助的な加算項。
  const bubbleRaw = clamp01(
    valuationGapPositive * (0.55 + 0.45 * speculationShare) +
      0.2 * socialHype +
      0.15 * illiquidity +
      0.15 * priceAcceleration -
      0.3 * utilityGrowth
  );

  // 平滑化を0.5/0.5より反応早めにする。50%平滑だと持続的な過熱が何年続いてもBUBBLE閾値(0.7)へ
  // 収れんするのに10年以上かかり、Event由来の自然なノイズで途切れてしまいBubbleが実質発生しない。
  c.bubblePressure = clamp01(c.bubblePressure * 0.3 + bubbleRaw * 0.7);

  const trustFactor = clamp01(
    (c.issuerTrust + c.technicalTrust + c.monetaryTrust + c.marketTrust + c.institutionalTrust) / 5
  );
  const crisisRaw = clamp01(
    0.3 * (1 - trustFactor) +
      0.25 * state.world.globalCrisisPressure +
      0.2 * c.monetaryInstability +
      0.15 * c.redemptionPressure +
      0.1 * clamp01(-c.momentum)
  );
  c.crisisPressure = clamp01(c.crisisPressure * 0.6 + crisisRaw * 0.4);

  return classifyBubbleLevel(c.bubblePressure);
}

export interface CrashResult {
  occurred: boolean;
  severity: number;
}

/**
 * Step20: Endogenous events（Crashのトリガー判定）。§18の指示通り、固定イベントではなく
 * triggerRisk = bubblePressure × fragility × marketStress から確率的に発生させる。
 * Crash = Game Overにはしない（§18、§50）。日常利用は残りうる。
 */
export function evaluateCrash(state: GameState, marketRng: RngStream): CrashResult {
  const c = state.currency;
  const trustFactor = clamp01(
    (c.issuerTrust + c.technicalTrust + c.monetaryTrust + c.marketTrust + c.institutionalTrust) / 5
  );
  const fragility = clamp01(1 - trustFactor * 0.5 - c.liquidity * 0.5);
  const marketStress = c.crisisPressure;
  const triggerRisk = clamp01(c.bubblePressure * fragility * marketStress);

  if (!marketRng.chance(triggerRisk)) {
    return { occurred: false, severity: 0 };
  }

  const severity = marketRng.range(0.2, 0.5) * (0.5 + triggerRisk);
  const prevValue = c.baseValue;
  c.baseValue = Math.max(0.0001, c.baseValue * (1 - severity));

  const realizedReturn = safeDiv(c.baseValue - prevValue, prevValue);
  c.returnHistory[c.returnHistory.length - 1] = realizedReturn;

  c.speculationPotential = clamp01(c.speculationPotential * 0.5);
  c.momentum = c.momentum * 0.2;
  c.trustScar = clamp01(c.trustScar + 0.15 + severity * 0.2);
  c.marketTrust = clamp01(c.marketTrust - 0.1 - severity * 0.1);
  c.crisisPressure = clamp01(c.crisisPressure + 0.2);

  return { occurred: true, severity };
}
