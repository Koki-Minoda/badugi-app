---
title: Current blocker list
---

# 現在確認済みの問題

1. **Playwright SB-fold spec が Main Menu→ゲームの遷移を追えていない**  
   - `START` クリック後に `/menu` / `/game` が交互に出るので `page.waitForURL("**/game*")` だけだとタイムアウトしてしまう。現在は `Promise.race` で `/game`/`/menu` のどちらが早いかを見るようにして `/game` に飛ぶケアを入れ、Main Menu に到達したことを `Leaderboard` ボタンが見えるまで待つ処理も追加済み。これで UI の変更でも振り返りやすくなっています。
2. **`debug start screen` テストの成果をドキュメント化**  
   - 画像 `tests/start-screen.png` を `docs/e2e_start_screen.png` に移し、`START` / `Settings` や緑の Start ボタン、Google Translate バブルが出ることを短いキャプションとして記すと、Playwright テストを作るときの判断材料になりやすいです。
3. **デバッグヘルパーとリリース後のバグリストの整理**  
   - `runner.py` にあった `sys.executable` 出力は不要になったので削除し、Playwright を起動するには `playwright.sync_api` が必須であることと、dev サーバの起動順序（手動 or `webServer` で自動）を README や Docs に書き残しておくと次のスペック作業でも参考になります。

今後の対応：
* タイトル画面の画像／Playwright pause で Start ボタンのラベルを確認
* Playwright スクリプト側に正しいセレクターや待機処理（日本語ラベル、モーダル閉じなど）を追加
* Dev サーバが確実に`localhost:3000` で Ready になる仕組み（`webServer` の `timeout` 以上のロジック、または手動起動確認の自動化）
