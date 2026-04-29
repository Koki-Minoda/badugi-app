# Round Skip Analysis

## BETスキップ条件一覧
- `src/ui/App.jsx` の `checkIfOneLeftThenEnd` (付近:3317): アクティブプレイヤーが1人以下（foldだらけ等）の場合に `goShowdownNow()` を呼び、残りBET/DRAWを省略して即ショーダウン。
- `src/ui/App.jsx` の `afterBetActionWithSnapshot` (付近:4390): 全員 all-in でも BET の行動だけスキップし、`scheduleFinish()` → `finishBetRoundFrom` が通常どおり DRAW/SHOWDOWN を判定する（BETそのものは省略されず即座に閉じるだけ）。
- `src/games/badugi/engine/roundFlow.js` の `finishBetRoundFrom` (付近:330): `isBetRoundComplete` / `needsActionForBet` が真なら DRAW へ。`activeNonAllIn` が0または `nextRound > MAX_DRAWS` のときのみ SHOWDOWN に遷移し、BETを明示的に飛ばす。

## DRAWスキップ条件一覧
- `src/ui/App.jsx` の `finishDrawRound` (付近:5180): 全員 `hasDrawn` or ineligible のとき `transitionToBetPhase` を呼び出し、DRAWを終了。DRAW自体を省略する分岐はない。
- `src/ui/App.jsx` の `autoResolveCpuDrawIfNeeded` (付近:228): DRAW中に acting seat がCPUなら必ず `npcAutoDrawCount` → `finishDrawRound` へ進め、DRAWターンを連続消化。`findNextDrawActorSeat` が `null` のときのみ `finishDrawRound` を起動。
- `src/games/badugi/engine/roundFlow.js` の `finishBetRoundFrom`: DRAWの回数 (`nextRound`) が `MAX_DRAWS` を超過するまで DRAW を形成する。DRAWを一足飛びでスキップする条件は定義されていない。

## BET/DRAW 共通化箇所
- `src/ui/App.jsx` の `transitionToBetPhase` / `transitionToDrawPhase` 呼び出し箇所（例: `dealNewHand`, `finishDrawRound`, `finishBetRoundFrom` 呼出側）で actingPlayerIndex を再計算し、BET/DRAW 以外では `actingPlayerIndex` を `null` 扱いとする。
- `src/games/badugi/engine/roundFlow.js` の `finishBetRoundFrom` が BET 終了時の分岐（次が DRAW か SHOWDOWNか）を一括制御、DRAW → BET への遷移も `transitionToBetPhase` に集約。

## AI時に DRAW が省略され得るか？
- **No**。根拠: `src/ui/App.jsx` の `autoResolveCpuDrawIfNeeded` (付近:228) は `phase === "DRAW"` の間ずっと monitor し、CPU席ごとに `hasDrawn` を付けて `finishDrawRound` を呼ぶまでループする。全員AIでも `turn === 0` 以外はこの関数が自動描画を発火するため DRAW ラウンドを飛ばさない。

## 疑わしい箇所 TOP3
1. `src/ui/App.jsx:4388` 付近の `turnPlayer?.allIn` 判定 — BET処理を即スキップするので DRAW へ渡る前に metadata が抜け落ちないか注意。
2. `src/ui/App.jsx:3317` の `checkIfOneLeftThenEnd` — `active` フィルタから all-in を除外しているため、特定の all-in 複数状態で誤って SHOWDOWN へ飛ぶリスクがないか監視が必要。
3. `src/games/badugi/engine/roundFlow.js:330` の `finishBetRoundFrom` — `activeNonAllIn.length > 0` を前提に DRAW へ進むため、ロジック変更時に `activeNonAllIn` 計算を壊すと DRAW スキップが発生し得る。
