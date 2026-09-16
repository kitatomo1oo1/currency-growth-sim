// 全てのバランス調整用定数をここへ集約する（§15指示: コード中に散在させない）。
// 数値は指示書に明記された初期Calibration値を採用し、未指定分は同系統の値から類推した初期値。

export const simulationConfig = {
  price: {
    // 0.28だと通常年の変動幅が中央値1.6%程度に収まり、あまり動いている実感がない
    // というフィードバックがあったため引き上げた(§15の初期値は目安であり調整対象)。
    sensitivity: 0.42,
    rangeByRegime: {
      NORMAL: { min: -0.35, max: 0.5 },
      SPECULATIVE: { min: -0.6, max: 1.2 },
      CRISIS: { min: -0.85, max: 0.6 },
    },
    weights: {
      // fundamentalGapを弱め、momentum/speculativeShareを強めることで、投機主導の
      // 価格上昇(バブル)がファンダメンタルズへの回帰圧力に即座に打ち消されないようにする。
      fundamentalGap: 0.2,
      momentum: 1.0,
      speculativeShare: 0.9,
      sellingPressure: 0.5,
    },
  },
  liquidity: {
    low: 0.3,
    high: 0.7,
    lowSensitivityMultiplier: 1.6,
    highSensitivityMultiplier: 0.7,
  },
  bubble: {
    thresholds: {
      NORMAL: 0.3,
      WATCH: 0.5,
      HOT: 0.7,
      BUBBLE: 0.85,
      // EXTREME は 0.85 以上
    } as const,
  },
  trust: {
    // 信用は急落後に大きく回復させない。trustScarが回復速度を継続的に減衰させる。
    naturalRecoveryRate: 0.03,
    scarRecoveryDamping: 0.6, // trustScar 1.0のとき回復速度を60%減衰
    scarDecayPerYear: 0.02,
  },
  monetaryInstability: {
    // Supply増 -> Inflation -> Trust低下 -> Velocity上昇 -> さらにTrust低下、の自己強化ループ強度
    spiralGain: 0.4,
    spiralDecay: 0.15,
  },
  inflation: {
    delayYears: 1, // Supply変化からInflationへ反映されるまでの遅延年
  },
  peg: {
    reserveRatioTarget: 1.0,
    redemptionPressureGainOnGap: 0.5,
    depegConfidenceThreshold: 0.2, // pegConfidenceがこれを下回るとdepeg許容
  },
  governance: {
    baseCapacity: 1.0,
    naturalRecoveryPerYear: 0.25,
    diminishingReturnFactor: 0.6, // 同一政策連打の逓減率
  },
  world: {
    technologyGrowthPerYear: 0.01,
  },
  behavior: {
    // utilityDemand = activeUsers * spending * usability * merchantCoverage * trustFactor * stabilityFactor
    baseSpendingPerActiveUser: 120,
  },
} as const;

export type SimulationConfig = typeof simulationConfig;
