# MGX v1 Release Contract

2026-11-02。ユーザーのv1完成方針と実行指示に基づく実装契約。
状態・担当・完了の正本は [親 #123](https://github.com/Koki-Minoda/badugi-app/issues/123)。
この文書は条件と実行方法を定義する。生成レポートは実行時点の証拠であり、現在の状態を上書きしない。

## 完成範囲

Coreは `scripts/quality/v1-core-contract.mjs` の10種目。
NLH、PLO、FLO8、Stud、Stud8、Razz、2-7TD、A-5TD、Badugi、2-7SD。
既存非Core種目を削除せず、追加開発と全難度RLはPost-v1へ分離する。
共有処理や既存公開範囲の重大不具合は修正対象に残す。

| Gate | 閉じるための証拠 | 管理 |
| --- | --- | --- |
| G0 Stability | 対象公開SHA、P0/重大P1が0、全nightly完了 | #291、PR #290 |
| G1 Core | 種目ごとに合法手・勝敗・カード/チップ・連続進行を認定 | #294 |
| G2 Tournament | 提供経路と種目を特定、バースト・統合・再開・優勝まで完走 | #294 |
| G3 UI/UX | Play比較、手番と金額、preset、予約、History、実機・初見操作 | #293、#191 |
| G4 Visual | Constitution、tokens、優先6画面の状態と階層 | #293 |
| G5 Learning | 1つ以上のMixed代表種目の認定局面で学習ループを一巡 | #295から後続Issue |
| G6 Coach | 校正と未見評価、Why根拠、confidence、独立戦略レビュー | #295 |
| G7 Release | 同じSHAのCI、backup、配備、公開検査、実機・独立レビュー | #291、#191 |

## QAを混同しない

1. エンジン側の反復検査：Coreごとに10,000ハンド、10 seed群、2〜6人。
2. ブラウザ：CoreごとにPC、Android相当Chromium、iPhone相当WebKitで各100連続ハンド。
3. 長時間：Coreごとの同一ページで120分の連続操作。単なる120分の放置を合格にしない。
4. 勝敗と特殊局面：独立した期待値のfixture、raise、交換、side pot、short all-in、同点・Hi/Lo。
5. Tournament：cashのハンド数とは別。対応する公開経路ごとに完走と統合・再開を検証。
6. 物理端末と初見評価：エミュレーション・実装者の自己確認とは別に記録。

`node scripts/quality/run-v1-core-soak.mjs --report=reports/release-v1/<unique-name>.json`
は既存controller harnessを利用する。チェック・コール・Patを選び、**各ハンドのbankrollを初期化する独立サンプル検査**。
連続cash、Raise/交換判断の網羅、強いCPU、独立評価器の認定を証明しない。
`--variants=B01,B05`、`--seeds=10`、`--hands-per-seed=1000` で範囲を指定可能。
既存reportがあれば停止し、source SHAと実ファイルのhashを保存する。

ブラウザは既存 `all-live-core5-cash-production.spec.ts` を使い、
`MGX_ALL_LIVE_CASH_HANDS=100`、Coreのvariant filter、端末profile、seed、専用report dirを指定。
`MGX_EXPECTED_SERVED_COMMIT` で配信SHAを固定する。ビルドのpreviewは `--base /` を指定し、
`/release.json` とAPI healthを確認してから開始する。
初期設定の失敗・未実行も証跡として保持し、再実行の成功で元の失敗を書き換えない。

## 対応モード

cashは10 Coreの公開カタログに存在する。career tournament menuの種目は
`src/config/tournamentUnlocks.js`、実際の開始とcontrollerは `src/ui/App.jsx` が根拠。
メニュー登録、URLでの開始、MIX内の進行、P2P対応を同一視しない。
台帳はCore×cash/tournament/mix/p2p×Gateを記録し、未調査は `not_verified` とする。
対応していないと確認した組合せは理由を付けて `not_applicable` にする。未調査をN/Aにしない。

## 証拠の形式

各記録は `variantId, mode, gate, sourceCommit, sourceHashes, servedCommit,
modelVersion, seed, playerCount, device, startedAt, duration, hands,
result, evidencePaths, remainingFindings` を必要に応じて持つ。
`pass` は当該検査範囲だけ。`partial`、`fail`、`not_verified`、`not_applicable`を区別する。
Core×mode×Gateの一覧は `node scripts/quality/build-v1-ledger.mjs` で生成する。

## 最小学習ループ

認定されたゲームと局面で Play→MGX Strategy Score→Why→Leak→Drill→Replay→成長。
改善点は最大3。Leakは50〜100ハンドかつ十分な該当機会に基づく。
Drillは検証済みtemplateから選び、自由生成の未検証問題を出さない。
成長は同じgame/skill/evaluator版で比較する。

Scoreの新しい利用者は `src/ui/coaching/coachQualityGate.js` で事前確認する。
既存CPU routingとpreview lessonsをこの実装で昇格したものとは扱わない。
全ゲームのGTO、全難度RL、Exploitative CPU、新種目はv1条件に加えない。

## 実行単位

Audit→Plan→Issue→Implementation→QA→Review→Next Issue。
完了条件を満たしたIssueだけ閉じる。コード、モデル、デザインを一括で品質認定しない。
iPhoneはユーザーが後日確認可能。Androidと初見協力者の実施証拠はまだ別途必要。

## 確認済みの入口と範囲

P2Pは `FriendMatchSetupScreen.jsx` の選択肢と `backend/app/api/p2p.py` の受付がともに
Badugi、2-7TD、A-5TDの3種目。残りのCore7種目はAPIが422で拒否するため、このモードのGateは
理由付きでN/Aにする。v1のためにP2P対応種目を増やす必要はない。

MIXの編集画面は `listVariantProfiles` からカタログを列挙するので10 Coreは一覧に存在する。
これはローテーション途中の動作認定ではない。
Tournamentのunlock一覧には5種目がある一方、`tournamentStages.js` の実stageはBadugiを使う。
unlock表示をそのまま5種目のTournament提供証拠にしない。NLH等のfixture/URL経路と通常の利用者入口を
分けて認定し、v1に新しいTournament展開を暗黙追加しない。
