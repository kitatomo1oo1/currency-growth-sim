import { useMemo } from "react";
import type { GameState } from "../../core/types";
import { buildFinalSummary, classifyCurrencyType, extractTimeline } from "../../core/engines/historyGenerator";
import { lifecycleLabels } from "../labels";
import { ALL_LEARNING_TOPICS } from "../../core/data/learningTopics";
import CoinAvatar from "../components/CoinAvatar";
import PriceSparkline from "../components/PriceSparkline";

interface Props {
  state: GameState;
  onReplaySameDesign: () => void;
  onNewCurrency: () => void;
  onHome: () => void;
}

export default function FinalHistoryScreen({ state, onReplaySameDesign, onNewCurrency, onHome }: Props) {
  const summary = useMemo(() => buildFinalSummary(state), [state]);
  const types = useMemo(() => classifyCurrencyType(state), [state]);
  const timeline = useMemo(() => extractTimeline(state), [state]);
  const c = state.currency;
  const trustAvg = (c.issuerTrust + c.technicalTrust + c.monetaryTrust + c.marketTrust + c.institutionalTrust) / 5;
  const isDead = summary.finalLifecycle === "DEAD";

  return (
    <div className="screen screen-tight">
      <div className="section center-col">
        <CoinAvatar name={state.currencyDesign.name} holders={c.holders} trust={trustAvg} lifecycle={c.lifecycle} size={140} />
        <span className="badge" style={{ marginTop: 10 }}>
          {summary.lifespanYears}年の歴史
        </span>
        <h1 style={{ fontSize: 22 }}>
          {isDead ? `${state.currencyDesign.name}は、ここで終わりました` : `${state.currencyDesign.name}の50年史`}
        </h1>
        {isDead && (
          <p style={{ maxWidth: 320 }}>
            {state.startYear + summary.lifespanYears}年、{state.currencyDesign.name}は誰にも使われなくなり、その歴史に幕を閉じました。
          </p>
        )}
        <div className="scroll-x-tags">
          {types.map((t) => (
            <span className="badge" key={t}>
              {t}
            </span>
          ))}
        </div>
        <p>{lifecycleLabels[summary.finalLifecycle as keyof typeof lifecycleLabels] ?? summary.finalLifecycle}</p>
      </div>

      <div className="card section">
        <h3>歩み</h3>
        <div className="timeline">
          {timeline.map((m, i) => (
            <div className="timeline-item" key={i}>
              <div className="timeline-year">{m.year}年</div>
              <div style={{ fontWeight: 600 }}>{m.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{m.description}</div>
            </div>
          ))}
          {timeline.length === 0 && <p>目立った出来事はありませんでした。</p>}
        </div>
      </div>

      {state.history.length > 1 && (
        <div className="card section">
          <h3>価格の推移(50年間)</h3>
          <PriceSparkline points={[summary.initialValue, ...state.history.map((r) => r.valueAfter)]} />
        </div>
      )}

      <div className="card section">
        <h3>最終結果</h3>
        <div className="stat-row">
          <span className="stat-label">最初の価値</span>
          <span className="stat-value">{summary.initialValue.toFixed(1)}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">最終的な価値</span>
          <span className="stat-value">{summary.finalValue.toFixed(1)}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">最高値</span>
          <span className="stat-value">{summary.peakValue.toFixed(1)}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">最大下落率</span>
          <span className="stat-value">{(summary.maxDrawdown * 100).toFixed(1)}%</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">保有者</span>
          <span className="stat-value">{summary.holders.toLocaleString()}人</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">よく使う人</span>
          <span className="stat-value">{summary.regularUsers.toLocaleString()}人</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">使える店舗</span>
          <span className="stat-value">{summary.merchantCount.toLocaleString()}店</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">利用国数</span>
          <span className="stat-value">{summary.foreignCountryCount + 1}か国</span>
        </div>
      </div>

      <div className="card section">
        <h3>学んだ経済の仕組み</h3>
        <div className="scroll-x-tags">
          {ALL_LEARNING_TOPICS.map((topic) => {
            const learned = state.learnedTopics.includes(topic);
            return (
              <span className="badge" key={topic} style={{ opacity: learned ? 1 : 0.4 }}>
                {learned ? topic : "？"}
              </span>
            );
          })}
        </div>
      </div>

      <div className="bottom-bar" style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        <button className="btn btn-primary" onClick={onReplaySameDesign}>
          同じ通貨で、違う世界に挑戦する
        </button>
        <button className="btn btn-secondary" onClick={onNewCurrency}>
          新しい通貨を作る
        </button>
        <button className="btn btn-ghost" onClick={onHome}>
          ホームに戻る
        </button>
      </div>
    </div>
  );
}
