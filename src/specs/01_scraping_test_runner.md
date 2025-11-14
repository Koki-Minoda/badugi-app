# バドゥーギアプリ テスト自動化用スクレイピングスクリプト作成指示

## ゴール
ローカルの Badugi アプリを自動で操作し、ログ収集・バグ検知ができる Playwright ベースのテスト環境を構築する。

## 必須構成
tests/
  scraping/
    runner.py
    selectors.py
    scenarios.py
    config.py
  logs/

## 要件
- Playwright(Python) を使用
- ローカル http://localhost:3000 を起動前提
- 1ハンド進行を自動で実施するシナリオを作る
- コンソールログのうち  
  - "TypeError", "ReferenceError", "Uncaught"  
  - stack=-（負数）  
  を検出したら exit code 1
- logs/test_run_YYYYMMDD.log に保存

## Continue 実行指示
上記仕様に基づき tests/scraping 以下へ必要ファイルを生成し、diff 形式で提示・Apply すること。
