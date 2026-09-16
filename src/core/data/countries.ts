import type { CountryState } from "../types";

// 国データ。追加が容易なようRecordのエントリを増やすだけで拡張できる構造にする。
// 実在国の将来予測ではなく、ゲーム内の相対的な特性値として扱う。

export interface CountryTemplate {
  id: string;
  name: string;
  nativeCurrencyName: string;
  population: number;
  gdpPerCapitaIndex: number;
  incumbentCurrencyTrust: number;
  digitalReadiness: number;
  regulatoryOpenness: number;
  /** 共通Numeraireに対する現地通貨の換算値（1 Numeraire = この値の現地通貨）。FX計算専用。 */
  numeraireExchangeRate: number;
}

export const countryTemplates: Record<string, CountryTemplate> = {
  japan: {
    id: "japan",
    name: "日本",
    nativeCurrencyName: "円",
    population: 124_000_000,
    gdpPerCapitaIndex: 0.82,
    incumbentCurrencyTrust: 0.88,
    digitalReadiness: 0.75,
    regulatoryOpenness: 0.55,
    numeraireExchangeRate: 150,
  },
  alt_republic: {
    id: "alt_republic",
    name: "アルト共和国",
    nativeCurrencyName: "アルト",
    population: 38_000_000,
    gdpPerCapitaIndex: 0.28,
    incumbentCurrencyTrust: 0.32,
    digitalReadiness: 0.48,
    regulatoryOpenness: 0.7,
    numeraireExchangeRate: 25,
  },
  nord_union: {
    id: "nord_union",
    name: "ノルド連合",
    nativeCurrencyName: "クローナ",
    population: 45_000_000,
    gdpPerCapitaIndex: 0.9,
    incumbentCurrencyTrust: 0.85,
    digitalReadiness: 0.92,
    regulatoryOpenness: 0.8,
    numeraireExchangeRate: 9,
  },
  delta_federation: {
    id: "delta_federation",
    name: "デルタ連邦",
    nativeCurrencyName: "デルタドル",
    population: 280_000_000,
    gdpPerCapitaIndex: 0.55,
    incumbentCurrencyTrust: 0.6,
    digitalReadiness: 0.58,
    regulatoryOpenness: 0.45,
    numeraireExchangeRate: 60,
  },
};

export function createCountryState(templateId: string): CountryState {
  const template = countryTemplates[templateId];
  if (!template) {
    throw new Error(`未定義の国IDです: ${templateId}`);
  }
  return { ...template };
}

export function createAllCountryStates(): Record<string, CountryState> {
  const result: Record<string, CountryState> = {};
  for (const id of Object.keys(countryTemplates)) {
    result[id] = createCountryState(id);
  }
  return result;
}
