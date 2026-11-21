# MGX 操作性QMの修正記録

対象は [2026年11月20日のQM一覧](MGX_USABILITY_QM_20261120.md)。項目ごとに修正、回帰検証、コミットを完了してから次へ進んだ。P1の4件、P2の16件、P3の4件を順に修正し、統合確認で見つかった追補2件も独立したコミットにした。

| 項目 | Issue | コミット | 修正内容 | 確認結果 | 状態 |
|---|---|---|---|---|---|
| U01 | [#431](https://github.com/Koki-Minoda/badugi-app/issues/431) | [0f1aaab9](https://github.com/Koki-Minoda/badugi-app/commit/0f1aaab9be9f8283fc7e7caf91ad6d703ee2b154) | ゲームURLの開始種目とCPUの強さを認証後に引き継ぐ。メニューへ戻る際の再起動を防ぐ | 起動・学習導線25件、既知不具合50件、RL安全性66件が通過。lintはエラー0件、既存警告3件 | ローカル回帰検証済み |
| U02 | [#432](https://github.com/Koki-Minoda/badugi-app/issues/432) | [5a691117](https://github.com/Koki-Minoda/badugi-app/commit/5a691117d0990dbd7d80338262b19da2ecccc0cc) | メニュー側の履歴にマイ結果への入口を追加。保存済み・対局中の完了履歴を共通取得し重複除去。結果から再生後に戻れる | 導線・保存履歴5件、既存履歴4件、既知不具合50件、RL安全性66件が通過。lintエラー0件 | ローカル回帰検証済み |
| U03 | [#434](https://github.com/Koki-Minoda/badugi-app/issues/434) | [c5ed1d7a](https://github.com/Koki-Minoda/badugi-app/commit/c5ed1d7ad4369196cda908b4aca4e98c7215ae75) | 自分の手札と操作をCPU詳細より前に表示。開始時に操作領域へ移動 | 練習20件、PC Chromium・iPhone SE WebKitの画面内表示2件、既知不具合50件、RL安全性66件が通過。全席操作・手札公開を維持 | ローカル回帰・画面確認済み |
| U04 | [#435](https://github.com/Koki-Minoda/badugi-app/issues/435) | [32a34d6c](https://github.com/Koki-Minoda/badugi-app/commit/32a34d6c9a10c75f3d9932294f659337b348d8f7) | AI調整・RL収集・JSONL出力を開発環境の明示的なdebug指定時に限定 | 通常・開発・本番表示とプロフィール5件、既知不具合50件、RL安全性66件、build通過。lintエラー0件 | ローカル回帰検証済み |
| U05 | [#436](https://github.com/Koki-Minoda/badugi-app/issues/436) | [5cd2a912](https://github.com/Koki-Minoda/badugi-app/commit/5cd2a912f027c956fe7f9712d5ad44601ca3b24c) | キャッシュと設定への入口を各1つに集約。主ボタンと既存の組み込み・単独動作を維持 | メニュー15件、既知不具合50件、RL安全性66件が通過 | ローカル回帰検証済み |
| U06 | [#437](https://github.com/Koki-Minoda/badugi-app/issues/437) | [87d708ed](https://github.com/Koki-Minoda/badugi-app/commit/87d708edd2473edfadb6b5684d30fff92180245e) | スマホのロゴ・導入を縮小し主操作を上へ。固定のシーズン等の要約を整理し文字を拡大 | メニュー15件、375×667の主要5操作表示1件、既知不具合50件、RL安全性66件が通過。確認画像: [スマホ](../../reports/usability-fixes/2026-11-21/u06-mobile-menu.png) | ローカル回帰・画面確認済み |
| U07 | [#438](https://github.com/Koki-Minoda/badugi-app/issues/438) | [e74089ab](https://github.com/Koki-Minoda/badugi-app/commit/e74089aba7fbc9c11518995565acd6248dc32d16) | 種目カードの内部ID・優先度・評価器情報・QA文を除き、公開状態を1つに集約。開始可否とCPU選択は維持 | ゲーム選択6件、既知不具合50件、RL安全性66件が通過 | ローカル回帰検証済み |
| U08 | [#439](https://github.com/Koki-Minoda/badugi-app/issues/439) | [cdb30a3d](https://github.com/Koki-Minoda/badugi-app/commit/cdb30a3db4842057acec58fcbe3de19fc5d53d41) | 認証・履歴・精算・プロフィール・席設定の主要操作と条件表示を日英対応。認証画面に言語切替を追加 | 言語・起動・結果11件、既存履歴4件、既知不具合50件、RL安全性66件、build通過。lintエラー0件 | ローカル回帰検証済み |
| U09 | [#440](https://github.com/Koki-Minoda/badugi-app/issues/440) | [97fab94a](https://github.com/Koki-Minoda/badugi-app/commit/97fab94ad6c9d7e9fa9ed26f06261e6b03e2d4a3) | 未復習→誤答→保存条件→初回クイズ等から次の1操作だけを案内。常設ツールは維持 | 学習進捗8件、既知不具合50件、RL安全性66件が通過。復習後の次操作切替・破損データも確認 | ローカル回帰検証済み |
| U10 | [#441](https://github.com/Koki-Minoda/badugi-app/issues/441) | [b8cd7b5f](https://github.com/Koki-Minoda/badugi-app/commit/b8cd7b5f04c6557e49f4696527a80fb4b168cb75) | 37種目を1つのプルダウンで選び、直後にルールとプレイ操作を表示 | 学習14件、既知不具合50件、RL安全性66件が通過。全種目・選択後の開始URL・MIX順を確認 | ローカル回帰検証済み |
| U11 | [#442](https://github.com/Koki-Minoda/badugi-app/issues/442) | [f2ab8f6f](https://github.com/Koki-Minoda/badugi-app/commit/f2ab8f6f63595a2368d80dc911d9a405fb4ad3cc) | 復習の絞り込みを初期状態で折りたたみ、適用中の状態・種目・タグ・検索を要約 | 復習・学習15件、既知不具合50件、RL安全性66件が通過。閉じても検索とURL条件を維持 | ローカル回帰検証済み |
| U12 | [#443](https://github.com/Koki-Minoda/badugi-app/issues/443) | [60a2d79f](https://github.com/Koki-Minoda/badugi-app/commit/60a2d79f96b3a206ce8817c5f186898179d2ae6e) | 復習カードは種目・日時・開始手札・練習区分・ポット・メモを優先し、長いIDは展開後の詳細へ | 復習8件、既知不具合50件、RL安全性66件が通過。ID検索と保存キーは維持 | ローカル回帰検証済み |
| U13 | [#444](https://github.com/Koki-Minoda/badugi-app/issues/444) | [14365a0e](https://github.com/Koki-Minoda/badugi-app/commit/14365a0e97697c4acfb575cb66a812f2d10f321b) | 開始手札を先に示し、52枚の編集と練習条件を開閉式に。枚数上限の理由と特別な設定は明示 | 練習36件、PC/iPhone操作・375×667での開始と編集3件、既知不具合50件、RL安全性66件が通過。画像: [開始設定](../../reports/usability-fixes/2026-11-21/u13-mobile-setup.png) | ローカル回帰・画面確認済み |
| U14 | [#445](https://github.com/Koki-Minoda/badugi-app/issues/445) | [288cb499](https://github.com/Koki-Minoda/badugi-app/commit/288cb499f5332c5585430b364ddc8f46e70766da) | 入力済み手札は閲覧表示とし、追加・削除は編集を開いて実施。交換指定は手札編集と目的を明示 | 手札編集2件、PC/スマホ操作2件、既知不具合50件、RL安全性66件が通過。枚数・重複制約を維持 | ローカル回帰・ブラウザー操作確認済み |
| U15 | [#446](https://github.com/Koki-Minoda/badugi-app/issues/446) | [bfd39851](https://github.com/Koki-Minoda/badugi-app/commit/bfd398512e58abd35976e65361345458bfa24c35) | レンジA・Bを同じ開閉式エディターに統一し、候補選択と入力行数を先に表示 | 手札・レンジ編集3件、既知不具合50件、RL安全性66件が通過。A/Bの独立編集と重みの説明を確認 | ローカル回帰検証済み |
| U16 | [#447](https://github.com/Koki-Minoda/badugi-app/issues/447) | [467bc7c4](https://github.com/Koki-Minoda/badugi-app/commit/467bc7c48dc43b178e520456492cca683bcc7c87) | A/B比較の後に続く詳細をレンジAと明示し、自分・相手の交換条件と残りドローを表示 | 詳細条件・手札・レンジ編集4件、既知不具合50件、RL安全性66件が通過。最終手札への切替も確認 | ローカル回帰検証済み |
| U17 | [#448](https://github.com/Koki-Minoda/badugi-app/issues/448) | [54eed75b](https://github.com/Koki-Minoda/badugi-app/commit/54eed75be960b85fe7b7c493c9f55d3ad4f71875) | 通常キャッシュの進行を卓上の表示に集約し、待機表示の重複を削除。MIX・操作中の人・大会は維持 | レイアウト・起動24件、既知不具合50件、RL安全性66件が通過 | ローカル回帰検証済み |
| U18 | [#449](https://github.com/Koki-Minoda/badugi-app/issues/449) | [3f3441fe](https://github.com/Koki-Minoda/badugi-app/commit/3f3441fe24388ed032402da1525063bcf48bc17c) | 名前から詳細を明示開閉しHUD幅を縮小。種目にないストリートと未測定の列を除外し、測定済み指標だけ表示 | プレイヤー表示30件、既知不具合50件、RL安全性66件が通過。Badugi・Stud・NLH・未集計・開閉を確認 | ローカル回帰検証済み |
| U21 | [#450](https://github.com/Koki-Minoda/badugi-app/issues/450) | [9836ef6f](https://github.com/Koki-Minoda/badugi-app/commit/9836ef6f0a8f2194d979c62a7ec88320c00e1fc8) | 未解放MIXは内容の閲覧として表示し編集・削除を無効化。プリセット確認では保存せず、編集前と保存・開始の近くに解放条件を表示 | MIX・学習18件、既知不具合50件、RL安全性66件が通過。解放後の操作と閲覧時の保存なしを確認 | ローカル回帰検証済み |
| U22 | [#451](https://github.com/Koki-Minoda/badugi-app/issues/451) | [bd506f9f](https://github.com/Koki-Minoda/badugi-app/commit/bd506f9f6d13bc5239cc99ecc0ceef4c1837dc47) | MIX名に統一し、除外・出現頻度・カテゴリ候補を種目名の選択へ。保存するIDとカテゴリ重みは維持 | MIX・学習19件、既知不具合50件、RL安全性66件が通過。種目名からID保存・カテゴリ候補・重みまで確認 | ローカル回帰検証済み |
| U19 | [#452](https://github.com/Koki-Minoda/badugi-app/issues/452) | [3bd05888](https://github.com/Koki-Minoda/badugi-app/commit/3bd0588825663b1e5d5607dce5452245dadadf9b) | 性能計測の通知を明示した開発表示だけに限定。通常の待機案内は維持 | 進行・計測表示5件、既知不具合50件、RL安全性66件が通過 | ローカル回帰検証済み |
| U20 | [#453](https://github.com/Koki-Minoda/badugi-app/issues/453) | [7bdf0040](https://github.com/Koki-Minoda/badugi-app/commit/7bdf0040a7f80b70f830d955dc264cb6cc5bb3ad) | プロフィールの未提供指標の予告と設定の将来用途の案内を削除。現在の指標・名前の表示先・編集説明は維持 | プロフィール・設定6件、既知不具合50件、RL安全性66件が通過 | ローカル回帰検証済み |
| U23 | [#454](https://github.com/Koki-Minoda/badugi-app/issues/454) | [81414e80](https://github.com/Koki-Minoda/badugi-app/commit/81414e801e97d609d556d0e04545359aef6e94e6) | 大会一覧を名前・人数・具体的な参加条件へ簡略化。CPU・持ち点・ストラクチャー等は選択後に確認 | 大会15件、既知不具合50件、RL安全性66件が通過。4大会の詳細切替と開始・再開を維持 | ローカル回帰検証済み |
| U24 | [#455](https://github.com/Koki-Minoda/badugi-app/issues/455) | [f7767af1](https://github.com/Koki-Minoda/badugi-app/commit/f7767af1ce00ac836082724744131daa9ba91c82) | 3rd練習の問題文でBBetを最終ストリートのベット額の何倍かと併記 | 日英の初出説明・既存EV7件、既知不具合50件、RL安全性66件が通過 | ローカル回帰検証済み |
| U05 再確認 | [#457](https://github.com/Koki-Minoda/badugi-app/issues/457) | [43bec978](https://github.com/Koki-Minoda/badugi-app/commit/43bec9780dc8a90b3bae9d109078655db68e0c56) | タイトル経由の説明だけの旧設定画面を既存の編集画面へ接続。メニューへの戻りと44pxの操作領域を確保 | 起動・設定・言語9件、統合ブラウザー操作8件、既知不具合50件、RL安全性66件、build通過。言語変更と再読込を確認 | ローカル回帰・ブラウザー操作確認済み |
| U08 再確認 | [#458](https://github.com/Koki-Minoda/badugi-app/issues/458) | [37e3fec2](https://github.com/Koki-Minoda/badugi-app/commit/37e3fec251fe701da05d8c617adba32e191c78c9) | プロフィールの入力・保存・検証・初期化の文言も日英に統一。親画面の再描画後も保存通知を維持 | フォーム・設定・言語9件、既知不具合50件、RL安全性66件、build通過。保存値の契約を維持 | ローカル回帰検証済み |

各項目のコミットはIssueとGit履歴で追跡する。本番反映後の再QMは別途記録する。

U03の確認画像: [iPhone](../../reports/usability-fixes/2026-11-21/u03-iphone-controls.png)、[PC](../../reports/usability-fixes/2026-11-21/u03-desktop-controls.png)。ブラウザー検証画像であり、iOSシミュレーターでの再確認は未実施。

## 最終の統合確認

実装の検証対象は `37e3fec251fe701da05d8c617adba32e191c78c9`。元の24件と追補2件について、作業ツリーに未コミットの製品変更がない状態で確認した。

| 確認 | 結果 |
|---|---|
| 関連UI・計算 | 38ファイル、276件通過 |
| 履歴の既存画面 | 2ファイル、4件通過 |
| 既知のゲーム不具合 | 50件通過 |
| RL安全性 | 66件通過 |
| PC・スマホのブラウザー操作 | 8件通過 |
| lint | エラー0件、既存警告3件 |
| 製品ビルド | 通過 |

ブラウザーでは、手札と操作の画面内表示、開始手札の編集、メニューの主要操作、エクイティの編集と交換指定、設定への入口、言語変更と再読込を確認した。認証が必要なメニュー確認にはローカルテスト用の認証応答を使った。実アカウントの認証や本番の再QMを済ませたという意味ではない。

[検証結果と画像ハッシュ](../../reports/usability-fixes/2026-11-21/final/verification.json)、[スマホメニュー](../../reports/usability-fixes/2026-11-21/final/menu-mobile.png)、[iPhoneサイズの練習](../../reports/usability-fixes/2026-11-21/final/practice-iphone.png)、[手札設定](../../reports/usability-fixes/2026-11-21/final/practice-setup-mobile.png)、[エクイティ](../../reports/usability-fixes/2026-11-21/final/equity-mobile.png)、[設定](../../reports/usability-fixes/2026-11-21/final/settings-mobile-en.png)。

修正後のiOSシミュレーターでの再QM、本番反映後の再QMは未実施。元のQMで追加確認に挙げた通常キャッシュの待機、履歴が不足していたグラフ状態は、この修正だけで解決・確認済みとは扱わない。
