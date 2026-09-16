import type {
  Issuer,
  SupplyRule,
  ExchangeRule,
  PriceRule,
  LaunchScale,
  UseCase,
  LifecycleState,
  MarketRegime,
  PolicyCategory,
} from "../core/types";
import { countryTemplates } from "../core/data/countries";

export const issuerLabels: Record<Issuer, { title: string; desc: string; hint: string }> = {
  GOVERNMENT: { title: "政府", desc: "国や自治体が管理する", hint: "制度的な信頼を得やすい" },
  COMPANY: { title: "会社", desc: "一つの会社が管理する", hint: "バランス型" },
  COMMUNITY: { title: "コミュニティ", desc: "利用者みんなで管理する", hint: "信頼はゼロから積み上げる" },
  ALGORITHMIC: { title: "アルゴリズム", desc: "プログラムのルールで自動的に管理する", hint: "技術的な信頼で語る" },
};

export const supplyLabels: Record<SupplyRule, { title: string; desc: string; hint: string }> = {
  FLEXIBLE: { title: "柔軟供給", desc: "必要に応じて発行量を調整できる", hint: "政策の自由度が高い" },
  GRADUAL: { title: "緩やかな増加", desc: "毎年少しずつ決まった量が増える", hint: "供給は自動で増え続ける" },
  FIXED: { title: "固定供給", desc: "発行される量が最初から決まっている", hint: "希少性重視・増発できない" },
  AUTOMATIC: { title: "自動供給", desc: "アルゴリズムが自動的に量を調整する", hint: "上級者向け・自己強化に注意" },
};

export const exchangeLabels: Record<ExchangeRule, { title: string; desc: string; hint: string }> = {
  OPEN: { title: "自由な交換", desc: "他の通貨といつでも交換できる", hint: "海外展開に強い" },
  LIMITED: { title: "限定的な交換", desc: "一部の場所でのみ交換できる", hint: "国内寄りでやや安定" },
  CLOSED: { title: "交換なし", desc: "他の通貨とは交換できない", hint: "国内だけで完結・為替の影響なし" },
};

export const priceLabels: Record<PriceRule, { title: string; desc: string; hint: string }> = {
  FLOATING: { title: "変動価格", desc: "市場の状況で価格が変わる", hint: "値動きが大きくなりうる" },
  PEGGED: { title: "固定価格(ペッグ)", desc: "特定の価値に固定しようとする", hint: "価格は安定しやすいが準備資産の管理が要る" },
};

export const launchLabels: Record<LaunchScale, { title: string; desc: string; hint: string }> = {
  SMALL: { title: "小さく始める", desc: "少人数からスタート", hint: "着実だが広がりはゆっくり" },
  NATIONAL: { title: "国内規模", desc: "国内で広く使われることを目指す", hint: "程よいバランス" },
  GLOBAL: { title: "世界規模", desc: "最初から世界を視野に入れる", hint: "最初から注目度が高い" },
};

export const useCaseLabels: Record<UseCase, { title: string; hint: string }> = {
  RETAIL: { title: "店舗での支払い", hint: "実需が育ちやすい" },
  ECOMMERCE: { title: "ネットショッピング", hint: "海外ともつながりやすい" },
  PAYROLL: { title: "給料の受け取り", hint: "日常に根付きやすい" },
  REMITTANCE: { title: "海外送金", hint: "海外との結びつきが強い" },
  SAVINGS_INVESTMENT: { title: "貯金・投資", hint: "値動きが大きくなりやすい" },
  UTILITY_BILLS: { title: "公共料金の支払い", hint: "生活に密着しやすい" },
};

export const countryHints: Record<string, string> = {
  japan: "安定志向・既存通貨への信頼が厚い",
  alt_republic: "既存通貨への不安が大きい・伸びしろがある",
  nord_union: "先進的でデジタルに強い",
  delta_federation: "人口が多く、広がる余地が大きい",
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

export const policyCategoryHints: Record<PolicyCategory, string> = {
  SUPPLY: "発行量を動かす",
  ADOPTION: "利用を広げる",
  TRUST: "信用を高める",
  MARKET: "市場を整える",
  INTERNATIONAL: "海外に広げる",
  CRISIS: "危機に備える",
  NONE: "様子を見る",
};
