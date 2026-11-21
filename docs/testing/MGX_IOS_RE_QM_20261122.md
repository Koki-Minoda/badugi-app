# MGX iOSシミュレーター再QM（2026-11-21〜22）

対象: 個別修正済みの24項目・追補2項目。実機サイズのブラウザー検証に加え、Xcode Device HubのiPhone 17 / iOS 26.5でネイティブSafariを操作した。通常の製品ビルドとローカルの実認証APIを使用。専用SQLiteのテストアカウントでログインし、本番のアカウントや対局データは使用していない。後半の統合QA用ビルドでは学習ログを有効にした。

| 確認箇所 | 実操作と結果 | 証跡 |
|---|---|---|
| 認証・メニュー | 実APIでログイン。主要操作が初期画面内に収まり、設定を開ける | [03](../../reports/usability-fixes/2026-11-21/ios-simulator/03-menu-authenticated.jpg) |
| プロフィール設定 | 日本語の保存通知、編集画面とメニューへの戻りを確認。見出しの折り返しは#462で修正 | [05](../../reports/usability-fixes/2026-11-21/ios-simulator/05-settings-saved.jpg)、[06](../../reports/usability-fixes/2026-11-21/ios-simulator/06-settings-header-fixed.jpg) |
| 学習・種目切替 | iOSのプルダウンでA-5からBadugiに切替。ルール差分を表示し、Badugiの対局を開始 | [08](../../reports/usability-fixes/2026-11-21/ios-simulator/08-learn-native-dropdown.jpg)、[09](../../reports/usability-fixes/2026-11-21/ios-simulator/09-cash-from-learning.jpg) |
| キャッシュの進行 | CPUの番から自分の番に進み、コール・選択カードの交換・最終ベット・次ハンドへの進行を確認。縦横とも手札と主要操作が画面内 | [10](../../reports/usability-fixes/2026-11-21/ios-simulator/10-cash-discard-selected.jpg)、[18](../../reports/usability-fixes/2026-11-21/ios-simulator/18-cash-landscape.jpg) |
| 交換回数 | 2ndが1/3、3rdが2/3になる表示を発見。#463で修正し、実際の1st・2nd・3rdを1/3・2/3・3/3で再確認 | [17](../../reports/usability-fixes/2026-11-21/ios-simulator/17-first-draw-fixed.jpg)、[19](../../reports/usability-fixes/2026-11-21/ios-simulator/19-second-draw-fixed.jpg)、[20](../../reports/usability-fixes/2026-11-21/ios-simulator/20-third-draw-fixed.jpg) |
| 対局中の履歴・マイ結果 | 対局メニューから履歴、マイ結果へ移動。完了した1ハンドと10軸レーダーの未測定状態を確認 | [12](../../reports/usability-fixes/2026-11-21/ios-simulator/12-history-personal-results.jpg)、[13](../../reports/usability-fixes/2026-11-21/ios-simulator/13-personal-results-open.jpg)、[14](../../reports/usability-fixes/2026-11-21/ios-simulator/14-results-radar.jpg) |
| 3rd判断練習 | 問題を開き、相手の交換枚数、手札、BBetの初出説明と回答操作を確認 | [16](../../reports/usability-fixes/2026-11-21/ios-simulator/16-third-draw-bbet.jpg) |
| 精算・退出 | 日本語の精算結果からゲーム選択へ戻れる | [21](../../reports/usability-fixes/2026-11-21/ios-simulator/21-cashout-ja.jpg) |
| エクイティ入力 | 残り3回（1stから）を選択。手札編集が独立して開閉でき、交換指定が別操作になっている | [22](../../reports/usability-fixes/2026-11-21/ios-simulator/22-equity-first-draw.jpg)、[23](../../reports/usability-fixes/2026-11-21/ios-simulator/23-equity-editor.jpg) |
| エクイティ比較 | 相手1枚交換から2枚交換に変えると、自分のK♥を切る候補の結果が約64.74%から73.86%へ更新。候補と選択状態を識別できる | [24](../../reports/usability-fixes/2026-11-21/ios-simulator/24-equity-discard-and-opponent-results.jpg)、[25](../../reports/usability-fixes/2026-11-21/ios-simulator/25-equity-opponent-change.jpg) |
| 開始手札の練習 | 初期画面で手札と開始ボタンが近接。練習条件は開閉できる。自分の番では手札の直下に操作が出る | [26](../../reports/usability-fixes/2026-11-21/ios-simulator/26-practice-setup.jpg)、[27](../../reports/usability-fixes/2026-11-21/ios-simulator/27-practice-options.jpg)、[28](../../reports/usability-fixes/2026-11-21/ios-simulator/28-practice-hero-actions.jpg) |
| 練習結果・復習 | 練習終了後に保存し、復習一覧へ移動。種目・日時・開始手札・ポットで識別でき、絞り込みを開ける | [29](../../reports/usability-fixes/2026-11-21/ios-simulator/29-practice-result-saved.jpg)、[30](../../reports/usability-fixes/2026-11-21/ios-simulator/30-review-list.jpg)、[31](../../reports/usability-fixes/2026-11-21/ios-simulator/31-review-filters.jpg) |
| 次のおすすめ | 復習に保存すると未復習1件が次の行動になり、主要なおすすめが一つに絞られる | [32](../../reports/usability-fixes/2026-11-21/ios-simulator/32-learn-recommendation-after-save.jpg) |
| 大会一覧 | 参加人数と具体的な参加条件を初期画面で確認できる | [33](../../reports/usability-fixes/2026-11-21/ios-simulator/33-tournament-list.jpg) |
| MIX | 閲覧のみの理由を表示。見出し・メニューの圧迫を#465で修正して再確認。解放後の開始は自動統合QAで別途検証し、#464で開始回帰を修正 | [34](../../reports/usability-fixes/2026-11-21/ios-simulator/34-mix-header-before.jpg)、[35](../../reports/usability-fixes/2026-11-21/ios-simulator/35-mix-header-fixed.jpg) |

前回未確認だったキャッシュの待機は、この環境でCPUから自分の番へ進み、ハンドを完了できた。すべての種目・端末・通信条件での停止なしを保証するものではない。レーダーは1ハンド・未測定の状態を確認したもので、500ハンドの成長データを今回ネイティブ環境で再検証したという意味ではない。レンジA/Bの全操作、解放後MIX、大会完了は自動回帰検証の対象と分ける。

[画像一覧・ハッシュ・確認範囲](../../reports/usability-fixes/2026-11-21/ios-simulator/verification.json)。修正ごとのコミットと検証は[修正一覧](MGX_USABILITY_FIXES_20261121.md)に追記する。PR・CI・本番反映はこの再QM後に実行し、完了を確認して別途記録する。

再QM後の追補 #467: ロック中のpresetリンクに残っていた暗黙の保存をなくした。関連単体18件、PC・Android・iPhoneの関連ブラウザー21件を再確認。追加のネイティブ操作を始めた時点ではMacがロックされていたため、この追補のネイティブ再操作は未実施。上記33枚のネイティブ確認と、追加したリンク経由の回帰検証を分けて扱う。
