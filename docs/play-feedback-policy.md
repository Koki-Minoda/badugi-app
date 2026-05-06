# MGX Play Feedback Policy

更新日: 2026-05-06

## 目的

キャッシュゲームとトーナメントの実プレイログを集計し、良かった判断、悪かった判断、ROIやスタック推移、相手傾向をもとにプレイ改善フィードバックを返す。ChatGPT API への送信は backend 経由に限定し、frontend から直接APIキーを扱わない。

## 送信条件

- キャッシュゲーム: `Cash Out` 後に同一セッション30ハンド以上ある場合だけ分析対象にする。
- トーナメント: bust / 優勝 / 終了後に30ハンド以上ある場合だけ分析対象にする。
- Mixed sessionではPLO/Badugi/2-7などを誤って混ぜないよう、feedback作成前に対象variantまたはmixed scopeを明示選択する。
- variant scopeを選んだ場合、30ハンド判定は全体件数ではなく「選択variantに絞り込んだ後」の件数で行う。
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

- backend の実APIは `POST /api/analysis/play-feedback`。
- backend は frontend が構築した30ハンド以上のsession payloadを検証し、prompt version と input hash を付けて OpenAI API に送る。
- 結果は `play_feedback_results` に保存し、`feedbackId` / `sessionKey` / `storedAt` を返す。
- frontend は cash out / history から分析modalを開き、保存済み結果は `GET /api/analysis/play-feedback/results` で取得する。
- APIへ送る内容は集計済みサマリーを基本にし、認証token、メールアドレス、不要な個人情報は送らない。
- APIへ送る内容は backend でさらに圧縮し、`summary` / `topIssues` / `keyHands` / 最大8件の軽量hand sampleだけをOpenAIへ渡す。全handのraw eventsや全seat詳細は送らない。
- プレイヤIDは内部IDまたはhashにし、自由入力名は必要最小限にする。
- 失敗時は再実行可能にし、同じinput hashの重複課金を避ける。
- OpenAIキーは backend 環境変数 `MGX_OPENAI_API_KEY` を推奨し、`OPENAI_API_KEY` もfallbackとして受け付ける。
- productionでは `/etc/mgx/mgx-backend.env` のようなsystemd `EnvironmentFile` にキーを置き、frontendやGit管理ファイルには置かない。

## フィードバック出力

- Summary: セッション全体の勝敗と信頼度。
- Good Decisions: 良かった判断を3〜5件。
- Leaks: 悪かった傾向を3〜5件。
- Key Hands: 重要ハンドごとの代替ライン。
- ROI / Risk: キャッシュならBB/100と分散、トーナメントならROIと飛び方。
- Next Drills: 次に練習すべき3項目。
- Limitations: サンプル不足、相手profile偏り、短期分散の注意。

## Hand History Linkage

2026-05-05 追記。Feedback本文に `B-07` のようなシチュエーションIDだけが出ても、実プレイヤーは「どのハンドのどの判断か」をすぐ復習できない。AI feedback payload と保存結果は、重要ハンドごとに hand history 参照を持たせる。

- `situationId`: `B-07`, `D01-12`, `PLO8-03` のようなfeedback内の安定ID。
- `handId`: canonical hand history のID。
- `variantId`: Badugi / D01 / PLO8 など。
- `actionSeqRange`: 該当アクションの開始/終了sequence。単一判断なら同じ値。
- `street`: preflop / flop / draw1 / seventh / showdown など。
- `seatIndex`, `position`: Heroがどの席・ポジションで判断したか。
- `heroAction`, `toCall`, `currentBet`, `pot`, `stackDepth`: 判断時点の主要条件。
- `resultDelta`: そのhandまたは該当potでの増減。

実装方針は、`playFeedbackPayload` の key hand extraction で上記参照を作り、backend の `play_feedback_results` に sanitize 済みpayloadとして保存する。frontend feedback modal は situation card から hand history / replay frame へジャンプできるようにする。これにより、AIの指摘を「抽象的な助言」ではなく「自分が押した具体ボタンと結果」に結び付けられる。

保存済みfeedbackの取得APIも `keyHands` と `summary` を返す。これにより、ページ再読み込み後や別端末で保存済み結果を開いた場合でも、AI本文と該当hand historyの対応関係を失わない。

2026-05-06 追記。Feedbackのリプレイ導線は、重要局面cardから `(handId, replayTarget)` をReplay UIへ渡す。`replayTarget.actionSeqStart` がある場合は該当action frameへ直接ジャンプし、なければ `actionSeqRange.start`、seat/street/action type の順にfallbackする。これにより、AIが参照した `B-07` / `PLO-03` などの局面を、同じvariantの同じhand/actionへ戻して確認できる。

## レイテンシ方針

- frontendは30ハンド以上の全履歴から集計payloadを作るが、OpenAIへはbackendが `summary_key_hands_v1` へ圧縮して送る。
- `topIssues` は最大12件、`keyHands` は最大10件、raw hand sampleは最大8件までに制限する。
- GPTの回答は `adviceJa` / `adviceEn` のJSONだけに固定し、長い自由形式の文章や不要な推論ログを要求しない。
- 低遅延優先時は `MGX_OPENAI_REASONING_EFFORT=low` と `MGX_OPENAI_MAX_OUTPUT_TOKENS` の上限調整で制御する。
- 精度は「全ログ送信」ではなく、hand history側で重要局面を正しく抽出し、`situationId` と replay 導線で補う方針にする。

## 実装タスク

- [x] `FB-01` hand history を session 単位で30ハンド以上集計できる frontend payload helper を追加する。
- [x] `FB-02` cash out / history を feedback entry point にする。
- [x] `FB-03` `POST /api/analysis/play-feedback` と保存結果取得APIを追加する。
- [x] `FB-04` prompt version / model / input hash / output をDB保存する。
- [x] `FB-05` frontend に feedback modal を追加する。
- [x] `FB-06` 30ハンド未満のローカル簡易振り返りを実装する。
- [x] `FB-07` OpenAI API のrate limit / cost / retry / privacy guardを設定する。
- [x] `FB-08` cash / tournament / all-in / side pot を含む集計testを追加する。
- [x] `FB-09` feedback key hand に `situationId` / `handId` / `actionSeqRange` を付与し、modalから該当hand historyへ遷移できるようにする。
  - 2026-05-05 対応: frontend payload の `keyHands` と `summary.topIssues` に `situationId` / `handId` / `actionSeqRange` / `heroAction` / `toCall` / `pot` / `resultDelta` を追加。Hand History のfeedback表示から該当hand replayへ遷移できるようにした。
- [x] `FB-10` 保存済みfeedback取得APIでも `keyHands` / `summary` を返し、履歴画面で保存済み結果と重要局面を同時に見られるようにする。
- [x] `FB-11` OpenAI送信用payloadを `summary_key_hands_v1` へ圧縮し、回答精度に必要な重要局面を残しつつ応答時間とtoken量を抑える。

## 実キー確認手順

1. backend実行環境に `MGX_OPENAI_API_KEY` または `OPENAI_API_KEY` を設定する。
2. backendを再起動する。
3. 30ハンド以上の履歴があるログイン状態で feedback modal を実行する。
4. responseの `source` が `openai`、`feedbackId` が数値で返ることを確認する。
5. `GET /api/analysis/play-feedback/results?session_key=...` で保存済み結果を確認する。
