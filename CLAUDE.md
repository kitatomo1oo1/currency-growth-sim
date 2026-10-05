# 通貨育成シミュレーション

目的：通貨を育てて存続させる、世界経済のシミュレーションゲーム。為替（FX業務）とは別のプロジェクトで、為替のファイルは触らない。

## 動かし方
- 起動 npm run dev／テスト npm test／バランス検証 npm run sim／ビルド npm run build
- Node.js はポータブル版。コマンドの前に export PATH="/c/Users/kitaz/AppData/Local/Programs/nodejs-portable:$PATH" を付ける（README.md）
- main に push すると GitHub Actions が GitHub Pages に公開する（https://kitatomo1oo1.github.io/currency-growth-sim/）
- git のメールは GitHub の noreply を使う（Gmail だと push が拒否される）

## 守ること
- 変えたら npx tsc --noEmit → npm test → npx tsx src/core/simulation/runBatch.ts（Invariant 違反0件）→ npm run build の順で確かめてから、コミット・push する（push は本人の指示の後）
- State の変更は Effect API 経由だけ。Seed の分離、年次処理の順番、勝敗・ランク付けをしないこと、は仕様書§3の禁止事項なので壊さない
- 「完成」を自分で判断しない。本人が遊んだ感想を優先する
- バランス・遊び心地の指摘は、推測で直さない。runSingleSimulation／runBatchSimulations を使う使い捨ての scratch-*.ts を npx tsx で動かし、数字で確かめてから直す。直した後も同じ方法で確かめ、scratch は消す
