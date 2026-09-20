# MGX 全種目・実プレイ確認と修正

**9/20 再設計後の最新結果:** [デザイン再検査](DESIGN-REVIEW.md)と[更新済み一覧](STATUS.md)を参照。利用者の指摘を受け、旧UIの使いやすさ合格判定を見直した。以下は再設計前までの検査履歴。

[37種目の完了状況・不具合一覧](STATUS.md)を主台帳とする。[画面の使いやすさQA](USABILITY-QA.md)、[修正後の検査結果](completion-evidence.json)、[機械可読の台帳](progress.json)も保存した。

最初の調査対象は `c0fa8fa`、調査記録の基点は `bc35b25`。修正コミットは認証 `c667560`、ゲーム・画面 `9d72e29`。今回、そのローカル修正版をproduction buildして検査した。本番への配信はしていない。旧調査の[evidence-summary.json](evidence-summary.json)は修正前の証拠として維持している。

未実装だったOFCとMulti-Game Tournamentの3形式を実装し、Dealer’s Choiceの開始・種目交代を修正した。表示、交換バッジ、大会の参加者引継ぎ、削除後の認証にも修正を加えた。接続復旧後、物理iPhoneの通常対局37種目と大会再開などを確認した。端末画面で追加発見した見切れ・得点表示・入力の問題も修正。指による入力とPWA追加は別途確認中。最新は[実機QA](PHYSICAL-QA.md)を参照。

## 修正後の検査

| 検査 | 結果 | 範囲・限界 |
| --- | --- | --- |
| OFC | 5画面構成で各10ハンド、計50ハンド合格 | classic 13枚・2人戦。手動配置/取消/確定、おまかせ、再開、履歴完全再現。Fantasylandの条件はユニットでも確認 |
| Multi-Game 3形式 | 5画面構成×3形式の15件合格 | 実操作1ハンド、再開、試験用の強制優勝による結果/次大会/順位点、通常成績を変えないこと |
| Multi-Game連続プレイ | 3形式すべて完了、Hero計179ハンド | Hero卓は通常の対局操作とCPU操作用テストドライバー。強制優勝なし。他卓は既存の抽象シミュレーション。Hero敗退後のみCPU進行加速 |
| 公開リング23種目のスマホ縦横 | 46件合格 | Draw/Stud11種目は縦横の対局。Board/Dramaha12種目は横対局と縦の回転案内 |
| 検証中12種目 | PC/横WebKit各10ハンド、計240ハンド合格 | 操作、履歴要件と完全再現、精算、退出。公開設定は検証中を維持 |
| 検証中12種目の縦画面 | 12件合格 | Draw9種目は対局と結果操作、Board3種目は回転案内。はみ出しなし |
| 大会35種目 | 35件合格 | 各種目で1ハンドUI→CPU加速決着→6人の順位→メニュー。各種目を自然決着まで長時間プレイしたという意味ではない |
| 画面の使いやすさ | 代表5種目×5画面構成25件合格 | 手番案内、交換操作、入力文字サイズ、勝者表示、結果ボタンの位置・大きさ・遮蔽、画面の横はみ出し |
| ポット、Dealer’s Choice、認証、友達対戦、PWA | 合計28件合格 | 全23種目の結果金額、実対局2種目、実API、WS再接続/REST継続、PNG実体/宣言とChromeインストール要件 |
| 関連ユニット | 37ファイル266件＋全種目進行54件合格 | 後の交換バッジ修正はPlayer25件、次種目案内はMulti-Game4件でも再検査。重複があるため単純合算しない |
| バックエンド | 全83件合格 | 同一ID・メール・パスワードで再登録した場合も古い認証をREST/WSで拒否 |
| ビルド・変更箇所lint | 合格 | 既存の全リポジトリlintを無条件に合格扱いしたものではない |

連続プレイの内訳はStage RelayがBadugi 42・NLH 33・Stud 40ハンド、Survival Mixが29、Championship Relayが35ハンド。今回の成功実行ではHero敗退後の加速呼出しは0回だった。

5画面構成はPC Chrome、Android相当Chromium縦/横、iPhone相当WebKit縦/横。Board/Dramahaは縦で案内後、横向きへ切り替えて対局する仕様。

先行確認として、公開リング23×10＝230ハンド、Chinese Pokerの4画面構成×10＝40ハンド、店舗/地域/世界大会の通常決着3件（Hero計77ハンド）、3ブラウザのMIX6件とクイズ3件を保存している。これらは修正前の実行結果であり、今回の再検査と区別する。

## 実装仕様と残る制約

- OFCは最初に5枚、以後1枚ずつ配置するclassicルール。13枚Fantasyland、QQ以上で突入、継続条件とロイヤリティを画面に記載。Pineappleや14枚Fantasylandは対象外。CPUは受け取ったカードだけを使う簡易判断で、ソルバーではない。[ルール参照](https://www.ofcstrategy.com/rules.html)。
- Stage Relayは6人の3大会の順位点合計。Survival Mixは18人・3卓、卓ごとに異なる種目を3ハンドずつ。Championship Relayは18人から決勝6人で選択順の1ハンド交代へ切り替える。他卓の進行は既存の大会シミュレーション。
- 新しい大会形式の参加費は0、通常大会の賞金・解放実績へ加算しない。進行と順位点は端末に保存。中断再開は最後の完了ハンドから。
- 認証はアカウントの登録実体と結び付けるよう変更した。この版を今後配信する場合、従来のトークンは再ログインが必要になる。今回はローカル検査のみ。
- PWAの画像・起動URL・Chromeのインストール要件を確認。実機インストールと再起動は未。Service Workerによるオフライン対局は実装していない。

## 物理iPhone

iPhone17,3／iOS 26.5.2／Safari 26.5.2。開発者モードと開発用イメージの有効化後、端末撮影とUSB Web Inspectorが動作した。大量のファイル転送で不安定だった検査用HTTPSの差し替え配信をやめ、専用LANサイトで検査を継続した。

リング35種目の横1ハンド、縦対応20種目の1ハンド、Chinese/OFCの縦横各3ハンドが完了。Multi-Gameは3形式で1ハンド→再読込→再開後1ハンド、Dealer’s ChoiceはNLH→Badugiの2ハンドを完了した。操作は実機SafariのDOMボタン経由で、指によるタップとは区別する。ローカルHTTPでの確認のため、PWAの本番HTTPSインストール合格には数えない。

短い横画面でのカードの見切れ、金額候補の隠れ、Chinese/OFCの得点表示、交換前PATの再発、ローカル接続の大会開始を追加修正した。詳細と再検査範囲は[実機QA](PHYSICAL-QA.md)・[実機の証拠集約](physical-evidence.json)を参照。

## 再現と証拠

`artifacts/`の画像・JSON・ログはローカル保存でGit対象外。`completion-evidence.json`はテスト名・判定・時間・匿名のハンド数のみを抽出し、トークンやアカウント情報は転記しない。重複した実行を含むため全行を機能数として合算しない。`summarize-completion.mjs`で再生成できる。

```sh
# 静的プレビュー4178、専用API8011、local-proxy4179の起動後
E2E_APP_URL=http://127.0.0.1:4179/ node_modules/.bin/playwright test \
  -c playwright.completion.config.js tests/e2e/ofc-completion.spec.ts \
  tests/e2e/multigame-completion.spec.ts tests/e2e/gameplay-usability-completion.spec.ts

E2E_APP_URL=http://127.0.0.1:4179/ node_modules/.bin/playwright test \
  -c playwright.completion.config.js tests/e2e/multigame-natural-completion.spec.ts \
  --project=completion-desktop
```

検査側の修正も記録する。Studは配札段階が変わっても「BET・同じ相手・同じ残高」が続く場合があり、進行判定へstreetを追加した。WebKitでONNXがconsole.errorに出す既知のCPU識別警告だけを除外し、実際のランタイム例外は引き続き失敗にしている。削除アカウントの認証が再登録後に有効になる現象は検査の誤判定ではなく製品の問題として修正した。
