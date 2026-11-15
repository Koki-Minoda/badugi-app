# H33b履歴原本のbig bet単位照合

対象Issue: #334。H33bの既存原本を**単位・安全・来歴の診断**にだけ使う。H33bのseedは探索・過去G4で使用済みであり、新しいIron候補のholdoutへ再利用しない。この記録をIron採用・人G5・本番公開の根拠へ昇格させない。

## 方法

`src/rl/evaluation/audit_badugi_trace_units.py` は既存の `sessions.jsonl` と `hand-trace.jsonl` を一行ずつ読み、各sessionに属するhandのseed、group、profile、hero seat、連番を照合する。2/3/6席の全席 `startingStack + chipDelta = endingStack` と終局差分合計0、行動mask、公開actionのBET額とstack遷移、DRAW枚数、heroのモデル使用状態、fallback 0、推論期限、元session集計を検査する。これは**終局時のchip照合**であり、全遷移のpot/commit/再購入ledgerではない。

各handの固定リミットbig bet額を `2 × activeBigBlind` とし、`netBigBets = Σ heroChipDelta / (2 × activeBigBlind)`、`score = 100 × netBigBets / sessionHands` を計算する。controllerの後半street bet unitがこの額であることを現行 `badugiControllerObservationV2Draft.js` と照合した。元評価の `chipBbPerHand = Σ heroChipDelta / activeBigBlind / sessionHands` との換算一致も全sessionで確認する。モデルSHAは凍結manifestが**申告したID**として出力し、モデルbodyの再ハッシュやブラウザ実使用の証明とは分ける。

全量変換は新規JSONL出力を `.partial` の名前で作り、元session・全handを消費して検査が終わった時だけ最終名にする。失敗した部分出力は成功JSONLにならない。診断prefixモードはゲート入力JSONLを作らず、消費したprefixのSHAだけを記録する。

## 実行

```bash
python3 src/rl/evaluation/audit_badugi_trace_units.py \
  --manifest /path/to/h33b/candidate-manifest.json \
  --sessions /path/to/h33b/candidate/sessions.jsonl \
  --hands /path/to/h33b/candidate/hand-trace.jsonl \
  --output /isolated/candidate-converted.jsonl \
  --report /isolated/candidate-audit.json
python3 -m unittest src/rl/__tests__/test_audit_badugi_trace_units.py
```

元H33bはcandidate/reference各100,000独立20hand session、各2,000,000 hand。最初の各100 sessionは別のprefix診断JSONへ保全した。全量の入力/出力SHA、40 cellの件数、観測したsession収益範囲、最大推論時間は `/Users/koki/Documents/Codex/MGX-RL-Artifacts/mgx-phase1-trace-unit-diagnostic-20261116/` の `candidate-final.json` と `reference-final.json` を正本とする。両armのmanifest、session、hand入力SHAは既存H33b `strength-audit/audit.json` と完全一致した。adapter本体SHA256は `4233de0a9f111c6435d9980f0f7659a7ca440ac89df27b0daf0502507bd37829`。

## 全量診断結果（既存データのみ）

| 項目 | H33b candidate | 公開Pro reference |
| --- | ---: | ---: |
| 検査済みsession / hand | 100,000 / 2,000,000 | 100,000 / 2,000,000 |
| 全体平均 big bet / 100 hand | 113.41602475 | 104.56745800 |
| cash平均 big bet / 100 hand | 95.30858750 | 91.45465000 |
| MTT平均 big bet / 100 hand | 131.52346200 | 117.68026600 |
| 観測session score範囲 | −100 ～ +500 | −100 ～ +500 |
| 最大hero推論時間 | 11.414 ms | 15.560 ms |
| 変換JSONL SHA256 | `9ed1fa38c570a61e32a57fb695f58dac39732ce5f45db1f7004a5324779762f0` | `9cd3a3f9f0d626abb495d2d497f733f64cdc1773415140ac076392bf765ada8f` |
| 監査JSON SHA256 | `909aaf3845390daebdece185f9e48d926c8f7827566dd49ebbcaa0792a4ddee4` | `979ef2b3b129bed6738572ef4bc189c0bce45669bb48c3307450da7f7df045ba` |

candidate − Proの記述的な平均差は全体 +8.84856675、cash +3.85393750、MTT +13.84319600 big bet / 100 hand。これは元G4のBB/hand数値を50倍した結果と一致する。元G4の負のpoint cellは12のまま保持する。観測範囲は真の取り得る範囲の証明ではないため、この数値から逐次ゲートの `scoreBounds` を設定しない。

## 使える範囲と次の課題

- 変換JSONLは後続の逐次評価器に必要なsession単位の形を示すが、H33bを新しい最終holdoutとして再採点するためのものではない。
- `scoreBounds` は観測最小・最大から決めない。固定リミットのルール、スタックと再購入上限から取り得る範囲を証明し、事前manifestに固定する。
- 現行adapterは元トレースの正しさを構造的に照合する。行動maskと記録された額・stack遷移は確認するが、すべてのstreetでの額の完全な合法性や全中間ledgerは証明しない。モデルbody SHA、元学習seedとの不交差、逐次評価の予定look、未知相手分布も別の独立監査が必要。
- より小さい改善幅を実用的な計算予算で検証するため、誤判定率を保つ分散適応型の逐次法を次の独立PRで検討する。既存の採用基準を事後的に緩めない。
