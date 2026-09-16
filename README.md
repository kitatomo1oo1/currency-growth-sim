# 通貨育成・世界経済シミュレーション

スマートフォンのブラウザで無料で遊べる、通貨育成・世界経済シミュレーションゲーム。
プレイヤーが自分の通貨を設計し、最大50年間の歴史を「発行 → 5年進める → 出来事 →
変化 → なぜ？ → 政策を選ぶ → 次の5年へ」というサイクルで体験する。

詳しい設計判断は [docs/spec-audit.md](docs/spec-audit.md) を参照。

## 技術構成

- TypeScript / React / Vite / Vitest
- Economic Core（`src/core/`）はReactに依存しない純TypeScriptとして実装
- 状態はlocalStorageにセーブ（サーバー不要、静的ホスティング可能）
- 外部API・課金・ログイン・AI APIなし

## セットアップ

Node.js（v20以降推奨）が必要。このリポジトリでは管理者権限なしで使えるポータブル版
Node.js を `%LOCALAPPDATA%\Programs\nodejs-portable` に展開し、ユーザーPATHへ追加済み。
新しいターミナルであれば `node -v` で確認できる。反映されていない場合は、その場限り
以下でPATHを通してから実行する。

```bash
export PATH="/c/Users/kitaz/AppData/Local/Programs/nodejs-portable:$PATH"
```

## 起動方法（開発サーバー）

```bash
npm install
npm run dev
```

`http://localhost:5173` をスマホ幅（375px程度）でブラウザ表示して確認する。

## 本番ビルド

```bash
npm run build
```

`dist/` に静的ファイル一式が出力される（サーバーサイド処理なし、そのままどこでも
静的ホスティング可能）。`npm run preview` でビルド結果をローカル確認できる。

## テスト

```bash
npm test
```

Invariant（不変条件）・Reproducibility（再現性）・Causality（因果性）の自動テストを実行する。

## Simulation Runner（バランス検証）

```bash
npm run sim
```

UIを介さずGameStateを直接ドライブし、10/100/1,000周のスケールテスト、再現性テスト、
Dominant Strategy監査、Diversity監査、Extreme Test（複数の極端な設計×100周）、
10,000周のExtreme Testを実行してログを`sim-output/`へ保存する。

## ディレクトリ構成（主要部分）

```
src/
  core/                 Economic Core（純TypeScript、Reactに依存しない）
    types.ts            全State/型定義
    config.ts           バランス調整用定数の集約(simulationConfig)
    seed.ts              Seeded RNG（Math.random()不使用）
    state/               GameStateの初期化・バージョン管理
    engines/              World/Country/Currency各サブエンジン、Event/Policy Engine、
                          Explainability Ledger、Invariant検証、Annual Processing Order
    data/                 国データ、60イベント原型、24政策+NO_ACTION、学習トピック
    simulation/            Simulation Runner本体とCLIスクリプト
    storage/               localStorage保存/復元
    __tests__/             Vitestによる自動テスト
  game/
    gameController.ts     UIとCoreを繋ぐターン制御（5年進行・政策適用・セーブ）
  ui/
    screens/               Home/通貨作成/誕生/ターン結果/最終史の各画面
    labels.ts               列挙値の日本語ラベル
    styles/global.css       モバイルファーストのスタイル
```

## 既知の制限事項

- 国データは日本・アルト共和国・ノルド連合・デルタ連邦の4カ国（`src/core/data/countries.ts`
  に追加するだけで拡張可能）。OPEN交換の設計では「世界決済型」への分布集中（約75〜80%前後）が
  見られ、`npm run sim`の結果を見ながら`foreignShare`関連の閾値をさらに調整する余地がある。
- バランス（Bubble/Crash/PEG危機/Dormant/Recoveryの発生頻度など）は初版の基準Calibrationであり、
  `npm run sim`の結果を見ながら`src/core/config.ts`・イベント効果量を継続的に調整する余地がある。
- PEGGED通貨はSupply Ruleの組み合わせによって危機発生率が大きく変わる（AUTOMATIC供給は
  約60%超で危機化しやすい、FIXED/FLEXIBLEは10〜15%程度）。これは意図した設計上の帰結として
  残しているが、プレイテストでさらに調整しうる。
- 60イベント・24政策はスキーマ通り全件実装済みだが、効果量は簡易的な相対値であり、
  プレイテストに応じた微調整が前提。
- 自動テストはCore層（Invariant/Reproducibility/Causality）が中心で、UIコンポーネントの
  自動テストは未整備（手動でのブラウザ確認のみ実施、50年完走とReplayも手動確認済み）。
- PWA対応・アイコン・ファビコンは初版スコープ外（§2の指示通り）。
- DEAD（通貨が使われなくなり歴史が途中で終わる）は、SMALL規模の放置プレイで約3.6%発生する
  水準まで調整済み。NATIONAL/GLOBAL規模は初期の勢いが強く、放置だけでは終わりにくい
  （能動的に信用を損なう選択が重なった場合の終わりやすさは未検証）。勝敗・ランク付けは
  仕様上の理由から意図的に付けていない（§3参照）。
