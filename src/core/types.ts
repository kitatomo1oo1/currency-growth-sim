// Economic Core の全型定義。React には依存しない純 TypeScript。

export type Issuer = "GOVERNMENT" | "COMPANY" | "COMMUNITY" | "ALGORITHMIC";
export type SupplyRule = "FLEXIBLE" | "GRADUAL" | "FIXED" | "AUTOMATIC";
export type ExchangeRule = "OPEN" | "LIMITED" | "CLOSED";
export type PriceRule = "FLOATING" | "PEGGED";
export type LaunchScale = "SMALL" | "NATIONAL" | "GLOBAL";

export type UseCase =
  | "RETAIL" // 店舗
  | "ECOMMERCE" // ネットショッピング
  | "PAYROLL" // 給料
  | "REMITTANCE" // 海外送金
  | "SAVINGS_INVESTMENT" // 貯金・投資
  | "UTILITY_BILLS"; // 公共料金

export type LifecycleState = "ACTIVE" | "STRESSED" | "DORMANT" | "DEAD";

export type MarketRegime =
  | "STABLE"
  | "GROWTH"
  | "SPECULATIVE"
  | "STRESS"
  | "RECOVERY"
  | "DECLINE";

export type BubbleLevel = "NORMAL" | "WATCH" | "HOT" | "BUBBLE" | "EXTREME";

export interface CurrencyDesign {
  name: string;
  symbol: string;
  homeCountryId: string;
  issuerType: Issuer;
  supplyRule: SupplyRule;
  exchangeRule: ExchangeRule;
  priceRule: PriceRule;
  launchScale: LaunchScale;
  useCases: UseCase[];
}

// --- World ---

export interface WorldState {
  year: number;
  /** 成長偏差。0が中立、正で好況、負で不況方向。 */
  globalGrowth: number;
  globalInflationPressure: number; // 0..1
  globalRiskAppetite: number; // 0..1
  globalCrisisPressure: number; // 0..1
  technologyLevel: number; // 0..1、緩やかに増加
  /** 現在進行中のWorld Condition（複数年継続する環境要因）のID一覧 */
  activeConditions: WorldConditionInstance[];
}

export interface WorldConditionInstance {
  id: string;
  startYear: number;
  endYear: number;
}

// --- Country ---

export interface CountryState {
  id: string;
  name: string;
  nativeCurrencyName: string;
  population: number;
  gdpPerCapitaIndex: number; // 0..1程度の相対指標(先進国=高い)
  incumbentCurrencyTrust: number; // 0..1、既存通貨システムへの信用
  digitalReadiness: number; // 0..1
  regulatoryOpenness: number; // 0..1、規制の緩さ
  numeraireExchangeRate: number; // 共通Numeraireに対する現地通貨換算値、FX計算専用
}

export interface ForeignAdoption {
  countryId: string;
  awareness: number; // 0..1
  activeUsers: number;
}

// --- Currency ---

export interface CurrencyState {
  lifecycle: LifecycleState;
  regime: MarketRegime;

  baseValue: number; // 市場価格（ホーム国通貨建て）
  fundamentalValue: number; // 内部分析専用、断定表示しない

  totalSupply: number;
  circulatingSupply: number;
  velocity: number;

  holders: number;
  activeUsers: number;
  regularUsers: number;

  merchantCount: number;
  merchantActivityRate: number; // 0..1
  merchantTransactionShare: number; // 0..1

  transactionVolume: number; // 年間、通貨単位
  currencyActivityVolume: number; // 年間、複合活動量

  utilityDemand: number;
  savingDemand: number;
  speculativeDemand: number;
  foreignDemand: number;
  sellingPressure: number;

  // Event/Policyが動かす"ポテンシャル"。実需はCoreの計算式がこれらを介して導出する。
  utilityPotential: number; // 0..1
  savingPotential: number; // 0..1
  speculationPotential: number; // 0..1
  foreignPotential: number; // 0..1
  merchantPotential: number; // 0..1

  awareness: number; // 0..1
  liquidity: number; // 0..1
  volatility: number; // 0..1、直近変動の平滑値

  issuerTrust: number;
  technicalTrust: number;
  monetaryTrust: number;
  marketTrust: number;
  institutionalTrust: number;
  policyCredibility: number;
  trustScar: number; // 0..1、重大事故の累積傷跡（回復を遅くする）

  inflationPressure: number;
  deflationPressure: number;
  bubblePressure: number;
  crisisPressure: number;
  monetaryInstability: number;

  fxExposure: number; // 0..1
  alternativeCaptureRate: number; // 0..1

  divisibility: number; // 0..1
  paymentEfficiency: number; // 0..1

  reserveAssets: number; // Numeraire建て、PEGGEDのみ意味を持つ
  reserveRatio: number; // 0..1+
  redemptionPressure: number; // 0..1
  pegConfidence: number; // 0..1

  governanceCapacity: number; // 0..1、政策実行余力

  foreignAdoption: Record<string, ForeignAdoption>;

  momentum: number; // -1..1、直近複数年リターンから導出

  returnHistory: number[]; // 直近リターン(前年比)を数年分保持、momentum計算用
}

// --- Delayed Effects ---

export type EffectCondition = {
  key: keyof CurrencyState | "worldCrisis" | "regime";
  op: "lt" | "lte" | "gt" | "gte" | "eq";
  value: number | MarketRegime;
};

export interface DelayedEffectRecord {
  id: string;
  sourceId: string;
  sourceType: "EVENT" | "POLICY";
  sourceLabel: string;
  createdYear: number;
  triggerYear: number;
  effects: EffectInstruction[];
  cancelConditions?: EffectCondition[];
  modifyConditions?: EffectCondition[];
  cancelled?: boolean;
}

// --- Effect API (§38) ---

export type EffectInstruction =
  | { type: "ModifyTrust"; component: TrustComponent; delta: number }
  | { type: "ModifyAwareness"; delta: number }
  | { type: "ModifyUtilityPotential"; delta: number }
  | { type: "ModifySavingPotential"; delta: number }
  | { type: "ModifySpeculationPotential"; delta: number }
  | { type: "ModifyForeignPotential"; delta: number }
  | { type: "ModifyLiquidity"; delta: number }
  | { type: "ModifySupply"; kind: "mint" | "burn"; amountRatio: number } // totalSupplyに対する比率
  | { type: "ModifyMerchantPotential"; delta: number }
  | { type: "ModifyGovernanceCapacity"; delta: number }
  | { type: "ModifyPaymentEfficiency"; delta: number }
  | { type: "ModifyDivisibility"; delta: number }
  | { type: "ModifyFxExposure"; delta: number }
  | { type: "ModifyReserve"; kind: "add" | "remove"; amount: number }
  | { type: "AddTrustScar"; amount: number }
  | { type: "AddDelayedEffect"; delayedEffect: Omit<DelayedEffectRecord, "id" | "createdYear"> }
  | { type: "ModifyEventWeight"; eventId: string; multiplier: number }
  | { type: "SetFlag"; key: string; value: boolean | number };

export type TrustComponent =
  | "issuerTrust"
  | "technicalTrust"
  | "monetaryTrust"
  | "marketTrust"
  | "institutionalTrust"
  | "policyCredibility";

// --- Events ---

export type EventCategory =
  | "ADOPTION"
  | "CORPORATE"
  | "GOVERNMENT"
  | "FINANCIAL"
  | "INTERNATIONAL"
  | "TECHNOLOGY"
  | "SOCIAL"
  | "SPECULATION"
  | "WORLD_CRISIS";

export type SeverityRange = { min: number; max: number }; // 0..1、効果量のスケール

export interface EventPrerequisite {
  key:
    | keyof CurrencyState
    | "hasForeignAdoption"
    | "regime"
    | "lifecycle"
    | "exchangeRule"
    | "supplyRule"
    | "priceRule"
    | "issuerType"
    | "launchScale";
  op: "lt" | "lte" | "gt" | "gte" | "eq" | "neq";
  value: number | MarketRegime | LifecycleState | ExchangeRule | SupplyRule | PriceRule | Issuer | LaunchScale | boolean;
}

export interface EventDefinition {
  id: string;
  category: EventCategory;
  label: string; // 内部表示用日本語ラベル
  prerequisites: EventPrerequisite[];
  forbiddenIf: EventPrerequisite[];
  baseWeight: number; // 0以上、出現しやすさの基準値
  severityRange: SeverityRange;
  conflictTags: string[];
  cooldownYears: number;
  repeatable: boolean;
  learningTopics: string[];
  textTemplate: string; // {severity}等のプレースホルダを許可
  /** severity(0..1で正規化済み)を受け取り即時Effectを生成する */
  buildImmediateEffects: (severity: number) => EffectInstruction[];
  /** severityを受け取り遅延Effectの種を生成する（0件で良い） */
  buildDelayedEffects?: (severity: number, currentYear: number) => Array<Omit<DelayedEffectRecord, "id" | "createdYear">>;
}

// --- Policies ---

export type PolicyCategory =
  | "SUPPLY"
  | "ADOPTION"
  | "TRUST"
  | "MARKET"
  | "INTERNATIONAL"
  | "CRISIS"
  | "NONE";

export interface PolicyDefinition {
  id: string;
  category: PolicyCategory;
  label: string;
  description: string;
  cost: number; // governanceCapacity消費 0..1
  prerequisites: EventPrerequisite[];
  forbiddenIf: EventPrerequisite[];
  buildImmediateEffects: () => EffectInstruction[];
  buildDelayedEffects?: (currentYear: number) => Array<Omit<DelayedEffectRecord, "id" | "createdYear">>;
  /** 現在の状態にどれだけ状況的関連性があるか(0..1)。UIの候補選定(最大4択)にのみ使用し、正解/おすすめの意味は持たせない。 */
  relevanceScore: (state: GameState) => number;
}

// --- Explainability Ledger (§40) ---

export interface LedgerDriver {
  key: string;
  label: string; // 日本語
  magnitude: number; // 寄与の大きさ(絶対値の相対比較用)
  direction: "up" | "down";
}

export interface LedgerEventEntry {
  eventId: string;
  label: string;
  category: EventCategory;
  severity: number;
  headline: string;
}

export interface LedgerPolicyEntry {
  policyId: string;
  label: string;
}

export interface LedgerDelayedEntry {
  sourceId: string;
  sourceLabel: string;
  createdYear: number;
}

export interface YearRecord {
  year: number;
  valueBefore: number;
  valueAfter: number;
  positiveDrivers: LedgerDriver[];
  negativeDrivers: LedgerDriver[];
  events: LedgerEventEntry[];
  policies: LedgerPolicyEntry[];
  maturedDelayedEffects: LedgerDelayedEntry[];
  inflationDrivers: LedgerDriver[];
  adoptionDrivers: LedgerDriver[];
  trustDrivers: LedgerDriver[];
  fxDrivers: LedgerDriver[];
  regime: MarketRegime;
  lifecycle: LifecycleState;
  bubbleLevel: BubbleLevel;
  crashOccurred: boolean;
  snapshot: CurrencyStateSnapshot;
}

/** History/Runner/UI向けの軽量スナップショット */
export interface CurrencyStateSnapshot {
  baseValue: number;
  fundamentalValue: number;
  holders: number;
  activeUsers: number;
  regularUsers: number;
  merchantCount: number;
  circulatingSupply: number;
  totalSupply: number;
  awareness: number;
  liquidity: number;
  overallTrust: number;
  inflationPressure: number;
  deflationPressure: number;
  bubblePressure: number;
  crisisPressure: number;
  fxExposure: number;
  foreignCountryCount: number;
  utilityDemand: number;
  savingDemand: number;
  speculativeDemand: number;
  foreignDemand: number;
}

// --- GameState (§7) ---

export interface PolicyChoiceRecord {
  year: number;
  policyId: string;
}

export interface GameState {
  version: string;

  startYear: number;
  currentYear: number;
  maxYear: number;

  masterSeed: string;

  world: WorldState;
  countries: Record<string, CountryState>;

  currencyDesign: CurrencyDesign;
  currency: CurrencyState;

  delayedEffects: DelayedEffectRecord[];
  history: YearRecord[];

  learnedTopics: string[];

  lifecycleState: LifecycleState;

  // 実装上の補助State（仕様監査 §7 で明示化）
  eventCooldowns: Record<string, number>; // eventId -> 再発可能になる年
  recentEventCategories: Record<string, { count: number; lastYear: number }>;
  activeConflictTags: Record<string, number>; // tag -> 保持している最終年
  eventWeightModifiers: Record<string, number>;
  flags: Record<string, boolean | number>;
  policySequence: PolicyChoiceRecord[];
  nextDelayedEffectSeq: number;
}
