# Tapli比較・根拠一覧

調査日：2026-09-20。TapliMIX表示版 v1.6.2.2。MGX基準 a44479e。

「実操作」も記載した操作だけを確認したものです。公式説明だけの機能を実動作確認済みにはしていません。公開ロビーの一時的な着席数から利用者数や人気は推定していません。

<a id="t01"></a>

## T01 — TapliMIX ホーム・更新履歴

[TapliMIX ホーム・更新履歴](https://taplimix.app/) · UI／公式更新履歴 · 2026-09-20

画面の版は v1.6.2.2（履歴日付9月19日）。公開対戦入口、Player Card、告知、QR、季節イベントを確認。履歴に書かれた機能の動作までは保証しない。

<a id="t02"></a>

## T02 — 111種目カタログ

[111種目カタログ](https://taplimix.app/games) · UI · 2026-09-20

全111カードの名称・ID・分類・ベット形式を確認。全種目の対局・精算をテストしたという意味ではない。FLOP 41、STUD 19、DRAW 30、HYBRID/COMBI 21。

<a id="t03"></a>

## T03 — プリセット一覧

[プリセット一覧](https://taplimix.app/presets) · UI · 2026-09-20

16カード。単種／複数種の入口、固定ハンド数、毎ハンドDC、周回DC、自己操作スイッチ。HORSE、8-Game、10-Game、TORSE、Triple Studなど。

<a id="t04"></a>

## T04 — NLH ゲスト練習

[NLH ゲスト練習](https://taplimix.app/practice?gameId=nlh) · 実操作 · 2026-09-20

未ログインで6人卓。時間切れの1ハンドと、手動でCall→Call→Check→Callしてショーダウンまで進めた1ハンド。次ハンドで100bbへ戻る。全種目や対人戦の動作保証ではない。

<a id="t05"></a>

## T05 — 対局設定

[対局設定](https://taplimix.app/practice?gameId=nlh) · UI＋一部実操作 · 2026-09-20

全席セルフ操作、6/7人、Non-Fold、タイマー、COM高速、音の種類/音量、ダークモード、Hole表示、スリープ防止、自動スケール、配信者モード。タイマーOFF・COM高速・Non-Foldを切り替えて継続プレイした。その他は設定の存在確認。

<a id="t06"></a>

## T06 — 機能ガイド・ルール図鑑

[機能ガイド・ルール図鑑](https://taplimix.app/help) · 公式説明 · 2026-09-20

ルールはベット、進行、使用カード、評価、成立条件、特殊ルールの軸で説明。Private Room、チャット、履歴共有/AIレビュー、Auto Fold、手札役表示、常にDC/UTG等の説明。記載と現行実装の一致は一部未検証。

<a id="t07"></a>

## T07 — 役・クオリファイ判定

[役・クオリファイ判定](https://taplimix.app/tools/qualifier) · 実操作 · 2026-09-20

NLHとBadaceyでRandom→Qualify。BadaceyではBadugiとA-5を別々に判定し、各席50%の分配を表示した。カードの手入力UIも確認。

<a id="t08"></a>

## T08 — Pick’em おすすめ

[Pick’em おすすめ](https://taplimix.app/tools/recommend) · 実操作 · 2026-09-20

4枚をランダム生成し、ベスト候補・5候補・特徴値・スコアを表示。候補の戦略的な正しさやEV/GTO最適性は未検証。

<a id="t09"></a>

## T09 — MIXゲームサイネージ

[MIXゲームサイネージ](https://taplimix.app/tools/signage) · UI · 2026-09-20

公式/カスタムMIX、DC/6-handの進行、2配色、全画面開始の設定画面。実店舗では未使用。

<a id="t10"></a>

## T10 — トーナメントタイマー

[トーナメントタイマー](https://taplimix.app/tools/timer) · UI · 2026-09-20

レベル・休憩・SB/BB/Ante・Stud Bet/Ante/Bring-inの編集、自動保存、プリセット、音、横向きMIX札の設定。時間経過・スリープ復帰は未検証。

<a id="t11"></a>

## T11 — プライズシミュレーター

[プライズシミュレーター](https://taplimix.app/tools/prize-sim) · UI · 2026-09-20

人数・参加ポイント・控除率・入賞率・1位割合・丸めからtp配分表とチャート。CSVボタンあり。現金サービスと解釈しない。

<a id="t12"></a>

## T12 — ビルダー

[ビルダー](https://taplimix.app/builder) · UI＋説明 · 2026-09-20

MIXプリセットと独自ゲームの作成入口。ログインするとアカウント保存・端末間アクセスとの説明。作成保存/同期は未テスト。

<a id="t13"></a>

## T13 — Private Room 認証入口

[Private Room 認証入口](https://taplimix.app/rooms) · UI · 2026-09-20

規約同意チェック、Google/Appleログインが表示。アカウント作成・規約同意・入室はしていない。部屋内機能はT06/T01の説明根拠。

<a id="t14"></a>

## T14 — 公開大会ロビー

[公開大会ロビー](https://taplimix.app/tournament) · UI · 2026-09-20

大会beta、終了済み大会2件と参加人数・結果表示。観測時に参加可能な大会なし。参加・対戦・運営は未テスト。

<a id="t15"></a>

## T15 — シーズン情報

[シーズン情報](https://taplimix.app/season) · UI · 2026-09-20

概要、総合/大会/リングtpランキング、日付カレンダー、決勝進出条件を確認。定期Ring Rushと期間大会を組み合わせる設計。運営の継続性/同時接続規模は不明。

<a id="t16"></a>

## T16 — ツール一覧

[ツール一覧](https://taplimix.app/tools) · UI · 2026-09-20

Flip、サウンド、Pick’em、役判定、ゲーム札、タイマー、配分試算、ガイドへの8入口。Flip・音の実行はしていない。

<a id="t17"></a>

## T17 — Tapli 交流用サービス

[Tapli 交流用サービス](https://official-tapli.lovable.app/) · 公式説明 · 2026-09-20

TapliMIXとは別のサービス。プレイヤーカード、収集、Respect、同卓メモ、店舗/イベントQR。料金・事業指標の詳細は不明。

<a id="t18"></a>

## T18 — Tapli 操作マニュアル

[Tapli 操作マニュアル](https://official-tapli.lovable.app/manual) · 公式説明 · 2026-09-20

カード共有/編集、コレクションのフィルター、Respect5分類、Table Memo。Table Memoは自分だけに表示との説明を展開して確認。実アカウントでの利用は未検証。

<a id="t19"></a>

## T19 — WSOP HORSE 構成

[WSOP HORSE 構成](https://wsop.gg-global-cdn.com/wsop/2f5f1259-f5b3-49dd-b2bd-77ad575327a8.pdf#page=41) · 主催者資料 · 2026-09-20

2026年構造表の41ページ、Event #37。5種目およびLimit Flop/Studの構造を確認。MGX固有の採用ルールを置換する根拠ではなく、標準名との整合確認に用いる。

<a id="t20"></a>

## T20 — WSOP 2026 8-Game 構成

[WSOP 2026 8-Game 構成](https://wsop.gg-global-cdn.com/wsop/2f5f1259-f5b3-49dd-b2bd-77ad575327a8.pdf) · 主催者資料 · 2026-09-20

2026年構造表92ページ、Event #80。8種目とLimit/Pot-limit/No-limitの構造を確認。

<a id="t21"></a>

## T21 — Tapli HORSE 詳細

[Tapli HORSE 詳細](https://taplimix.app/presets/horse) · UI · 2026-09-20

FLH/FLO8/Razz/Stud/Stud8の5種をすべてFLとして表示。6ハンドで順に切替。

<a id="m01"></a>

## M01 — 公開範囲

[src/games/config/variantAvailability.js:206](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/src/games/config/variantAvailability.js:206)

公開25、preview12。catalogのliveとは別。

<a id="m02"></a>

## M02 — 種目定義

[src/games/config/multiGameList.json:3](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/src/games/config/multiGameList.json:3)

37種目、ベット形式/評価軸。生データのスナップショットはmgx-variants.json。

<a id="m03"></a>

## M03 — 既存 Pro MIX

[src/config/mixed/proPresets.js:1](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/src/config/mixed/proPresets.js:1)

HORSE/8/10のOmaha枠にB06=PLO8、10-GameにS01。

<a id="m04"></a>

## M04 — 学習用ルールとMIX

[src/ui/learning/learningCatalog.js:47](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/src/ui/learning/learningCatalog.js:47)

13種目。学習用HORSE/8-GameはB09=FLO8で、Pro側と定義差。

<a id="m05"></a>

## M05 — MIX 編集・回転

[src/ui/screens/MixedGameScreen.jsx:27](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/src/ui/screens/MixedGameScreen.jsx:27)

20種上限。固定/加重/カテゴリ、ハンド数、上下移動、保存。rotationUtils.jsは手数基準で回転。

<a id="m06"></a>

## M06 — ゲスト練習条件

[src/ui/practice/practiceSetup.js:1](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/src/ui/practice/practiceSetup.js:1)

手札指定の3種（Badugi/A5TD/27TD）。practiceTransfer.jsは開始手札をURL化。

<a id="m07"></a>

## M07 — 通常対局の認証・操作

[src/ui/App.jsx:14714](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/src/ui/App.jsx:14714)

通常対局AuthGate。seat設定はあるが、現行共通操作はHero席中心。全席自己操作と同一視しない。

<a id="m08"></a>

## M08 — Friend Match API

[backend/app/api/p2p.py:184](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/backend/app/api/p2p.py:184)

Badugi以外拒否。ルームコード招待、永続化・再接続基盤あり。

<a id="m09"></a>

## M09 — Friend Match 人数

[backend/app/p2p/manager.py:292](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/backend/app/p2p/manager.py:292)

2席。公開ロビー、多種目、人間6人の同時対戦ではない。

<a id="m10"></a>

## M10 — 復習保存

[src/ui/review/reviewStore.js:5](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/src/ui/review/reviewStore.js:5)

ブックマーク200件・メモ・タグあり。ReviewScreenは端末保存と明示。

<a id="m11"></a>

## M11 — 履歴・レビュー導線

[src/ui/screens/HistoryScreen.jsx:1](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/src/ui/screens/HistoryScreen.jsx:1)

再生・JSON書出し・レビュー依頼。AIフィードバックは既存なので一律未実装にしない。

<a id="m12"></a>

## M12 — 個人評価画面

[src/ui/screens/LeaderboardScreen.jsx:24](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/src/ui/screens/LeaderboardScreen.jsx:24)

個人のratingState履歴。名称はLeaderboardだがオンライン参加者順位表ではない。

<a id="m13"></a>

## M13 — 設定・統計

[src/ui/screens/TitleSettingsScreen.jsx:30](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/src/ui/screens/TitleSettingsScreen.jsx:30)

プロフィール/VPIP/PFR表示。音、配信匿名化、スリープ防止の公開設定は探索範囲で見つからず。

<a id="m14"></a>

## M14 — 画面経路

[src/RootApp.jsx:27](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/src/RootApp.jsx:27)

一覧/練習/復習/大会などは存在。独立した役判定/リアル卓札/公開イベントカレンダーの経路なし。

<a id="m15"></a>

## M15 — 直近の実機QA記録

[reports/gameplay-device/PHASE-AND-PENDING-QA.md:1](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/reports/gameplay-device/PHASE-AND-PENDING-QA.md:1)

縦35種・専用2種等の既存QA。最新丸卓の実機横とホーム画面起動は未確認。この調査で再試験していない。

<a id="m16"></a>

## M16 — 手札整列

[src/ui/utils/cardDisplayOrder.js:73](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/src/ui/utils/cardDisplayOrder.js:73)

種目依存の自動整列あり。利用者の手動並替/自動OFFとは別。

<a id="m17"></a>

## M17 — 認証画面

[src/ui/screens/AuthScreen.jsx:60](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/src/ui/screens/AuthScreen.jsx:60)

メール/パスワード認証。Google/Appleの公開ボタンは未実装。

<a id="m18"></a>

## M18 — SDの実装

[src/games/draw/DeuceToSevenTripleDrawEngine.js:365](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/src/games/draw/DeuceToSevenTripleDrawEngine.js:365)

S01/S02はこの固定リミット基底を継承。S01のmaxDrawRoundsのみ1へ変更。

<a id="m19"></a>

## M19 — Friend Match UI

[src/ui/screens/FriendMatchSetupScreen.jsx:26](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/src/ui/screens/FriendMatchSetupScreen.jsx:26)

対人専用画面。ルーム共有と復帰案内、金額入力の改善あり。共通丸卓とは別実装。

<a id="m20"></a>

## M20 — 種目検索

[src/ui/screens/GameSelectorScreen.jsx:212](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/src/ui/screens/GameSelectorScreen.jsx:212)

分類/検索/ベット表記/公開判定あり。

<a id="m22"></a>

## M22 — Archieの成立条件

[src/games/draw/SpecialDrawEngine.js:232](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/src/games/draw/SpecialDrawEngine.js:232)

MGXはone-pairという役カテゴリで成立とし、ペアランク9以上の判定はない。Tapliの説明99以上とは差がある。

<a id="m21"></a>

## M21 — 大会機能

[src/ui/screens/TournamentScreen.jsx:22](/Users/koki/Documents/Codex/Worktrees/badugi-app/mgx-learning-entry/src/ui/screens/TournamentScreen.jsx:22)

ローカル/CPU大会導線、構造・進行・再開が既存。オンライン大会運営とは区別。

## 探索方法と未確認範囲

MGXは公開種目定義・実エンジン・画面経路・MIX設定・対人API・復習保存・既存QA記録を読み、音/スリープ防止/配信/共有/チャット等をコード検索した。「未実装」はこの経路で利用可能な製品機能を確認できなかった意味で、別ブランチや未接続の試作まで不存在と断定するものではない。

Tapliのログイン、実ユーザーとの対戦、大会参加、課金、プリセットのアカウント保存、全111種の精算は試していない。今回iPhone実機や負荷試験も行っていない。技術スタック・MAU・継続率・CPU強度・乱数の公平性・セキュリティ・収益は不明。

Tapli NLHでは手動でショーダウンまで到達後と次ハンド開始後に履歴を開いたが、ゲストの履歴は0件だった。保存条件/不具合のどちらかは未確定。練習中の手札欄の残チップ表示と座席表示にも終了時の差を観測したが、原因未調査のため品質優劣の根拠にはしない。

Tapliの設定は存在確認と一部切替まで。スリープ防止、7人卓、配信、同期などの成功保証ではない。MGXもこのターンで対局再試験はしていない。
