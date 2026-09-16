import type { EffectInstruction, EventPrerequisite, GameState, PolicyCategory, PolicyDefinition } from "../types";
import {
  awareness,
  burn,
  foreignPotential,
  liquidity,
  mint,
  merchantPotential,
  paymentEfficiency,
  savingPotential,
  speculationPotential,
  trust,
  trustScar,
  utilityPotential,
} from "./eventHelpers";

interface PolicySpec {
  id: string;
  category: PolicyCategory;
  label: string;
  description: string;
  cost: number;
  prereq?: EventPrerequisite[];
  forbidden?: EventPrerequisite[];
  effects: EffectInstruction[];
  relevance: (state: GameState) => number;
}

function definePolicy(spec: PolicySpec): PolicyDefinition {
  return {
    id: spec.id,
    category: spec.category,
    label: spec.label,
    description: spec.description,
    cost: spec.cost,
    prerequisites: spec.prereq ?? [],
    forbiddenIf: spec.forbidden ?? [],
    buildImmediateEffects: () => spec.effects,
    relevanceScore: spec.relevance,
  };
}

const FIXED_SUPPLY_FORBIDDEN: EventPrerequisite = { key: "supplyRule", op: "eq", value: "FIXED" };
const CLOSED_EXCHANGE_FORBIDDEN: EventPrerequisite = { key: "exchangeRule", op: "eq", value: "CLOSED" };

export const allPolicies: PolicyDefinition[] = [
  definePolicy({
    id: "NO_ACTION",
    category: "NONE",
    label: "現状維持",
    description: "今は何もしない",
    cost: 0,
    effects: [],
    relevance: () => 0.1,
  }),

  // ---- 供給 (SUPPLY) ----
  definePolicy({
    id: "supply_small_issuance",
    category: "SUPPLY",
    label: "小規模追加発行",
    description: "少しだけ通貨を追加で発行する",
    cost: 0.15,
    forbidden: [FIXED_SUPPLY_FORBIDDEN],
    effects: [mint(0.05)],
    relevance: (s) => (s.currency.liquidity < 0.4 ? 0.6 : 0.3),
  }),
  definePolicy({
    id: "supply_large_issuance",
    category: "SUPPLY",
    label: "大規模追加発行",
    description: "まとまった量の通貨を追加で発行する",
    cost: 0.3,
    forbidden: [FIXED_SUPPLY_FORBIDDEN],
    effects: [mint(0.15), trust("monetaryTrust", -0.02)],
    relevance: (s) => (s.currency.deflationPressure > 0.4 ? 0.7 : 0.25),
  }),
  definePolicy({
    id: "supply_restraint",
    category: "SUPPLY",
    label: "発行抑制",
    description: "通貨の発行量を絞る",
    cost: 0.15,
    forbidden: [FIXED_SUPPLY_FORBIDDEN],
    effects: [burn(0.03), trust("monetaryTrust", 0.02)],
    relevance: (s) => s.currency.inflationPressure,
  }),
  definePolicy({
    id: "supply_automation_tuning",
    category: "SUPPLY",
    label: "自動供給の調整",
    description: "アルゴリズムによる自動供給の挙動を見直す",
    cost: 0.1,
    prereq: [{ key: "supplyRule", op: "eq", value: "AUTOMATIC" }],
    effects: [trust("technicalTrust", 0.03), paymentEfficiency(0.02)],
    relevance: (s) => (s.currencyDesign.supplyRule === "AUTOMATIC" ? 0.4 : 0),
  }),

  // ---- 普及 (ADOPTION) ----
  definePolicy({
    id: "adoption_merchant_support",
    category: "ADOPTION",
    label: "加盟店支援",
    description: "加盟店の導入を支援する",
    cost: 0.15,
    effects: [merchantPotential(0.08)],
    relevance: (s) => 1 - s.currency.merchantPotential,
  }),
  definePolicy({
    id: "adoption_ecommerce_boost",
    category: "ADOPTION",
    label: "EC強化",
    description: "ネットショッピングでの利用を強化する",
    cost: 0.15,
    effects: [utilityPotential(0.05), foreignPotential(0.02)],
    relevance: (s) => (s.currencyDesign.useCases.includes("ECOMMERCE") ? 0.6 : 0.3),
  }),
  definePolicy({
    id: "adoption_payroll_use",
    category: "ADOPTION",
    label: "給与利用",
    description: "給与の一部として利用できるようにする",
    cost: 0.2,
    effects: [utilityPotential(0.06), savingPotential(0.03)],
    relevance: (s) => (s.currencyDesign.useCases.includes("PAYROLL") ? 0.6 : 0.25),
  }),
  definePolicy({
    id: "adoption_daily_use_promotion",
    category: "ADOPTION",
    label: "日常利用促進",
    description: "日常の支払いでの利用を後押しする",
    cost: 0.15,
    effects: [utilityPotential(0.07), awareness(0.03)],
    relevance: (s) => (s.currency.utilityDemand < s.currency.speculativeDemand ? 0.6 : 0.35),
  }),

  // ---- 信用 (TRUST) ----
  definePolicy({
    id: "trust_disclosure",
    category: "TRUST",
    label: "情報公開",
    description: "運営状況の情報公開を強化する",
    cost: 0.1,
    effects: [trust("institutionalTrust", 0.04), trust("policyCredibility", 0.03)],
    relevance: (s) => 1 - s.currency.institutionalTrust,
  }),
  definePolicy({
    id: "trust_external_audit",
    category: "TRUST",
    label: "外部監査",
    description: "第三者による外部監査を導入する",
    cost: 0.2,
    effects: [trust("technicalTrust", 0.05), trust("institutionalTrust", 0.03)],
    relevance: (s) => 1 - s.currency.technicalTrust,
  }),
  definePolicy({
    id: "trust_security_strengthening",
    category: "TRUST",
    label: "セキュリティ強化",
    description: "システムのセキュリティを強化する",
    cost: 0.2,
    effects: [trust("technicalTrust", 0.06), paymentEfficiency(0.01)],
    relevance: (s) => s.currency.trustScar,
  }),
  definePolicy({
    id: "trust_issuance_rule_clarification",
    category: "TRUST",
    label: "発行ルール明確化",
    description: "発行に関するルールを明確化する",
    cost: 0.15,
    effects: [trust("policyCredibility", 0.05), trust("issuerTrust", 0.03)],
    relevance: (s) => 1 - s.currency.policyCredibility,
  }),

  // ---- 市場 (MARKET) ----
  definePolicy({
    id: "market_liquidity_provision",
    category: "MARKET",
    label: "流動性供給",
    description: "市場に流動性を供給する",
    cost: 0.2,
    effects: [liquidity(0.08)],
    relevance: (s) => 1 - s.currency.liquidity,
  }),
  definePolicy({
    id: "market_speculation_curb",
    category: "MARKET",
    label: "投機抑制",
    description: "投機的な動きを抑える",
    cost: 0.2,
    effects: [speculationPotential(-0.08), trust("marketTrust", 0.02)],
    relevance: (s) => s.currency.bubblePressure,
  }),
  definePolicy({
    id: "market_exchange_liberalization",
    category: "MARKET",
    label: "交換自由化",
    description: "他通貨との交換をしやすくする",
    cost: 0.15,
    forbidden: [{ key: "exchangeRule", op: "eq", value: "OPEN" }],
    effects: [liquidity(0.06), foreignPotential(0.02)],
    relevance: (s) => (s.currencyDesign.exchangeRule === "LIMITED" ? 0.5 : 0.2),
  }),
  definePolicy({
    id: "market_exchange_restriction",
    category: "MARKET",
    label: "交換制限",
    description: "他通貨との交換に制限をかける",
    cost: 0.15,
    forbidden: [CLOSED_EXCHANGE_FORBIDDEN],
    effects: [liquidity(-0.06), trust("institutionalTrust", 0.02)],
    relevance: (s) => s.currency.crisisPressure,
  }),

  // ---- 国際 (INTERNATIONAL) ----
  definePolicy({
    id: "intl_overseas_expansion",
    category: "INTERNATIONAL",
    label: "海外進出",
    description: "海外での利用拡大を目指す",
    cost: 0.25,
    forbidden: [CLOSED_EXCHANGE_FORBIDDEN],
    effects: [foreignPotential(0.1), awareness(0.03)],
    relevance: (s) => (s.currencyDesign.launchScale === "GLOBAL" ? 0.6 : 0.3),
  }),
  definePolicy({
    id: "intl_remittance_support",
    category: "INTERNATIONAL",
    label: "国際送金対応",
    description: "国際送金での利用を後押しする",
    cost: 0.2,
    forbidden: [CLOSED_EXCHANGE_FORBIDDEN],
    effects: [foreignPotential(0.06), utilityPotential(0.03)],
    relevance: (s) => (s.currencyDesign.useCases.includes("REMITTANCE") ? 0.6 : 0.25),
  }),
  definePolicy({
    id: "intl_overseas_corporate_partnership",
    category: "INTERNATIONAL",
    label: "海外企業連携",
    description: "海外企業との連携を進める",
    cost: 0.2,
    forbidden: [CLOSED_EXCHANGE_FORBIDDEN],
    effects: [foreignPotential(0.08), merchantPotential(0.03)],
    relevance: (s) => (Object.keys(s.currency.foreignAdoption).length > 0 ? 0.5 : 0.2),
  }),
  definePolicy({
    id: "intl_domestic_focus",
    category: "INTERNATIONAL",
    label: "国内集中",
    description: "海外展開より国内での基盤固めを優先する",
    cost: 0.1,
    effects: [foreignPotential(-0.03), utilityPotential(0.04)],
    relevance: (s) => (s.currency.foreignDemand > s.currency.utilityDemand ? 0.4 : 0.2),
  }),

  // ---- 危機 (CRISIS) ----
  definePolicy({
    id: "crisis_watch_and_wait",
    category: "CRISIS",
    label: "静観",
    description: "あえて何もせず様子を見る",
    cost: 0,
    effects: [],
    relevance: (s) => (s.currency.crisisPressure > 0.3 ? 0.3 : 0),
  }),
  definePolicy({
    id: "crisis_emergency_liquidity",
    category: "CRISIS",
    label: "緊急流動性供給",
    description: "危機に対して緊急の流動性を供給する",
    cost: 0.3,
    prereq: [{ key: "crisisPressure", op: "gt", value: 0.3 }],
    effects: [liquidity(0.12), trust("institutionalTrust", 0.03)],
    relevance: (s) => s.currency.crisisPressure,
  }),
  definePolicy({
    id: "crisis_temporary_issuance_halt",
    category: "CRISIS",
    label: "一時発行停止",
    description: "新規発行を一時的に止め、信認の回復を図る",
    cost: 0.2,
    forbidden: [FIXED_SUPPLY_FORBIDDEN],
    prereq: [{ key: "crisisPressure", op: "gt", value: 0.3 }],
    effects: [trust("monetaryTrust", 0.04)],
    relevance: (s) => s.currency.monetaryInstability,
  }),
  definePolicy({
    id: "crisis_trust_recovery_program",
    category: "CRISIS",
    label: "信用回復プログラム",
    description: "信用回復に向けた包括的な取り組みを行う",
    cost: 0.3,
    prereq: [{ key: "trustScar", op: "gt", value: 0.05 }],
    effects: [trust("issuerTrust", 0.05), trust("institutionalTrust", 0.05), trustScar(-0.05)],
    relevance: (s) => s.currency.trustScar,
  }),
];
