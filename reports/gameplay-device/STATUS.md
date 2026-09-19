# MGX 全体確認・プレイ不具合一覧

更新（UTC）: 2026-09-19T13:35:51.304Z

37種目（公開24・検証中12・未実装1）、学習、通常対局、トーナメント、MIX、履歴／リプレイ、通信、端末操作。

PCでは実装済み36種目を対局確認。公開24種目は各10ハンドまで確認済み。未修正の不具合3件、OFCとMulti-Gameの未実装、実機通常対局の確認残りがあるため、全QA完了ではない。詳しい検査条件と残作業は [README](README.md) を参照。

- 判定は実施した範囲に限る。起動だけ・1ハンドだけの確認を、全機能合格とは記載しない。
- 未実装OFCと検証中12種目は公開中種目と分ける。
- 専用ローカルAPI／DBと検査用ブラウザを使用。本番配信・本番成績は変更しない。
- 物理iPhoneとブラウザの端末再現を区別する。「縦画面／横画面」は実機と明記した項目以外はブラウザ上の確認。

## 種目別

| 種目 | 提供状態 | PC通常対局 | iPhone通常対局 | トーナメント | 縦画面 | 横画面 | リプレイ | 不具合 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Badugi | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | 未検出／未確認 |
| No-Limit Hold'em | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | 実機：横向き必須の案内確認（対局未） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | QA-003 |
| Fixed-Limit Hold'em | 検証中 | 1ハンド操作・履歴要件・退出 合格（公開可否は未判定） | 未完了：USB検査応答が途切れた | 未確認 | 実機：横向き必須の案内確認（対局未） | iPhone相当WebKit：1ハンド/退出 合格・実機未 | PC/WebKit：履歴の必要項目 合格（完全再現未） | QA-003 |
| NL Super Hold'em | 検証中 | 1ハンド操作・履歴要件・退出 合格（公開可否は未判定） | 未完了：USB検査応答が途切れた | 未確認 | 実機：横向き必須の案内確認（対局未） | iPhone相当WebKit：1ハンド/退出 合格・実機未 | PC/WebKit：履歴の必要項目 合格（完全再現未） | 未検出／未確認 |
| FL Super Hold'em | 検証中 | 1ハンド操作・履歴要件・退出 合格（公開可否は未判定） | 未完了：USB検査応答が途切れた | 未確認 | 実機：横向き必須の案内確認（対局未） | iPhone相当WebKit：1ハンド/退出 合格・実機未 | PC/WebKit：履歴の必要項目 合格（完全再現未） | 未検出／未確認 |
| Pot-Limit Omaha | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | 実機：横向き必須の案内確認（対局未） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | QA-003 |
| PLO8 | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | 実機：横向き必須の案内確認（対局未） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | QA-003 |
| FLO8 | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | 横向き必須の案内 合格（プレイ不可） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | QA-003 |
| Big-O | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | 横向き必須の案内 合格（プレイ不可） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | QA-003 |
| 5-Card PLO | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | 横向き必須の案内 合格（プレイ不可） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | QA-003 |
| 2-7 Triple Draw | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | 未検出／未確認 |
| A-5 Triple Draw | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | 未検出／未確認 |
| Badeucey TD | 検証中 | 1ハンド操作・履歴要件・退出 合格（公開可否は未判定） | 未完了：USB検査応答が途切れた | 未確認 | 未確認 | iPhone相当WebKit：1ハンド/退出 合格・実機未 | PC/WebKit：履歴の必要項目 合格（完全再現未） | 未検出／未確認 |
| Badacey TD | 検証中 | 1ハンド操作・履歴要件・退出 合格（公開可否は未判定） | 未完了：USB検査応答が途切れた | 未確認 | 未確認 | iPhone相当WebKit：1ハンド/退出 合格・実機未 | PC/WebKit：履歴の必要項目 合格（完全再現未） | 未検出／未確認 |
| Hidugi TD | 検証中 | 1ハンド操作・履歴要件・退出 合格（公開可否は未判定） | 未完了：USB検査応答が途切れた | 未確認 | 未確認 | iPhone相当WebKit：1ハンド/退出 合格・実機未 | PC/WebKit：履歴の必要項目 合格（完全再現未） | 未検出／未確認 |
| Archie TD | 検証中 | 1ハンド操作・履歴要件・退出 合格（公開可否は未判定） | 未完了：USB検査応答が途切れた | 未確認 | 未確認 | iPhone相当WebKit：1ハンド/退出 合格・実機未 | PC/WebKit：履歴の必要項目 合格（完全再現未） | 未検出／未確認 |
| 2-7 Single Draw | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | 未検出／未確認 |
| A-5 Single Draw | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | 未検出／未確認 |
| 5-Card Single Draw | 検証中 | 1ハンド操作・履歴要件・退出 合格（公開可否は未判定） | 未完了：USB検査応答が途切れた | 未確認 | 未確認 | iPhone相当WebKit：1ハンド/退出 合格・実機未 | PC/WebKit：履歴の必要項目 合格（完全再現未） | 未検出／未確認 |
| Badugi Single Draw | 検証中 | 1ハンド操作・履歴要件・退出 合格（公開可否は未判定） | 未完了：USB検査応答が途切れた | 未確認 | 未確認 | iPhone相当WebKit：1ハンド/退出 合格・実機未 | PC/WebKit：履歴の必要項目 合格（完全再現未） | 未検出／未確認 |
| Badeucey Single Draw | 検証中 | 1ハンド操作・履歴要件・退出 合格（公開可否は未判定） | 未完了：USB検査応答が途切れた | 未確認 | 未確認 | iPhone相当WebKit：1ハンド/退出 合格・実機未 | PC/WebKit：履歴の必要項目 合格（完全再現未） | 未検出／未確認 |
| Badacey Single Draw | 検証中 | 1ハンド操作・履歴要件・退出 合格（公開可否は未判定） | 未完了：USB検査応答が途切れた | 未確認 | 未確認 | iPhone相当WebKit：1ハンド/退出 合格・実機未 | PC/WebKit：履歴の必要項目 合格（完全再現未） | 未検出／未確認 |
| Hidugi Single Draw | 検証中 | 1ハンド操作・履歴要件・退出 合格（公開可否は未判定） | 未完了：USB検査応答が途切れた | 未確認 | 未確認 | iPhone相当WebKit：1ハンド/退出 合格・実機未 | PC/WebKit：履歴の必要項目 合格（完全再現未） | 未検出／未確認 |
| Dramaha Hi | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | 横向き必須の案内 合格（プレイ不可） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | 未検出／未確認 |
| Dramaha 2-7 | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | 横向き必須の案内 合格（プレイ不可） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | 未検出／未確認 |
| Dramaha A-5 | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | 横向き必須の案内 合格（プレイ不可） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | 未検出／未確認 |
| Dramaha Zero | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | 横向き必須の案内 合格（プレイ不可） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | 未検出／未確認 |
| Dramaha Hidugi | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | 横向き必須の案内 合格（プレイ不可） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | 未検出／未確認 |
| Dramaha Badugi | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | 横向き必須の案内 合格（プレイ不可） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | 未検出／未確認 |
| Stud | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | QA-003 |
| Stud 8 | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | QA-003 |
| Razz | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | QA-003 |
| Razzdugi | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | QA-003 |
| Razzducey | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | QA-003 |
| 2-7 Razz | 公開中 | 画面操作10ハンド・履歴・精算・退出 合格 | 未完了：USB検査応答が途切れた | PC：1ハンドUI＋強制終了場面 合格（種目別の自然決着は未） | iPhone相当WebKit：1ハンド/操作 合格・実機未 | iPhone相当WebKit：1ハンド/操作 合格・実機未 | PC：記録監査＋画面再生 合格 | QA-003 |
| Chinese Poker | 公開中 | PC・Android/iPhone相当 各10ハンド合格 | 未完了：USB検査応答が途切れた | 専用種目：対象外 | Android/iPhone相当 合格・実機未 | iPhone相当WebKit：10ハンド合格・実機未 | 3ブラウザ各10ハンド完全再現 合格 | 未検出／未確認 |
| Open-Face Chinese Poker | 未実装 | 不可：未実装 | 不可：未実装 | 不可：未実装 | 不可：未実装 | 不可：未実装 | 不可：未実装 | 既存 CHINESE-03 |

## 機能別

| 機能 | 状態 | 証拠 |
| --- | --- | --- |
| 学習：クイズ・3種目練習・復習・英語 | iPhone実機で6グループ合格（9/19） | [../learning-entry/IPHONE-PHYSICAL-QA.md](../learning-entry/IPHONE-PHYSICAL-QA.md) |
| ゲーム進行・既知不具合・種目公開設定の回帰 | 今回111件合格（4ファイル） | [artifacts/engine-regression.log](artifacts/engine-regression.log) |
| トーナメント開始・中断・再開・敗退・優勝 | 47件回帰合格＋店舗/地域/世界の通常決着3件合格（Hero計77ハンド、敗退後CPU進行を試験用に加速） | [artifacts/tournament-completion.json](artifacts/tournament-completion.json) |
| MIXの種目交代 | 3ブラウザでMIX6件合格＋クイズ3件合格：種目交代・チップ/席維持・禁止種目/手数制限（APIモック・試験用進行操作） | [artifacts/mix-three-browsers.json](artifacts/mix-three-browsers.json) |
| 履歴・リプレイ・復習への保存 | 通常対局23種目×10ハンドの履歴監査・再生合格。Chineseは3ブラウザ各10ハンド。復習保存は学習実機QA参照 | [artifacts/desktop-cash-10hands.json](artifacts/desktop-cash-10hands.json) |
| ログイン・登録・ログアウト | PC実API：登録/ログイン/再読込/ログアウト合格。実機：登録/ログイン合格、以後の継続は未確認 | [artifacts/features-confirmed.json](artifacts/features-confirmed.json) |
| 友達対戦・通信復帰 | PC上のモバイル再現2件合格：2人の再接続・カード非公開・WS障害後REST継続（実機は未） | [artifacts/friend-match.json](artifacts/friend-match.json) |
| PWAインストール・再起動 | Chromeインストール要件エラー0。実機インストール・再起動は未。Service Worker未実装 | [artifacts/pwa-installability.json](artifacts/pwa-installability.json) |
| 実キーボード・タッチ操作 | 未確認 | — |
| 実機の縦横回転・セーフエリア | 縦393pxで学習とログイン、6種目の回転案内を確認。横向き・通常対局は接続応答待ち | — |
| Multi-Game Tournament | 未実装の3形式（Stage Relay / Survival Mix / Championship Relay）。画面はPrototype | [../../src/ui/screens/MultiGameScreen.jsx](../../src/ui/screens/MultiGameScreen.jsx) |
| Dealer’s Choice | 不具合 QA-002：すぐスタートでタイトルに遷移し選択ゲームが起動しない | [artifacts/features-confirmed.json](artifacts/features-confirmed.json) |

## 不具合・制約

### QA-001 PWAアイコンの形式・サイズ宣言が実ファイルと不一致

- 状態: 確認済み・未修正（インストール不能とは未判定）
- 環境: 公開候補c0fa8faのmanifestと画像／PC Chrome
- 再現: manifest.webmanifestのiconsとmgx_favicon.pngのヘッダーを照合
- 実際: image/pngの192px・512pxと宣言されているが、実体は32/64/128/256pxのICO。ChromeのinstallabilityErrorsは0
- 期待: 宣言と実体が一致するアイコンを配信する
- 証拠: public/manifest.webmanifest、public/mgx_favicon.png、artifacts/pwa-installability.json

### QA-002 Dealer’s Choiceの「すぐスタート」で選択ゲームが始まらない

- 状態: P1・2回再現・未修正
- 環境: 公開候補c0fa8fa／PC Chrome／World解放状態を検査用に設定
- 再現: Dealer’s Choiceを開く→NL Hold’emをキュー追加→「このゲームですぐスタート」
- 実際: /game?mode=dealers-choiceへ遷移するがPRESS ENTERのタイトル表示。キューは[B01,B01]のまま、対局/HUDが表示されない。App側にキュー消費処理の参照なし
- 期待: 選択種目で対局が始まり、キューを消費する
- 証拠: artifacts/features-confirmed.json、features-confirmed-testsの画面／tests/e2e/gameplay-device-features.spec.ts

### QA-003 結果画面のポット総額が0と表示され、内訳と一致しない

- 状態: P2・公開12種目で再現・未修正（進行/履歴/精算の合格とは別）
- 環境: c0fa8fa／PC Chrome：Board6種目＋Stud6種目。検証中FLHはiPhone相当WebKit画面でも確認
- 再現: 各種目でコール/チェックしてショーダウン→結果画面の見出しと内訳を比較
- 実際: Boardは見出しPot ¥0・内訳¥120、Studは見出しPot ¥0・内訳¥60。残り公開11種目では整合
- 期待: 見出しに各ポット内訳の合計を表示する。払戻し自体の誤りは今回未検出
- 証拠: artifacts/pot-audit.json（11合格/12失敗）、tests/e2e/gameplay-result-pot-audit.spec.ts、WebKit FLH結果画像
