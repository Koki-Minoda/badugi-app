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
| Coach契約 | 20 PASS | 欠損、scope逸脱、NaN、自己承認、Experimental等を保留 |
| Coach実候補 | 4件監査、認定0 | Badugi / D01 / NLH / PLO。未認定を公開しない |
| prototype | 72組合せPASS | 2 browser×4寸法×3案×3ゲーム、重なり/overflow/44px target/タッチ/キーボード/履歴/金額/予約/交換 |
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

100連続hand×10 Core×3profileを検査中。11:44 JST時点で12/30ケース成功。
Badugi/NLHは3profile、PLO/FLO8はAndroid/iPhone相当、D01はAndroid/iPhone相当で各100handと履歴/replay/cashoutを確認。
デスクトップPLOは100hand終局したがHero操作43回で基準50回に未達のためFAILを維持し、別固定seedを追加検査する。
完了reportだけを `v1-browser-summary.mjs` が集計し、欠落はNOT_VERIFIED、失敗記録はFAILにする。
初回の即時終局ID誤判定は #299 / PR #300へ分離。controllerと履歴の別namespaceを含む回帰6/6。
修正版のBadugi desktopとD01 Android/iPhoneは通過したが、独立Reviewとmergeは未実施。
初回ローカルbackend503は保存し、原因確定や修正済みとは扱わない。
120分連続、全Tournament組合せ、独立勝敗fixture、物理iPhone/Android、初見利用者、
Coachの独立戦略評価は別Gateとして残る。

公開版は監査開始時4eb38c7f。PR #290のmainは9ee9609b。
全Gateとbackup付きの本番dispatch41373909127を開始した。
同一SHAのpush QA run41372489701は配備dispatchを先行させるため中止し、PASSには数えない。
11:44 JST時点でdispatchの16 QA中15成功、core5-qaが実行中。配備はまだ未確認。
自作draft PRの旧head CIも実行枠を空けるため中止した。最新headのCIは別runで確認する。
配備成功、公開SHA照合、公開監査、重複配備のない全nightly成功が揃うまで #291を閉じない。

## 続行：B選定と公開照合

- ユーザーが中間のA回答をB Decision Firstへ訂正し、続行を指示。Bを実装方向として記録。実機・独立利用者の品質測定とは分ける。
- 本番dispatch41373909127は全16 QA、backup、配備、healthを含め成功。公開SHAは9ee9609bに一致。
- `reports/production-release/v1-20261102-1302.json` は43 requests / 20 portraits / issues0でPASS。全nightly41384089647は別runで実行中のため #291を解消済みにしない。
- PR #297 head e3dc15d1、#300 head5e2a379a、#298 head3040b3c7のCI成功。後続commitのCIへは流用しない。
- ブラウザ長時間QAは17/30ケース成功、4ケースcoverage不合格、Stud系9ケースを別runで検査中。PLOの別seedも不合格で、Hero stack0後の観戦区間が主因。S01も同様。基準や初回記録を変えず #303へ調査を分離。
- Bの第一段階は #302：desktop/mobile共通の現ハンド履歴Sheet。常時stripを置換し、canonical操作イベントを読む。Appへの変更は参照先・5件制限の解除・handIdの追加のみ。engine/合法手/CPUを変更しない。
