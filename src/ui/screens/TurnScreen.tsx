import { useMemo, useState } from "react";
import type { GameState, LedgerEventEntry, YearRecord } from "../../core/types";
import { countryTemplates } from "../../core/data/countries";
import { computeExchangeRate } from "../../core/engines/currency/fx";
import { getPolicyChoices } from "../../game/gameController";
import { lifecycleLabels, regimeLabels } from "../labels";

interface Props {
  state: GameState;
  records: YearRecord[];
  onAdvance: (policyId: string) => void;
}

const BASKET_ITEMS: Array<{ label: string; homePrice: number }> = [
  { label: "パン", homePrice: 300 },
  { label: "外食1回", homePrice: 1200 },
  { label: "海外旅行", homePrice: 150000 },
];

function collectTopNews(records: YearRecord[], max = 5): LedgerEventEntry[] {
  const all = records.flatMap((r) => r.events);
  return [...all].sort((a, b) => b.severity - a.severity).slice(0, max);
}

export default function TurnScreen({ state, records, onAdvance }: Props) {
  const [selectedPolicyId, setSelectedPolicyId] = useState("NO_ACTION");
  const choices = useMemo(() => getPolicyChoices(state), [state]);

  if (records.length === 0) {
    return (
      <div className="screen" style={{ justifyContent: "center" }}>
        <p>次の5年に進めます…</p>
      </div>
    );
  }

  const first = records[0];
  const last = records[records.length - 1];
  const periodLabel = `${first.year - 1}年 → ${last.year}年`;

  const priceChange = (last.valueAfter - first.valueBefore) / first.valueBefore;
  const topNews = collectTopNews(records);
  const country = countryTemplates[state.currencyDesign.homeCountryId];
  const nativeCurrency = country?.nativeCurrencyName ?? "円";

  const newlyLearned = state.learnedTopics.slice(-4);

  const foreignCountries = Object.entries(state.currency.foreignAdoption).filter(([, a]) => a.activeUsers > 0);
  const showFx = state.currencyDesign.exchangeRule !== "CLOSED" && foreignCountries.length > 0 && country;

  function handleAdvance() {
    onAdvance(selectedPolicyId);
  }

  return (
    <div className="screen">
      <div className="section">
        <span className="badge">{periodLabel}</span>
        <h1 style={{ fontSize: 22 }}>この5年で起きたこと</h1>
      </div>

      {topNews.length > 0 && (
        <div className="card section">
          <h3>主なできごと</h3>
          {topNews.map((n, i) => (
            <div className="news-item" key={`${n.eventId}-${i}`}>
              <div className="headline">{n.headline}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card section">
        <h3>価格の変化</h3>
        <div className="center-col" style={{ alignItems: "flex-start", textAlign: "left" }}>
          <div className="stat-row" style={{ width: "100%" }}>
            <span className="stat-label">5年前</span>
            <span className="stat-value">
              1 {state.currencyDesign.name} = {first.valueBefore.toFixed(1)} {nativeCurrency}
            </span>
          </div>
          <div className="stat-row" style={{ width: "100%" }}>
            <span className="stat-label">現在</span>
            <span className="stat-value">
              1 {state.currencyDesign.name} = {last.valueAfter.toFixed(1)} {nativeCurrency}
            </span>
          </div>
          <div className="stat-row" style={{ width: "100%" }}>
            <span className="stat-label">変化</span>
            <span className="stat-value">{(priceChange * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="card section">
        <h3>生活への影響</h3>
        {BASKET_ITEMS.map((item) => {
          const before = item.homePrice / first.valueBefore;
          const after = item.homePrice / last.valueAfter;
          return (
            <div className="stat-row" key={item.label}>
              <span className="stat-label">{item.label}</span>
              <span className="stat-value">
                {before.toFixed(1)} → {after.toFixed(1)} {state.currencyDesign.name}
              </span>
            </div>
          );
        })}
      </div>

      {showFx && country && (
        <div className="card section">
          <h3>海外との関係</h3>
          {foreignCountries.map(([countryId]) => {
            const target = state.countries[countryId];
            if (!target) return null;
            const rate = computeExchangeRate(last.valueAfter, country, target);
            return (
              <div className="stat-row" key={countryId}>
                <span className="stat-label">{target.name}</span>
                <span className="stat-value">
                  1 {state.currencyDesign.name} ≈ {rate.toFixed(2)} {target.nativeCurrencyName}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="card section">
        <h3>利用の広がり</h3>
        <div className="stat-row">
          <span className="stat-label">保有者</span>
          <span className="stat-value">{last.snapshot.holders.toLocaleString()}人</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">よく使う人</span>
          <span className="stat-value">{last.snapshot.regularUsers.toLocaleString()}人</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">使える店舗</span>
          <span className="stat-value">{last.snapshot.merchantCount.toLocaleString()}店</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">今の状態</span>
          <span className="stat-value">
            {lifecycleLabels[last.lifecycle]} / {regimeLabels[last.regime]}
          </span>
        </div>
      </div>

      <div className="card section">
        <h3>なぜ、そうなった？</h3>
        <div className="driver-list">
          {last.positiveDrivers.slice(0, 3).map((d, i) => (
            <div className="driver-item" key={`p-${i}`}>
              <span>{d.label}</span>
              <span>↑</span>
            </div>
          ))}
          {last.negativeDrivers.slice(0, 3).map((d, i) => (
            <div className="driver-item" key={`n-${i}`}>
              <span>{d.label}</span>
              <span>↓</span>
            </div>
          ))}
          {last.positiveDrivers.length === 0 && last.negativeDrivers.length === 0 && (
            <span style={{ color: "var(--text-muted)", fontSize: 14 }}>目立った変化はありませんでした</span>
          )}
        </div>
      </div>

      {newlyLearned.length > 0 && (
        <div className="card section">
          <h3>学んだこと</h3>
          <div className="scroll-x-tags">
            {newlyLearned.map((t) => (
              <span className="badge" key={t}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <h2>次の5年、どうする？</h2>
        {choices.map((p) => (
          <button
            key={p.id}
            className={`tap-card ${selectedPolicyId === p.id ? "selected" : ""}`}
            onClick={() => setSelectedPolicyId(p.id)}
          >
            <span className="title">{p.label}</span>
            <span className="desc">{p.description}</span>
          </button>
        ))}
      </div>

      <div className="bottom-bar" style={{ marginTop: "auto" }}>
        <button className="btn btn-primary" onClick={handleAdvance}>
          次の5年へ
        </button>
      </div>
    </div>
  );
}
