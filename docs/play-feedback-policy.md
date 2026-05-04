# MGX Play Feedback Policy

更新日: 2026-05-04

## 目的

キャッシュゲームとトーナメントの実プレイログを集計し、良かった判断、悪かった判断、ROIやスタック推移、相手傾向をもとにプレイ改善フィードバックを返す。ChatGPT API への送信は backend 経由に限定し、frontend から直接APIキーを扱わない。

## 送信条件

- キャッシュゲーム: `Cash Out` 後に同一セッション30ハンド以上ある場合だけ分析対象にする。
- トーナメント: bust / 優勝 / 終了後に30ハンド以上ある場合だけ分析対象にする。
- 30ハンド未満は「サンプル不足」としてローカル集計のみ表示する。
- 100ハンド以上は信頼度を高め、30〜99ハンドは「暫定評価」と明示する。
- all-in / side pot / showdown / folded hand の重大イベントは、30ハンド未満でもローカルの簡易振り返りに使う。

## 集計する情報

- セッション: `sessionId`, `variantId`, `mode`, `startedAt`, `endedAt`, `handCount`, `durationSec`
- 結果: buy-in / starting stack / ending stack / net chips / prize / ROI / BB per 100 / chips per hand
- 基本統計: VPIP, PFR, 3BET, AF, WTSD, W$SD, steal, defend, fold to raise
- Draw統計: draw count別頻度, pat頻度, final streetのcall/fold/raise, draw quality継続率
- 重要ハンド: 最大勝ち5件、最大負け5件、all-in、side pot、thin value候補、missed value候補、overcall候補
- 相手情報: table人数、各CPU profile、VPIP/PFR/AF、showdown傾向、passive/draw-heavyなどの推定profile
- トーナメント: level, blinds, ante, remaining players, average stack, finish place, payout, ICMに近い状況メモ

## ChatGPT API 方針

- backend に `POST /api/play-feedback/analyze` を追加する想定。
- backend はDBのhand historyから必要項目を集計し、prompt version と input hash を付けて ChatGPT API に送る。
- frontend は分析jobを作成し、`GET /api/play-feedback/{job_id}` で結果をpollingする。
- APIへ送る内容は集計済みサマリーを基本にし、認証token、メールアドレス、不要な個人情報は送らない。
- プレイヤIDは内部IDまたはhashにし、自由入力名は必要最小限にする。
- 失敗時は再実行可能にし、同じinput hashの重複課金を避ける。

## フィードバック出力

- Summary: セッション全体の勝敗と信頼度。
- Good Decisions: 良かった判断を3〜5件。
- Leaks: 悪かった傾向を3〜5件。
- Key Hands: 重要ハンドごとの代替ライン。
- ROI / Risk: キャッシュならBB/100と分散、トーナメントならROIと飛び方。
- Next Drills: 次に練習すべき3項目。
- Limitations: サンプル不足、相手profile偏り、短期分散の注意。

## 実装タスク

- [ ] `FB-01` hand history を session 単位で30ハンド以上集計できる backend helper を追加する。
- [ ] `FB-02` cash out / tournament finish を feedback entry point にする。
- [ ] `FB-03` `POST /api/play-feedback/analyze` と job status API を追加する。
- [ ] `FB-04` prompt version / model / input hash / output をDB保存する。
- [ ] `FB-05` frontend にセッション結果画面と feedback modal を追加する。
- [ ] `FB-06` 30ハンド未満のローカル簡易振り返りを実装する。
- [ ] `FB-07` OpenAI API のrate limit / cost / retry / privacy guardを設定する。
- [ ] `FB-08` cash / tournament / all-in / side pot を含む集計testを追加する。
