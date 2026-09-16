import type { Issuer, SupplyRule, ExchangeRule, PriceRule, LaunchScale, UseCase, LifecycleState, MarketRegime } from "../core/types";
import { countryTemplates } from "../core/data/countries";

export const issuerLabels: Record<Issuer, { title: string; desc: string }> = {
  GOVERNMENT: { title: "政府", desc: "国や自治体が管理する" },
  COMPANY: { title: "会社", desc: "一つの会社が管理する" },
  COMMUNITY: { title: "コミュニティ", desc: "利用者みんなで管理する" },
  ALGORITHMIC: { title: "アルゴリズム", desc: "プログラムのルールで自動的に管理する" },
};

export const supplyLabels: Record<SupplyRule, { title: string; desc: string }> = {
  FLEXIBLE: { title: "柔軟供給", desc: "必要に応じて発行量を調整できる" },
  GRADUAL: { title: "緩やかな増加", desc: "毎年少しずつ決まった量が増える" },
  FIXED: { title: "固定供給", desc: "発行される量が最初から決まっている" },
  AUTOMATIC: { title: "自動供給", desc: "アルゴリズムが自動的に量を調整する" },
};

export const exchangeLabels: Record<ExchangeRule, { title: string; desc: string }> = {
  OPEN: { title: "自由な交換", desc: "他の通貨といつでも交換できる" },
  LIMITED: { title: "限定的な交換", desc: "一部の場所でのみ交換できる" },
  CLOSED: { title: "交換なし", desc: "他の通貨とは交換できない" },
};

export const priceLabels: Record<PriceRule, { title: string; desc: string }> = {
  FLOATING: { title: "変動価格", desc: "市場の状況で価格が変わる" },
  PEGGED: { title: "固定価格(ペッグ)", desc: "特定の価値に固定しようとする" },
};

export const launchLabels: Record<LaunchScale, { title: string; desc: string }> = {
  SMALL: { title: "小さく始める", desc: "少人数からスタート" },
  NATIONAL: { title: "国内規模", desc: "国内で広く使われることを目指す" },
  GLOBAL: { title: "世界規模", desc: "最初から世界を視野に入れる" },
};

export const useCaseLabels: Record<UseCase, string> = {
  RETAIL: "店舗での支払い",
  ECOMMERCE: "ネットショッピング",
  PAYROLL: "給料の受け取り",
  REMITTANCE: "海外送金",
  SAVINGS_INVESTMENT: "貯金・投資",
  UTILITY_BILLS: "公共料金の支払い",
};

export const lifecycleLabels: Record<LifecycleState, string> = {
  ACTIVE: "元気に使われている",
  STRESSED: "厳しい状況にある",
  DORMANT: "ほとんど使われていない",
  DEAD: "使われなくなった",
};

export const regimeLabels: Record<MarketRegime, string> = {
  STABLE: "落ち着いている",
  GROWTH: "成長している",
  SPECULATIVE: "投機的に盛り上がっている",
  STRESS: "危機的な状況",
  RECOVERY: "回復に向かっている",
  DECLINE: "勢いが弱まっている",
};

export const countryOptions = Object.values(countryTemplates).map((c) => ({ id: c.id, name: c.name }));
