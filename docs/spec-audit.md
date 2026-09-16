# 仕様監査（実装開始前）

対象: 「通貨育成・世界経済シミュレーション」Codex実装指示 v1.0 ＋ Codex自律実行指示
実施日: 2026-09-16
方針: Codex自律実行指示 §1〜3 に従い、根本思想に関わらない技術的な不足は本ドキュメントに記録し、
ユーザーへは確認せず最小限の解決方法を採用してそのまま実装へ進む。

## 1. 実装責務の監査

指示書 §6 の Architecture 分割はそのまま採用可能。責務境界を以下のように確定する。

- **World Engine**: worldSeedから長期環境(Growth/Crisis/Techサイクル等)を生成し、年次でWorldStateを更新。
- **Country Engine**: 国別の人口・所得水準・既存通貨信用などCountryStateを更新。プレイヤー通貨には
  依存しない外生変数のみを持つ（プレイヤー通貨の状態をCountryEngineが直接書き換えることは禁止）。
- **Currency Engine**: Supply/Demand/Adoption/Trust/Price/FX/Inflation-Deflation/Bubble-Crisis/Peg-Reserve
  の9サブモジュールに分割し、`yearProcessor.ts`が§39の順序で呼び出す。各サブモジュールは前年の
  CurrencyStateとその年に確定した外生入力(Event効果・Policy効果・World/Country状態)のみを参照する。
- **Event Engine / Policy Engine**: 共通Effect API（§38）経由でのみCurrencyState等を変更。
  個別イベントのifブロックで直接Stateを触らせない。
- **Learning Engine**: YearRecordの差分とEventカテゴリから、体験済みLearningTopicを判定するだけの
  副作用フリーな関数。Core計算には影響しない。
- **Explainability Ledger**: yearProcessorの各ステップが構造化ログを書き込み、他のEngineは
  Ledgerを読み取らない（一方向）。
- **History Generator**: 50年分のYearRecordから縦型タイムライン用の節目(最大10件程度)を抽出する
  純関数。Core状態を変更しない。
- **Storage**: GameStateのシリアライズ/デシリアライズとversion管理のみ。Core計算を含まない。
- **Simulation Runner**: UIを介さずGameStateを直接ドライブし、yearProcessorを繰り返し呼ぶだけの
  ラッパー。UIとCoreの結合テストを兼ねる。
- **UI**: `CurrencyDesign`ないし`Policy ID`ないし`Advance`コマンドのみをGame Controller経由でCoreに渡す。
  UIはCoreの内部StateをPropsとしてのみ保持し、直接ミューテートしない（Reactの不変更新でGameState
  スナップショットを差し替える形にする）。

矛盾なし。この分割のまま実装する。

## 2. State依存関係の監査

§7〜9のState定義はほぼ網羅的。ただし以下の暗黙の依存関係を明確化する必要がある。

- `CurrencyState`は単一通貨・単一homeCountryだが、`foreignDemand`/`fxExposure`は複数国を跨ぐ。
  → `CountryState`ごとに「プレイヤー通貨の普及度」を持たせず、CurrencyState側に
  `foreignAdoption: Record<countryId, {activeUsers, awareness}>`を追加する（最小限の拡張、
  spec違反ではなくspecが暗黙に要求する構造を明示化しただけ）。
- `regularUsers <= activeUsers <= holders`の不変条件を満たすには、これら3値を独立変数ではなく
  「holdersを基準に各年の遷移率(activation rate, regularization rate, churn rate)」から算出する
  構造にする。3値を無関係な独立ロジックで別々に更新すると容易に不変条件が壊れるため。
- `fundamentalValue`と`baseValue`(市場価格)は別変数として保持し、UIには`baseValue`のみを
  「価格」として表示、`fundamentalValue`は内部Explainability用（§14の指示通り）。

矛盾なし。上記2点を最小拡張として採用する。

## 3. 年間処理経路（Annual Processing Order）の監査

§39の25ステップは順序として実行可能。§13「Momentumは直近複数年参照」と§39「Year Nの価格反応は
Year N+1の人間行動に作用」は整合している（t-1,t-2,t-3のreturnは全て確定済み過去年のため、同一年内
循環にならない）。

一点補足が必要: ステップ6-9(Demand)はステップ13(Market value)より前に実行されるため、Demandは
「前年確定価格(baseValue[t-1])」を参照する。これはspec通り（Year Nの価格→Year N+1の行動という
指示と整合）。

矛盾なし。

## 4. 循環参照の有無

- Price(§15)はTrust/Liquidity/World/Regimeを参照 → Trust/Liquidityはステップ18で
  Priceより後に確定する。よってPrice計算(step13)は**前年確定値**のTrust/Liquidityを使う。
  Regimeもステップ21でPriceより後。よってPrice計算はこちらも前年のRegimeを使う。
  これは「同一年でPrice→Behavior→Priceを繰り返す循環計算は禁止」(§39末尾)と整合させるための
  必須ルールとして明文化し、コード内コメントで固定する。
- Bubble Pressure(step19)はpriceAcceleration等、既に確定したMarket Value(step13)を参照するため
  循環なし。

矛盾なし。「全てのサブモジュールは当年でまだ確定していない値を参照する場合、必ず前年値を使う」を
実装規約として固定する。

## 5. 未定義値の監査

- 初期年(2026年、ターン0)のcurrentYear=startYearの時点で「前年値」が存在しない箇所は、
  CurrencyDesignとLaunchScaleから決定的な初期値テーブルを用意する（`initialState.ts`）。
  例: SMALL/NATIONAL/GLOBALごとにholders初期値・awareness初期値を規定。
- `simulationConfig`(§15-17で言及)に、価格感応度・Bubble閾値・流動性閾値などの全定数を集約する
  単一ファイルを作る（コード中に散在させない、との明示指示に対応）。
- 60イベント/24政策のテキストテンプレートは日本語で用意する(CLAUDE.mdの全社的規約: コメント・
  UI・CLI出力は日本語)。

矛盾なし。

## 6. テスト可能性の監査

Economic CoreをReactから独立させる指示(§2)により、Vitestで直接Core関数をテスト可能。
Seed分離(§41)によりworldSeed/marketSeed/eventSeedを個別に派生させれば、
Reproducibility Test(§58)・Causality Tests(§59)は決定的に実行可能。
Simulation Runner(§56)はNode環境で動くよう、DOM/React依存を持たせない。

矛盾なし。

## 7. 実装上の矛盾チェック（発見事項と採用した最小解決）

1. **PEGGEDかつFLOATING以外の価格変化経路**: §27でPEGGEDはPrice変化を原則Reserve Pressureへ
   転換するとあるが、§15の市場価格形成ロジックとどう共存するかが未規定。
   → 採用解: PEGGEDの場合、step13(Market value)は「target pegged value」を返し、
   需給差分はstep13直後に`pegConfidence`/`redemptionPressure`/`reserveRatio`へ配分する
   専用の分岐(`peg.ts`)を挟む。市場価格自体は基本的にpeg目標値近傍に留め、pegConfidenceが
   一定閾値を割った場合のみdepegを許容する（浮動側の価格レンジに合流）。これは§27の
   「危機を表現可能にする」という要求を満たす最小拡張。

2. **Exchange=CLOSEDと海外需要の関係**: §23でOPEN Exchangeなら海外開始前でも小さなFX Exposureが
   有り得るとあるが、CLOSEDの場合の扱いが未規定。
   → 採用解: `exchangeRule === "CLOSED"`の場合、`foreignDemand`と`fxExposure`は常に0に固定する
   （§59 Causality TestsのExchange CLOSED項目とも整合）。

3. **Supply Rule=FIXEDの発行系政策**: 「小規模/大規模追加発行」政策はFIXED Supply通貨には
   適用不可という制約が必要（そうしないとFIXEDの意味が消える）。
   → 採用解: Policy定義の`prerequisites`/`forbiddenIf`相当の適用条件として、
   発行系政策は`currencyDesign.supplyRule !== "FIXED"`を前提条件にする。
   代わりにFIXED向けには§22の決済効率改善系政策(divisibility/paymentEfficiency)を用意する。

4. **60イベント/24政策の完全なテキスト・数値チューニングまでを初版で完成させるか**:
   指示は「初版60イベント原型」「24政策＋NO_ACTION」を要求しているため、全件を
   共通Schemaで実装する。個々の効果量は`simulationConfig`の基準スケールに対する
   相対値（例: small/medium/large severity）として定義し、Simulation Runnerでの
   1,000〜10,000周検証(§61-63)で異常挙動があれば重み・効果量を調整する
   （テキスト文言自体は固定、数値は調整対象）。

いずれも「経済思想」を変更するものではなく実装上の穴埋めのため、ユーザー確認は不要と判断し、
上記の通り採用して実装を進める。

## 結論

重大な矛盾は見つからなかった。上記7項目の最小解決を採用のうえ、Implementation Order(§64)の
STEP 1から着手する。
