import type { GameState, WorldConditionInstance } from "../types";
import type { RngStream } from "../seed";
import { clamp, clamp01 } from "./mathUtils";
import { simulationConfig } from "../config";

interface WorldConditionTemplate {
  id: string;
  label: string;
  durationRange: [number, number];
  apply: (world: GameState["world"]) => void;
}

// World Seedから生成される長期環境要因の原型（§28）。実在国の将来予測として扱わない。
const worldConditionTemplates: WorldConditionTemplate[] = [
  {
    id: "GROWTH",
    label: "世界的な好景気",
    durationRange: [3, 7],
    apply: (w) => {
      w.globalGrowth = clamp(w.globalGrowth + 0.35, -1, 1);
      w.globalRiskAppetite = clamp01(w.globalRiskAppetite + 0.15);
    },
  },
  {
    id: "LOW_GROWTH",
    label: "世界的な低成長",
    durationRange: [3, 8],
    apply: (w) => {
      w.globalGrowth = clamp(w.globalGrowth - 0.25, -1, 1);
    },
  },
  {
    id: "GLOBAL_INFLATION",
    label: "世界的な物価上昇局面",
    durationRange: [2, 5],
    apply: (w) => {
      w.globalInflationPressure = clamp01(w.globalInflationPressure + 0.3);
    },
  },
  {
    id: "FINANCIAL_CRISIS",
    label: "世界的な金融危機",
    durationRange: [1, 3],
    apply: (w) => {
      w.globalCrisisPressure = clamp01(w.globalCrisisPressure + 0.5);
      w.globalRiskAppetite = clamp01(w.globalRiskAppetite - 0.3);
    },
  },
  {
    id: "TECH_CHANGE",
    label: "決済技術の急速な進歩",
    durationRange: [2, 6],
    apply: (w) => {
      w.technologyLevel = clamp01(w.technologyLevel + 0.1);
    },
  },
  {
    id: "SUPPLY_SHOCK",
    label: "世界的な供給ショック",
    durationRange: [1, 3],
    apply: (w) => {
      w.globalInflationPressure = clamp01(w.globalInflationPressure + 0.2);
      w.globalGrowth = clamp(w.globalGrowth - 0.1, -1, 1);
    },
  },
  {
    id: "RISK_APPETITE_UP",
    label: "投資家のリスク選好上昇",
    durationRange: [2, 4],
    apply: (w) => {
      w.globalRiskAppetite = clamp01(w.globalRiskAppetite + 0.25);
    },
  },
];

export function updateWorld(state: GameState, worldRng: RngStream): void {
  const world = state.world;
  world.year = state.currentYear;

  // 既存Conditionの効果は継続年数に応じて緩やかに減衰させ、期限切れで除去する。
  world.activeConditions = world.activeConditions.filter((c) => c.endYear >= state.currentYear);

  // 平常時のドリフト（緩やかな平均回帰）
  world.globalGrowth = clamp(world.globalGrowth * 0.85, -1, 1);
  world.globalInflationPressure = clamp01(world.globalInflationPressure * 0.9 + 0.02);
  world.globalRiskAppetite = clamp01(world.globalRiskAppetite * 0.9 + 0.05);
  world.globalCrisisPressure = clamp01(world.globalCrisisPressure * 0.8);
  world.technologyLevel = clamp01(world.technologyLevel + simulationConfig.world.technologyGrowthPerYear);

  // 新規Condition発生判定（低確率、複数同時進行可）
  if (worldRng.chance(0.12)) {
    const template = worldConditionTemplates[worldRng.intRange(0, worldConditionTemplates.length - 1)];
    const duration = worldRng.intRange(template.durationRange[0], template.durationRange[1]);
    const instance: WorldConditionInstance = {
      id: template.id,
      startYear: state.currentYear,
      endYear: state.currentYear + duration,
    };
    world.activeConditions.push(instance);
  }

  // 現在進行中の全Conditionを毎年再適用（継続効果として）
  for (const active of world.activeConditions) {
    const template = worldConditionTemplates.find((t) => t.id === active.id);
    template?.apply(world);
  }
}
