import { useState } from "react";
import type { CurrencyDesign, ExchangeRule, Issuer, LaunchScale, PriceRule, SupplyRule, UseCase } from "../../core/types";
import {
  countryOptions,
  exchangeLabels,
  issuerLabels,
  launchLabels,
  priceLabels,
  supplyLabels,
  useCaseLabels,
} from "../labels";
import CoinAvatar from "../components/CoinAvatar";

interface Props {
  onComplete: (design: CurrencyDesign) => void;
  onBack: () => void;
}

const TOTAL_STEPS = 8;

export default function CreateCurrencyScreen({ onComplete, onBack }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [homeCountryId, setHomeCountryId] = useState<string>("");
  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [issuerType, setIssuerType] = useState<Issuer | "">("");
  const [supplyRule, setSupplyRule] = useState<SupplyRule | "">("");
  const [exchangeRule, setExchangeRule] = useState<ExchangeRule | "">("");
  const [priceRule, setPriceRule] = useState<PriceRule | "">("");
  const [launchScale, setLaunchScale] = useState<LaunchScale | "">("");

  function toggleUseCase(uc: UseCase) {
    setUseCases((prev) => (prev.includes(uc) ? prev.filter((x) => x !== uc) : prev.length >= 3 ? prev : [...prev, uc]));
  }

  function next() {
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  }
  function back() {
    if (step === 0) {
      onBack();
    } else {
      setStep((s) => s - 1);
    }
  }

  function submit() {
    if (!homeCountryId || !issuerType || !supplyRule || !exchangeRule || !priceRule || !launchScale) return;
    const symbol = name.trim().length > 0 ? name.trim().slice(0, 6) : "通貨";
    onComplete({
      name: name.trim() || "無題の通貨",
      symbol,
      homeCountryId,
      issuerType,
      supplyRule,
      exchangeRule,
      priceRule,
      launchScale,
      useCases: useCases.length > 0 ? useCases : ["RETAIL"],
    });
  }

  const canProceed = [
    name.trim().length > 0,
    homeCountryId !== "",
    useCases.length > 0,
    issuerType !== "",
    supplyRule !== "",
    exchangeRule !== "",
    priceRule !== "",
    launchScale !== "",
  ][step];

  return (
    <div className="screen">
      <div className="progress-dots">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} className={`dot ${i <= step ? "done" : ""}`} />
        ))}
      </div>

      {name.trim().length > 0 && step > 0 && (
        <div className="center-col" style={{ marginBottom: 8 }}>
          <CoinAvatar name={name.trim()} holders={0} trust={0.5} lifecycle="ACTIVE" size={64} />
        </div>
      )}

      {step === 0 && (
        <div className="section">
          <h2>通貨に名前をつけましょう</h2>
          <p>どんな名前でも構いません。</p>
          <input
            className="text-input"
            placeholder="例: にゃんコイン"
            value={name}
            maxLength={12}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
      )}

      {step === 1 && (
        <div className="section">
          <h2>どこの国から始めますか？</h2>
          {countryOptions.map((c) => (
            <button
              key={c.id}
              className={`tap-card ${homeCountryId === c.id ? "selected" : ""}`}
              onClick={() => setHomeCountryId(c.id)}
            >
              <span className="title">{c.name}</span>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="section">
          <h2>どんな場面で使いたいですか？</h2>
          <p>いくつでも選べます（最大3つ）</p>
          {(Object.keys(useCaseLabels) as UseCase[]).map((uc) => (
            <button key={uc} className={`tap-card ${useCases.includes(uc) ? "selected" : ""}`} onClick={() => toggleUseCase(uc)}>
              <span className="title">{useCaseLabels[uc]}</span>
            </button>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="section">
          <h2>誰が管理しますか？</h2>
          {(Object.keys(issuerLabels) as Issuer[]).map((key) => (
            <button key={key} className={`tap-card ${issuerType === key ? "selected" : ""}`} onClick={() => setIssuerType(key)}>
              <span className="title">{issuerLabels[key].title}</span>
              <span className="desc">{issuerLabels[key].desc}</span>
            </button>
          ))}
        </div>
      )}

      {step === 4 && (
        <div className="section">
          <h2>どうやって発行しますか？</h2>
          {(Object.keys(supplyLabels) as SupplyRule[]).map((key) => (
            <button key={key} className={`tap-card ${supplyRule === key ? "selected" : ""}`} onClick={() => setSupplyRule(key)}>
              <span className="title">{supplyLabels[key].title}</span>
              <span className="desc">{supplyLabels[key].desc}</span>
            </button>
          ))}
        </div>
      )}

      {step === 5 && (
        <div className="section">
          <h2>他の通貨との交換は？</h2>
          {(Object.keys(exchangeLabels) as ExchangeRule[]).map((key) => (
            <button key={key} className={`tap-card ${exchangeRule === key ? "selected" : ""}`} onClick={() => setExchangeRule(key)}>
              <span className="title">{exchangeLabels[key].title}</span>
              <span className="desc">{exchangeLabels[key].desc}</span>
            </button>
          ))}
        </div>
      )}

      {step === 6 && (
        <div className="section">
          <h2>価格の決まり方は？</h2>
          {(Object.keys(priceLabels) as PriceRule[]).map((key) => (
            <button key={key} className={`tap-card ${priceRule === key ? "selected" : ""}`} onClick={() => setPriceRule(key)}>
              <span className="title">{priceLabels[key].title}</span>
              <span className="desc">{priceLabels[key].desc}</span>
            </button>
          ))}
        </div>
      )}

      {step === 7 && (
        <div className="section">
          <h2>どんな規模で始めますか？</h2>
          {(Object.keys(launchLabels) as LaunchScale[]).map((key) => (
            <button key={key} className={`tap-card ${launchScale === key ? "selected" : ""}`} onClick={() => setLaunchScale(key)}>
              <span className="title">{launchLabels[key].title}</span>
              <span className="desc">{launchLabels[key].desc}</span>
            </button>
          ))}
        </div>
      )}

      <div className="bottom-bar" style={{ marginTop: "auto", display: "flex", gap: 8 }}>
        <button className="btn btn-secondary" style={{ width: "30%" }} onClick={back}>
          戻る
        </button>
        {step < TOTAL_STEPS - 1 ? (
          <button className="btn btn-primary" disabled={!canProceed} onClick={next}>
            次へ
          </button>
        ) : (
          <button className="btn btn-primary" disabled={!canProceed} onClick={submit}>
            この通貨を発行する
          </button>
        )}
      </div>
    </div>
  );
}
