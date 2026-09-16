import { useEffect, useMemo, useState } from "react";
import type { GameState, LedgerEventEntry, YearRecord } from "../../core/types";
import { countryTemplates } from "../../core/data/countries";
import { computeExchangeRate } from "../../core/engines/currency/fx";
import { getPolicyChoices } from "../../game/gameController";
import { lifecycleLabels, regimeLabels } from "../labels";
import CoinAvatar from "../components/CoinAvatar";

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

/** 政策選択の前に、今の状況を一言で伝える。「適当に選ぶ」のではなく理由を持って選べるように。 */
function describeSituation(state: GameState): string {
  const c = state.currency;
  if (c.crisisPressure > 0.5) return "経済が不安定になっています。落ち着かせる一手が必要かもしれません。";
  if (c.bubblePressure > 0.5) return "投機的な盛り上がりが続いています。このまま乗るか、抑えるか。";
  if (c.redemptionPressure > 0.3) return "準備資産への不安から、交換を求める動きが出ています。";
  if (c.liquidity < 0.3) return "取引の相手が見つかりにくくなっています。";
  if (c.trustScar > 0.1) return "過去のトラブルの傷跡がまだ残っています。";
  if (c.deflationPressure > 0.4) return "使う人が減り、物価が下がり気味です。";
  if (c.inflationPressure > 0.4) return "物価が上がり気味です。";
  if (c.awareness < 0.1) return "最近、あまり話題になっていません。";
  return "大きな問題はなく、落ち着いた状況です。";
}

function describeYearBeat(r: YearRecord): { headline: string; sub?: string } {
  if (r.crashOccurred) return { headline: "価格が大きく崩れました" };
  const top = [...r.events].sort((a, b) => b.severity - a.severity)[0];
  if (top) return { headline: top.headline };
  return { headline: "静かな1年でした" };
}

export default function TurnScreen({ state, records, onAdvance }: Props) {
  const [selectedPolicyId, setSelectedPolicyId] = useState("NO_ACTION");
  const [revealIndex, setRevealIndex] = useState(0);
  const choices = useMemo(() => getPolicyChoices(state), [state]);

  useEffect(() => {
    setRevealIndex(0);
  }, [records]);

  if (records.length === 0) {
    return (
      <div className="screen" style={{ justifyContent: "center" }}>
        <p>次の5年に進めます…</p>
      </div>
    );
  }

  // 5年分を一度に出すのではなく、1年ずつ「◯年…できごと」と区切って見せる。
  // 判断→5年分の結果一括表示、ではなく判断→出来事の連なり、というテンポにするための演出。
  if (revealIndex < records.length) {
    const r = records[revealIndex];
    const beat = describeYearBeat(r);
    const yearChangePct = ((r.valueAfter - r.valueBefore) / r.valueBefore) * 100;
    const isLast = revealIndex === records.length - 1;
    return (
      <div className="screen" style={{ justifyContent: "center" }}>
        <div className="center-col">
          <CoinAvatar
            name={state.currencyDesign.name}
            holders={r.snapshot.holders}
            trust={r.snapshot.overallTrust}
            lifecycle={r.lifecycle}
            size={100}
          />
          <span className="badge" style={{ marginTop: 12 }}>
            {r.year}年
          </span>
          <h1 style={{ fontSize: 22, marginTop: 10 }}>{beat.headline}</h1>
          <div className="hero-stat" style={{ marginTop: 4 }}>
            <div className="hero-number" style={{ fontSize: 34 }}>
              {yearChangePct >= 0 ? "↑" : "↓"} {Math.abs(yearChangePct).toFixed(1)}%
            </div>
            <div className="hero-caption">この年の価格変化</div>
          </div>
        </div>
        <div className="bottom-bar" style={{ marginTop: "auto" }}>
          <button className="btn btn-primary" onClick={() => setRevealIndex((i) => i + 1)}>
            {isLast ? "5年間のまとめを見る" : "次へ"}
          </button>
        </div>
      </div>
    );
  }

  const first = records[0];
  const last = records[records.length - 1];
  const periodLabel = `${first.year - 1}年 → ${last.year}年`;

  const priceChange = (last.valueAfter - first.valueBefore) / first.valueBefore;
  const priceChangePct = priceChange * 100;
  const topNews = collectTopNews(records);
  const country = countryTemplates[state.currencyDesign.homeCountryId];
  const nativeCurrency = country?.nativeCurrencyName ?? "円";

  const newlyLearned = state.learnedTopics.slice(-4);

  const foreignCountries = Object.entries(state.currency.foreignAdoption).filter(([, a]) => a.activeUsers > 0);
  const showFx = state.currencyDesign.exchangeRule !== "CLOSED" && foreignCountries.length > 0 && country;

  const c = state.currency;
  const trustAvg = (c.issuerTrust + c.technicalTrust + c.monetaryTrust + c.marketTrust + c.institutionalTrust) / 5;
  const dramatic = Math.abs(priceChangePct) > 40 || last.crashOccurred;

  const lastChosenPolicy = first.policies[0];
  const maturedEffects = records.flatMap((r) =>
    r.maturedDelayedEffects.map((m) => ({ ...m, year: r.year }))
  );

  function handleAdvance() {
    onAdvance(selectedPolicyId);
  }

  return (
    <div className="screen">
      <div className="section" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <CoinAvatar name={state.currencyDesign.name} holders={c.holders} trust={trustAvg} lifecycle={c.lifecycle} size={72} />
        <div>
          <span className="badge">{periodLabel}</span>
          <h1 style={{ fontSize: 20, margin: "6px 0 0" }}>{state.currencyDesign.name}のこの5年</h1>
        </div>
      </div>

      {lastChosenPolicy && (
        <p style={{ margin: "0 0 14px", fontSize: 13.5 }}>
          前回、あなたは「<strong style={{ color: "var(--text)" }}>{lastChosenPolicy.label}</strong>」を選びました。その結果です。
        </p>
      )}

      <div className="hero-stat">
        <div className="hero-caption">1 {state.currencyDesign.name} の価値</div>
        <div className="hero-number">
          {last.valueAfter.toFixed(1)} {nativeCurrency}
        </div>
        <div className="hero-caption">
          {priceChangePct >= 0 ? "↑" : "↓"} {Math.abs(priceChangePct).toFixed(1)}%{dramatic ? "　大きな変化がありました" : ""}
        </div>
      </div>

      {maturedEffects.length > 0 && (
        <div className="card section" style={{ borderColor: "var(--accent-2)" }}>
          <h3>過去の判断が、今になって効いてきました</h3>
          {maturedEffects.map((m, i) => (
            <div className="news-item" key={`${m.sourceId}-${i}`}>
              <div className="headline">{m.year}年: {m.sourceLabel}の影響が出ました</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{m.createdYear}年に下した判断の結果です</div>
            </div>
          ))}
        </div>
      )}

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
        <div className="situation-banner">{describeSituation(state)}</div>
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
