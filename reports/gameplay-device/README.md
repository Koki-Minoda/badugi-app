# MGX 全種目・実プレイ確認（2026-09-19）

[種目別の完了状況と不具合一覧](STATUS.md)を主台帳とする。機械可読の台帳は[progress.json](progress.json)、実行したブラウザ検査の集計は[evidence-summary.json](evidence-summary.json)。

対象アプリは `c0fa8fad8e6dfe455352cc4a8da7dc78873b8956` の production build。この調査ではアプリの修正・再配信は行っていない。QAの誤判定を修正し、再現検査と台帳を追加した。下記の合格は各検査の対象条件に限る。未解決不具合があるため、全機能のQA完了・リリース可とは判定しない。

## 実施結果

| 検査 | 結果 | 範囲・限界 |
| --- | --- | --- |
| 公開リング23種目 | 各10ハンド、計230ハンド完了 | 画面ボタン、履歴、記録からの再現、画面リプレイ、精算、退出。表示のQA-003は別途検出 |
| Chinese Poker | PC・Android相当・iPhone相当各10ハンド＋iPhone相当横画面10ハンド | 13枚配置・結果・カード重複なし・収支ゼロサム・履歴完全再現 |
| 検証中12種目 | PCとiPhone相当横画面で各1ハンド完了 | ユーザー操作、履歴の必要項目、退出。公開昇格や完全再現は未判定 |
| 公開23種目のiPhone相当縦横 | 修正後46件合格 | 11種目は縦横で1ハンド、12種目は横1ハンド＋縦の回転案内。物理端末ではない |
| タイトル・短い横画面の大会操作 | 3件合格 | iPhone相当WebKit。`iphone-webkit-layout.json`の特殊3件 |
| トーナメント回帰 | 47件合格 | 23種目の開始・1ハンド・強制終了場面、中断再開・敗退・戻る |
| 店舗・地域・世界大会の決着 | 3件合格 | 強制優勝なし。Hero計77ハンド、Hero敗退後はCPUの進行を試験用に加速。世界大会275人。Hero優勝の証明ではない |
| MIX・クイズ | 3ブラウザでMIX6件＋クイズ3件合格 | 種目交代・残高/席/ボタン位置・禁止種目・手数制限。APIモックと試験用進行操作を使用 |
| 友達対戦 | 2件合格 | 2人の再接続、カード非公開、WebSocket障害後のREST継続。ローカルAPI |
| 登録・ログイン・再読込・ログアウト | PC合格 | パスワード確認不一致も確認。実機は登録・ログインまで |
| エンジン/既知不具合/公開設定 | 4ファイル111件合格 | `artifacts/engine-regression.log` |
| ポット表示の追加監査 | 11種目合格・12種目不合格 | QA-003。合格済みの対局進行検査では拾えなかった表示不良 |
| Dealer’s Choice | 2回再現、不合格 | QA-002。開始すると選択ゲームではなくタイトルが表示される |
| PWA | Chromeの要件エラー0、アイコン宣言不一致 | QA-001。物理端末のインストール・再起動未確認。Service Worker未実装 |

OFCは未実装（既存CHINESE-03）。Multi-Game Tournamentの3形式もPrototypeであり、実装済みとは数えない。

## 物理iPhoneの結果と残り

iPhone17,3／iOS 26.5.2／Safari 26.5.2。USB Web Inspectorで専用の `https://example.com/` タブへローカルビルドを供給した。外部へアプリをアップロードしたものではない。本番の配信、証明書、通信品質、PWAの検証とは異なる。

- 先行の学習6グループは[実機QA](../learning-entry/IPHONE-PHYSICAL-QA.md)参照。クイズ、Badugi/A-5/2-7練習、復習、英語表示を確認済み。
- 今回は実機で新規登録・ログインが成功し、メニューを表示した。縦画面でNLH、FLH、Super Hold’em、FL Super Hold’em、PLO、PLO8の横向き案内を確認した。
- 接続が停止したため検査用の接続プロセスを再起動し、一度復旧。その後再び `Runtime.evaluate timed out` となり、通常対局の実機1ハンド完了は確認できていない。アプリ自体の停止と接続問題の切り分けは未完了。
- 中断ログの `FAIL` は、そのままゲーム不具合件数に数えていない。ログイン画面へ戻ったケースも検査経路の影響を分離できていない。
- 指でのタップ、ネイティブキーボード、実機を横へ回転した状態、ホーム画面への追加と再起動は残作業。DOMによる入力・クリックとは区別する。

## QA自体の修正

従来のモバイル監査はStud/BoardにもDRAW到達を要求し、横向き限定の種目を縦向きで起動して失敗していた。また、監査結果をJSONへ保存するだけでPlaywright自体は成功していた。

`expectsDraw`を参照し、縦の回転案内を明示的に検査し、検出した問題がある場合はテストも失敗するよう変更。46件を再実行し、監査JSONとテスト結果の両方が合格した。最初の誤判定ログは`artifacts/iphone-layout-before-test-fix.json`に保存した。

登録検査の初回には検査用`.test`メールがローカルAPIの検証で拒否されたため、`.com`へ変更して再実行した。これも製品不具合に数えていない。

## 再現と証拠

`artifacts/`のJSON・画像・実行ログはローカル保存し、Git対象外。`evidence-summary.json`は個人情報やトークンを含めず、検査名・判定・ポット表示の値・大会結果を保存する。

`local-proxy.mjs`はループバック限定で4178の静的プレビューと8011の専用FastAPIを4179へまとめる。APIは今回用SQLiteを使用し、本番アカウント・履歴・成績を変更しない。

```sh
# 4178のプレビュー、8011の専用API、4179のlocal-proxy起動後
E2E_APP_URL=http://127.0.0.1:4179/ node_modules/.bin/playwright test \
  core5-mobile-interaction.spec.ts --config=playwright.device-audit.config.js --workers=1

# 未修正不具合の再現は明示的に有効化する。QA-002とQA-003が残っていれば失敗する。
E2E_APP_URL=http://127.0.0.1:4179/ MGX_GAMEPLAY_AUDIT=1 node_modules/.bin/playwright test \
  gameplay-device-features.spec.ts gameplay-result-pot-audit.spec.ts --project=badugi-flow --workers=1
```

`iphone-client.mjs`・`physical-games.mjs`は専用検査タブのみを対象とする実機確認用。今回の通常対局検査は中断したため、このハーネス全体の動作保証は未完了。再開時はiPhoneのロック解除・Safari表示・横向き状態を確認し、まず1種目で操作と履歴の取得を確かめてから対象を広げる。
