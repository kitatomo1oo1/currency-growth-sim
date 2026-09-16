// Simulation Runner CLI。`npm run sim` で実行する（tsx経由、Node環境、UI非依存）。
// §56-63: 10/100/1,000/10,000周のバランス検証、再現性テスト、Dominant Strategy監査、Diversity監査を行う。
import fs from "node:fs";
import path from "node:path";
import type { CurrencyDesign } from "../types";
import { runSingleSimulation, runBatchSimulations, type PolicyStrategy, type SimulationRunResult } from "./simulationRunner";

const OUT_DIR = path.resolve(process.cwd(), "sim-output");
fs.mkdirSync(OUT_DIR, { recursive: true });

const log: string[] = [];
function report(line: string): void {
  console.log(line);
  log.push(line);
}

// ---- シナリオ設計 (§7 A〜D相当) ----
const designA: CurrencyDesign = {
  name: "シナリオA_日常小規模",
  symbol: "SCA",
  homeCountryId: "japan",
  issuerType: "COMPANY",
  supplyRule: "FLEXIBLE",
  exchangeRule: "OPEN",
  priceRule: "FLOATING",
  launchScale: "SMALL",
  useCases: ["RETAIL", "ECOMMERCE"],
};

const designB: CurrencyDesign = {
  name: "シナリオB_投資中心固定供給",
  symbol: "SCB",
  homeCountryId: "japan",
  issuerType: "ALGORITHMIC",
  supplyRule: "FIXED",
  exchangeRule: "OPEN",
  priceRule: "FLOATING",
  launchScale: "NATIONAL",
  useCases: ["SAVINGS_INVESTMENT"],
};

const designC: CurrencyDesign = {
  name: "シナリオC_新興国日常決済",
  symbol: "SCC",
  homeCountryId: "alt_republic",
  issuerType: "COMMUNITY",
  supplyRule: "FLEXIBLE",
  exchangeRule: "OPEN",
  launchScale: "NATIONAL",
  priceRule: "FLOATING",
  useCases: ["RETAIL", "UTILITY_BILLS"],
};

const designD: CurrencyDesign = {
  name: "シナリオD_ペッグ通貨",
  symbol: "SCD",
  homeCountryId: "japan",
  issuerType: "GOVERNMENT",
  supplyRule: "GRADUAL",
  exchangeRule: "OPEN",
  priceRule: "PEGGED",
  launchScale: "NATIONAL",
  useCases: ["RETAIL", "REMITTANCE"],
};

function summarizeBatch(results: SimulationRunResult[]) {
  const n = results.length;
  const avg = (f: (r: SimulationRunResult) => number) => results.reduce((s, r) => s + f(r), 0) / n;
  const typeCounts: Record<string, number> = {};
  for (const r of results) {
    for (const t of r.finalType) typeCounts[t] = (typeCounts[t] ?? 0) + 1;
  }
  const lifecycleCounts: Record<string, number> = {};
  for (const r of results) lifecycleCounts[r.finalLifecycle] = (lifecycleCounts[r.finalLifecycle] ?? 0) + 1;

  return {
    n,
    avgFinalValue: avg((r) => r.finalValue),
    avgPeakValue: avg((r) => r.peakValue),
    avgMaxDrawdown: avg((r) => r.maxDrawdown),
    avgHolders: avg((r) => r.holders),
    avgRegularUsers: avg((r) => r.regularUsers),
    avgBubbleCount: avg((r) => r.bubbleCount),
    avgCrashCount: avg((r) => r.crashCount),
    avgRecoveryCount: avg((r) => r.recoveryCount),
    avgForeignCountries: avg((r) => r.foreignCountries),
    avgUtilityShare: avg((r) => r.utilityShare),
    avgSpeculationShare: avg((r) => r.speculationShare),
    avgLifespan: avg((r) => r.lifespan),
    typeCounts,
    lifecycleCounts,
  };
}

function runScaleSteps(design: CurrencyDesign, label: string, steps: number[]) {
  report(`\n### ${label}: 段階的Simulation Runner (10→100→1,000→10,000)`);
  for (const n of steps) {
    const started = Date.now();
    const results = runBatchSimulations({ design }, n, `${design.symbol}-scale`);
    const summary = summarizeBatch(results);
    const elapsedMs = Date.now() - started;
    report(
      `  n=${n}: avgFinal=${summary.avgFinalValue.toFixed(2)} avgPeak=${summary.avgPeakValue.toFixed(2)} ` +
        `avgDrawdown=${(summary.avgMaxDrawdown * 100).toFixed(1)}% avgHolders=${Math.round(summary.avgHolders)} ` +
        `avgBubble=${summary.avgBubbleCount.toFixed(2)} avgCrash=${summary.avgCrashCount.toFixed(2)} ` +
        `avgLifespan=${summary.avgLifespan.toFixed(1)}年 (${elapsedMs}ms)`
    );
    report(`    type分布: ${JSON.stringify(summary.typeCounts)}`);
    report(`    lifecycle分布: ${JSON.stringify(summary.lifecycleCounts)}`);
  }
}

// ---- Reproducibility Test (§58) ----
function reproducibilityTest(design: CurrencyDesign, trials: number): boolean {
  report(`\n### Reproducibility Test: 同一Design+Seed+PolicySequenceを${trials}回実行`);
  const seed = "repro-fixed-seed-001";
  const policySequenceIds = ["NO_ACTION", "adoption_merchant_support", "trust_disclosure", "NO_ACTION"];
  let idx = 0;
  const strategy: PolicyStrategy = () => policySequenceIds[Math.min(idx++, policySequenceIds.length - 1)];

  const baseline = runSingleSimulation({ design, masterSeed: seed, policyStrategy: strategy }).result;
  let allMatch = true;
  for (let i = 1; i < trials; i++) {
    idx = 0;
    const strategyRepeat: PolicyStrategy = () => policySequenceIds[Math.min(idx++, policySequenceIds.length - 1)];
    const repeat = runSingleSimulation({ design, masterSeed: seed, policyStrategy: strategyRepeat }).result;
    const match = JSON.stringify(repeat) === JSON.stringify(baseline);
    if (!match) {
      allMatch = false;
      report(`  !! 不一致 (試行${i}): ${JSON.stringify(repeat)} !== ${JSON.stringify(baseline)}`);
    }
  }
  report(`  結果: ${allMatch ? "PASS（全" + trials + "回一致）" : "FAIL"}`);
  return allMatch;
}

// ---- Dominant Strategy Test (§62) ----
const strategies: Record<string, PolicyStrategy> = {
  常に追加発行: () => "supply_small_issuance",
  常に供給抑制: () => "supply_restraint",
  常に海外展開: () => "intl_overseas_expansion",
  常に投機抑制: () => "market_speculation_curb",
  常にNO_ACTION: () => "NO_ACTION",
};

function dominantStrategyTest(design: CurrencyDesign, seedsPerStrategy: number) {
  report(`\n### Dominant Strategy Test（design=${design.name}, seeds/strategy=${seedsPerStrategy}）`);
  const rows: Record<string, ReturnType<typeof summarizeBatch>> = {};
  for (const [label, strategy] of Object.entries(strategies)) {
    const results: SimulationRunResult[] = [];
    for (let i = 0; i < seedsPerStrategy; i++) {
      results.push(runSingleSimulation({ design, masterSeed: `dom-${label}-${i}`, policyStrategy: strategy }).result);
    }
    rows[label] = summarizeBatch(results);
    const s = rows[label];
    report(
      `  ${label}: 価格=${s.avgFinalValue.toFixed(2)} 実需share=${s.avgUtilityShare.toFixed(2)} ` +
        `投機share=${s.avgSpeculationShare.toFixed(2)} holders=${Math.round(s.avgHolders)} ` +
        `crash=${s.avgCrashCount.toFixed(2)} lifespan=${s.avgLifespan.toFixed(1)}`
    );
  }

  // 4軸(価格・実需・信用代理としてholders・活動量代理としてlifespan)で常勝しているか簡易判定
  const axes: Array<{ key: keyof ReturnType<typeof summarizeBatch>; label: string }> = [
    { key: "avgFinalValue", label: "価格" },
    { key: "avgUtilityShare", label: "実利用" },
    { key: "avgHolders", label: "利用者数" },
    { key: "avgLifespan", label: "存続年数" },
  ];
  const winCounts: Record<string, number> = {};
  for (const axis of axes) {
    let bestLabel = "";
    let bestValue = -Infinity;
    for (const [label, s] of Object.entries(rows)) {
      const v = s[axis.key] as number;
      if (v > bestValue) {
        bestValue = v;
        bestLabel = label;
      }
    }
    winCounts[bestLabel] = (winCounts[bestLabel] ?? 0) + 1;
    report(`  軸[${axis.label}]の最高平均: ${bestLabel}`);
  }
  const dominant = Object.entries(winCounts).find(([, count]) => count >= axes.length);
  report(
    dominant
      ? `  !! 警告: 「${dominant[0]}」が全軸で最高平均 → 要再調整`
      : `  結果: 単一戦略が全軸を独占していない（状況依存性あり）`
  );
}

// ---- Diversity Test (§9) ----
function diversityTest(design: CurrencyDesign, seeds: number) {
  report(`\n### Diversity Test（design=${design.name}固定, Seedのみ変更 x${seeds}）`);
  const results = runBatchSimulations({ design }, seeds, `diversity-${design.symbol}`);
  const finalValues = results.map((r) => r.finalValue);
  const lifespans = results.map((r) => r.lifespan);
  const bubbleCounts = results.map((r) => r.bubbleCount);
  const uniqueTypeCombos = new Set(results.map((r) => r.finalType.sort().join("+"))).size;

  const variance = (arr: number[]) => {
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  };

  report(`  finalValue: min=${Math.min(...finalValues).toFixed(2)} max=${Math.max(...finalValues).toFixed(2)} variance=${variance(finalValues).toFixed(2)}`);
  report(`  lifespan: min=${Math.min(...lifespans)} max=${Math.max(...lifespans)}`);
  report(`  bubbleCount分布: min=${Math.min(...bubbleCounts)} max=${Math.max(...bubbleCounts)}`);
  report(`  ユニークな最終Type組み合わせ数: ${uniqueTypeCombos} / ${seeds}`);
}

// ---- Extreme Test (§60) ----
function extremeTest(): void {
  report(`\n### Extreme Test（不変条件違反・例外の検出、各極端ケースを100周ずつ）`);
  const extremeDesigns: Array<{ label: string; design: CurrencyDesign }> = [
    { label: "FIXED供給", design: { ...designB, supplyRule: "FIXED" } },
    { label: "GRADUAL大量発行的", design: { ...designA, supplyRule: "GRADUAL" } },
    { label: "AUTOMATIC供給", design: { ...designA, supplyRule: "AUTOMATIC" } },
    { label: "CLOSED交換", design: { ...designC, exchangeRule: "CLOSED" } },
    { label: "PEGGED通貨", design: designD },
    { label: "GLOBAL投機色強め", design: { ...designB, launchScale: "GLOBAL", useCases: ["SAVINGS_INVESTMENT"] } },
  ];

  let totalRuns = 0;
  let totalFailures = 0;
  for (const { label, design } of extremeDesigns) {
    let failures = 0;
    const n = 100;
    for (let i = 0; i < n; i++) {
      totalRuns++;
      try {
        runSingleSimulation({ design, masterSeed: `extreme-${label}-${i}` });
      } catch (e) {
        failures++;
        totalFailures++;
        if (failures <= 2) {
          report(`  !! 例外(${label}, seed=${i}): ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
    report(`  ${label}: ${n}周中 失敗=${failures}`);
  }
  report(`  合計: ${totalRuns}周中 失敗=${totalFailures} (${totalFailures === 0 ? "PASS" : "FAIL"})`);
}

// ---- 10,000周 Extreme Test（§60必須の最低1回） ----
function massExtremeTest(design: CurrencyDesign, n: number): void {
  report(`\n### 10,000周 Extreme Test（design=${design.name}）`);
  let failures = 0;
  const started = Date.now();
  for (let i = 0; i < n; i++) {
    try {
      runSingleSimulation({ design, masterSeed: `mass-${i}` });
    } catch (e) {
      failures++;
      if (failures <= 3) report(`  !! 例外(seed=${i}): ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const elapsedMs = Date.now() - started;
  report(`  ${n}周中 失敗=${failures} (${elapsedMs}ms, ${(elapsedMs / n).toFixed(2)}ms/周) → ${failures === 0 ? "PASS" : "FAIL"}`);
}

function main() {
  report(`# Simulation Runner 実行ログ (${new Date().toISOString()})`);

  runScaleSteps(designA, "シナリオA(日常小規模)", [10, 100, 1000]);
  reproducibilityTest(designA, 5);
  dominantStrategyTest(designA, 30);
  diversityTest(designA, 100);
  extremeTest();
  massExtremeTest(designA, 10000);

  const outFile = path.join(OUT_DIR, `run-${Date.now()}.log`);
  fs.writeFileSync(outFile, log.join("\n"), "utf-8");
  report(`\nログを保存しました: ${outFile}`);
}

main();
