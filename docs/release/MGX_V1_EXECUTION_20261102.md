# MGX v1 実行記録 2026-11-02

現在の状態はGitHub Issue、以下は実行証拠の記録。v1完成の承認ではない。

## 実装と正本

- #123を10 Coreと8 Gateの親ロードマップへ更新。旧本文を削除せず下部へ保全。
- #292 台帳、#293 Play比較、#294 Core QA、#295 Coach品質、#296 本番排他を起票。
- 本番排他はPR #297。配備とnightlyが相互に中断しない共有lock。502の原因を断定しない。
- ユーザーはiPhoneで後日確認できると回答。Android実機と独立した初見評価は未実施。

## ローカル検証

| 検証 | 今回の結果 | 範囲 |
| --- | --- | --- |
| sampled controller soak | 100,000 / 100,000 PASS | 10 Core×10 seed群×1,000独立hand、2〜6人、Check/Call/Pat。新しいbankrollで毎hand初期化 |
| progress | 180 PASS / 1既知SKIP | 11ファイル。harness人数指定の追加5ケースを含む |
| tier1 | 2,791 PASS / 1既知SKIP | 実行時点の全tier1 |
| RL safety | 64 PASS | 既存の入力/adapter安全性。戦略精度の証明ではない |
| Coach契約 | 18 PASS | 欠損、scope逸脱、NaN、自己承認、Experimental等を保留 |
| Coach実候補 | 4件監査、認定0 | Badugi / D01 / NLH / PLO。未認定を公開しない |
| prototype | 72組合せPASS | 2 browser×4寸法×3案×3ゲーム、重なり/overflow/履歴/金額/予約/交換 |
| lint | 0 errors / 既存2 warnings | 追加ファイルで新規警告なし |
| buildとモデル資産 | PASS | requiredモデル資産あり。optional欠落は台帳どおり |
| 本番排他回帰 | 2 PASS | PR #297の2workflowのlockとdispatch限定配備 |
| deploy static | PASS | admin9件、release identity3件を含む |

詳細は `reports/release-v1/engine-soak-20261102.json`、`prototype-layout.json`、`coach-audit.json`。
engine実行時のSHAは9ee9609b、未コミットharnessの実内容hashもレポートへ保存した。
勝敗のstrict検査は製品評価器も利用するため、独立評価器の合格には数えない。

## 失敗と修正の区別

prototypeの最初の検査は横overflowと操作だけで72件通ったが、目視でStudのHeroカードの減光と
横画面のseat/Pot重なりを発見。カードの表示と配置を修正し、幾何学的重なり検査を追加した。
追加検査でA案の横画面でも重なりを検出し、修正後に全72組合せを再検査した。

最初の連続ブラウザ検査3profileは、Vite previewが `/dev/` で起動して `/release.json` が404となり、
SHA固定検査で停止した。製品の対局失敗ではなくローカル配信設定の誤り。
初回reportを `browser-desktop` / `browser-android` / `browser-iphone` に保持し、
`--base /` の新しいpreviewでSHAとhealthを確認してから `browser-*-root` へ別runを開始した。
検査条件を緩めず、初回失敗を成功へ書き換えていない。

## 実行中と未確認

100連続hand×10 Core×3profileの実行を開始。完了reportだけを
`v1-browser-summary.mjs` が集計し、欠落があればINCOMPLETEを返す。
120分連続、全Tournament組合せ、独立勝敗fixture、物理iPhone/Android、初見利用者、
Coachの独立戦略評価は別Gateとして残る。

公開版は監査開始時4eb38c7f。PR #290のmainは9ee9609b。
既存push QA run41372489701を維持し、全Gateとbackup付きの本番dispatch41373909127を開始した。
配備成功、公開SHA照合、公開監査、重複配備のない全nightly成功が揃うまで #291を閉じない。
