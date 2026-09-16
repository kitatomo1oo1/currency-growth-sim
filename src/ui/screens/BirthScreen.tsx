import type { GameState } from "../../core/types";
import { countryTemplates } from "../../core/data/countries";
import CoinAvatar from "../components/CoinAvatar";

interface Props {
  state: GameState;
  onAdvance: () => void;
}

export default function BirthScreen({ state, onAdvance }: Props) {
  const { currencyDesign, currency, startYear } = state;
  const country = countryTemplates[currencyDesign.homeCountryId];
  const trustAvg =
    (currency.issuerTrust + currency.technicalTrust + currency.monetaryTrust + currency.marketTrust + currency.institutionalTrust) /
    5;

  return (
    <div className="screen" style={{ justifyContent: "center" }}>
      <div className="center-col">
        <CoinAvatar name={currencyDesign.name} holders={currency.holders} trust={trustAvg} lifecycle={currency.lifecycle} size={160} />
        <span className="badge" style={{ marginTop: 12 }}>
          誕生
        </span>
        <h1>{currencyDesign.name}</h1>
        <p>{startYear}年、{country?.name ?? currencyDesign.homeCountryId}で生まれました</p>

        <div className="card" style={{ width: "100%", marginTop: 8 }}>
          <div className="stat-row">
            <span className="stat-label">最初の価値</span>
            <span className="stat-value">
              1 {currencyDesign.name} = {currency.baseValue.toFixed(0)} {country?.nativeCurrencyName ?? "円"}
            </span>
          </div>
          <div className="stat-row">
            <span className="stat-label">最初の利用者</span>
            <span className="stat-value">{currency.holders.toLocaleString()}人</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">使える場所</span>
            <span className="stat-value">{currency.merchantCount.toLocaleString()}店舗</span>
          </div>
        </div>

        <p style={{ fontSize: 12 }}>
          最初の価値はゲーム内の基準値です。現実の価値を予測するものではありません。
        </p>
      </div>

      <div className="bottom-bar" style={{ marginTop: "auto" }}>
        <button className="btn btn-primary" onClick={onAdvance}>
          5年後へ
        </button>
      </div>
    </div>
  );
}
