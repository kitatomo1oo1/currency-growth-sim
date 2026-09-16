import type {
  CurrencyDesign,
  CurrencyState,
  GameState,
  Issuer,
  LaunchScale,
  WorldState,
} from "../types";
import { countryTemplates, createAllCountryStates } from "../data/countries";
import { GAME_STATE_VERSION } from "./version";
import { simulationConfig } from "../config";
import { clamp01 } from "../engines/mathUtils";

interface LaunchProfile {
  holders: number;
  awareness: number;
  merchantCount: number;
}

const launchProfiles: Record<LaunchScale, LaunchProfile> = {
  SMALL: { holders: 500, awareness: 0.05, merchantCount: 3 },
  NATIONAL: { holders: 20_000, awareness: 0.15, merchantCount: 40 },
  GLOBAL: { holders: 100_000, awareness: 0.3, merchantCount: 150 },
};

/**
 * 初期circulatingSupplyは、需要式(§12/§14)が年0時点で計算するfundamentalValueがbaseValueと
 * ほぼ一致するように逆算する。固定値を独立に置くと初年度から巨大な価格ギャップが生まれ、
 * どのSeed/Designでも毎回同じ方向に価格が収れんしてしまう（Diversity/Balance要件に反する）ため。
 */
function estimateInitialCirculatingSupply(
  design: CurrencyDesign,
  activeUsers: number,
  holders: number,
  trustAvg: number,
  baseValue: number,
  potentials: ReturnType<typeof computeUseCasePotentials>
): number {
  const spending = simulationConfig.behavior.baseSpendingPerActiveUser;
  const usability = 0.5 * 0.5 + 0.5 * 0.6; // paymentEfficiency初期0.5, divisibility初期0.6
  const merchantCoverage = 0.6 * potentials.merchantPotential + 0.4 * 0.4; // merchantActivityRate初期0.4
  const stabilityFactor = 0.9; // volatility初期0.1
  const utilityDemandApprox =
    activeUsers * spending * usability * merchantCoverage * trustAvg * stabilityFactor * (0.4 + potentials.utilityPotential);

  const pegDamp = design.priceRule === "PEGGED" ? 0.6 : 1;
  const savingDemandApprox = holders * spending * 0.35 * potentials.savingPotential * (0.3 + trustAvg * 0.7) * pegDamp;

  const velocity = 4;
  const fundamentalMarketCap = utilityDemandApprox / velocity + savingDemandApprox;
  // ゼロ割回避のためだけの下限(通常の較正値を上書きしないよう極小値にする)。
  return Math.max(1, fundamentalMarketCap / baseValue);
}

interface IssuerTrustProfile {
  issuerTrust: number;
  technicalTrust: number;
  monetaryTrust: number;
  institutionalTrust: number;
}

const issuerTrustProfiles: Record<Issuer, IssuerTrustProfile> = {
  GOVERNMENT: { issuerTrust: 0.6, technicalTrust: 0.5, monetaryTrust: 0.55, institutionalTrust: 0.65 },
  COMPANY: { issuerTrust: 0.5, technicalTrust: 0.55, monetaryTrust: 0.45, institutionalTrust: 0.4 },
  COMMUNITY: { issuerTrust: 0.45, technicalTrust: 0.45, monetaryTrust: 0.4, institutionalTrust: 0.3 },
  ALGORITHMIC: { issuerTrust: 0.4, technicalTrust: 0.62, monetaryTrust: 0.4, institutionalTrust: 0.3 },
};

function createInitialWorldState(): WorldState {
  return {
    year: 0,
    globalGrowth: 0,
    globalInflationPressure: 0.2,
    globalRiskAppetite: 0.5,
    globalCrisisPressure: 0.1,
    technologyLevel: 0.3,
    activeConditions: [],
  };
}

/**
 * §5の「用途」選択を初期ポテンシャルへ反映する。用途を選んでも中身の力学が変わらないと
 * プレイヤーの設計判断(CurrencyDesign)が結果に意味を持たなくなってしまうため。
 */
function computeUseCasePotentials(design: CurrencyDesign): {
  utilityPotential: number;
  savingPotential: number;
  speculationPotential: number;
  foreignPotential: number;
  merchantPotential: number;
} {
  let utilityPotential = 0.3;
  let savingPotential = 0.2;
  let speculationPotential = 0.15;
  let foreignPotential = design.exchangeRule === "CLOSED" ? 0 : 0.1;
  let merchantPotential = 0.2;

  for (const uc of design.useCases) {
    switch (uc) {
      case "RETAIL":
        utilityPotential += 0.15;
        merchantPotential += 0.15;
        break;
      case "ECOMMERCE":
        utilityPotential += 0.1;
        foreignPotential += design.exchangeRule === "CLOSED" ? 0 : 0.05;
        break;
      case "PAYROLL":
        utilityPotential += 0.1;
        savingPotential += 0.05;
        break;
      case "REMITTANCE":
        foreignPotential += design.exchangeRule === "CLOSED" ? 0 : 0.2;
        break;
      case "SAVINGS_INVESTMENT":
        savingPotential += 0.2;
        speculationPotential += 0.2;
        break;
      case "UTILITY_BILLS":
        utilityPotential += 0.1;
        break;
    }
  }

  return {
    utilityPotential: clamp01(utilityPotential),
    savingPotential: clamp01(savingPotential),
    speculationPotential: clamp01(speculationPotential),
    foreignPotential: clamp01(foreignPotential),
    merchantPotential: clamp01(merchantPotential),
  };
}

function createInitialCurrencyState(design: CurrencyDesign): CurrencyState {
  const profile = launchProfiles[design.launchScale];
  const trust = issuerTrustProfiles[design.issuerType];

  const activeUsers = Math.round(profile.holders * 0.6);
  const regularUsers = Math.round(activeUsers * 0.3);

  const liquidityByExchange = { OPEN: 0.5, LIMITED: 0.35, CLOSED: 0.2 }[design.exchangeRule];

  const baseValue = 10; // ゲーム内基準値。現実の価値予測ではない（§45）。
  const trustAvg = (trust.issuerTrust + trust.technicalTrust + trust.monetaryTrust + 0.5 + trust.institutionalTrust) / 5;
  const potentials = computeUseCasePotentials(design);
  const circulatingSupply = estimateInitialCirculatingSupply(design, activeUsers, profile.holders, trustAvg, baseValue, potentials);
  const totalSupply = design.supplyRule === "FIXED" ? circulatingSupply : circulatingSupply * 2;

  return {
    lifecycle: "ACTIVE",
    regime: "STABLE",

    baseValue,
    fundamentalValue: baseValue,

    totalSupply,
    circulatingSupply,
    velocity: 4,

    holders: profile.holders,
    activeUsers,
    regularUsers,

    merchantCount: profile.merchantCount,
    merchantActivityRate: 0.4,
    merchantTransactionShare: 0.2,

    transactionVolume: 0,
    currencyActivityVolume: 0,

    utilityDemand: 0,
    savingDemand: 0,
    speculativeDemand: 0,
    foreignDemand: 0,
    sellingPressure: 0,

    ...potentials,

    awareness: profile.awareness,
    liquidity: liquidityByExchange,
    volatility: 0.1,

    issuerTrust: trust.issuerTrust,
    technicalTrust: trust.technicalTrust,
    monetaryTrust: trust.monetaryTrust,
    marketTrust: 0.5,
    institutionalTrust: trust.institutionalTrust,
    policyCredibility: 0.5,
    trustScar: 0,

    inflationPressure: 0,
    deflationPressure: 0,
    bubblePressure: 0,
    crisisPressure: 0,
    monetaryInstability: 0,

    fxExposure: design.exchangeRule === "CLOSED" ? 0 : 0.05,
    alternativeCaptureRate: 0.3,

    divisibility: 0.6,
    paymentEfficiency: 0.5,

    reserveAssets: design.priceRule === "PEGGED" ? circulatingSupply * baseValue : 0,
    reserveRatio: design.priceRule === "PEGGED" ? 1.0 : 0,
    redemptionPressure: 0,
    pegConfidence: design.priceRule === "PEGGED" ? 0.8 : 1,

    governanceCapacity: 1.0,

    // OPEN/LIMITEDなら他国すべてを0人からの潜在的な進出先として登録しておく。
    // CLOSEDでは空のまま(effectApi/demand.ts側でも常に0へ固定される、仕様監査 §7-2)。
    foreignAdoption: design.exchangeRule === "CLOSED" ? {} : buildInitialForeignAdoption(design.homeCountryId),

    momentum: 0,
    returnHistory: [],
  };
}

function buildInitialForeignAdoption(homeCountryId: string): CurrencyState["foreignAdoption"] {
  const result: CurrencyState["foreignAdoption"] = {};
  for (const id of Object.keys(countryTemplates)) {
    if (id === homeCountryId) continue;
    result[id] = { countryId: id, awareness: 0, activeUsers: 0 };
  }
  return result;
}

export function createInitialGameState(
  design: CurrencyDesign,
  masterSeed: string,
  startYear: number,
  maxYear = 50
): GameState {
  const world = createInitialWorldState();
  world.year = startYear;
  const currency = createInitialCurrencyState(design);

  const flags: Record<string, boolean | number> = {};
  if (design.priceRule === "PEGGED") {
    flags["pegTargetValue"] = currency.baseValue;
  }

  return {
    version: GAME_STATE_VERSION,
    startYear,
    currentYear: startYear,
    maxYear: startYear + maxYear,
    masterSeed,
    world,
    countries: createAllCountryStates(),
    currencyDesign: design,
    currency,
    delayedEffects: [],
    history: [],
    learnedTopics: [],
    lifecycleState: "ACTIVE",
    eventCooldowns: {},
    recentEventCategories: {},
    activeConflictTags: {},
    eventWeightModifiers: {},
    flags,
    policySequence: [],
    nextDelayedEffectSeq: 1,
  };
}
