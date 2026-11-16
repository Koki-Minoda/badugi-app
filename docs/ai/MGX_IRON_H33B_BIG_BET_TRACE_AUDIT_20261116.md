# H33b履歴原本のbig bet単位照合

対象Issue: #334。H33bの既存原本を**単位・安全・来歴の診断**にだけ使う。H33bのseedは探索・過去G4で使用済みであり、新しいIron候補のholdoutへ再利用しない。この記録をIron採用・人G5・本番公開の根拠へ昇格させない。

## 方法

`src/rl/evaluation/audit_badugi_trace_units.py` は既存の `sessions.jsonl` と `hand-trace.jsonl` を一行ずつ読み、各sessionに属するhandのseed、group、profile、hero seat、連番を照合する。2/3/6席の全席 `startingStack + chipDelta = endingStack` と終局差分合計0、hand間の全席stack連続性、負stackなし、session英雄chip差分の望遠和、行動mask、公開actionのBET額とstack遷移、DRAW枚数、heroのモデル使用状態、fallback 0、推論期限、元session集計を検査する。これは**各終局・hand境界のchip照合**であり、全遷移のpot/commit ledgerではない。

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

元H33bはcandidate/reference各100,000独立20hand session、各2,000,000 hand。最初の各100 sessionは別のprefix診断JSONへ保全した。全量の入力/出力SHA、40 cellの件数、観測したsession収益範囲、最大推論時間は `/Users/koki/Documents/Codex/MGX-RL-Artifacts/mgx-phase1-trace-unit-diagnostic-20261116/` の `candidate-gate-v2.json` と `reference-gate-v2.json` を正本とする。両armのmanifest、session、hand入力SHAは既存H33b `strength-audit/audit.json` と完全一致した。adapter本体SHA256は `a705de02e469668b60ce525cc09b555b92afe9dbcfc106eb2bc110e3116301a3`。旧`*-final.json`はhand間連続性検査前、旧`*-continuity.json`はhero席を明示する前の診断原本として残し、現行ゲートへ入力しない。

## 全量診断結果（既存データのみ）

| 項目 | H33b candidate | 公開Pro reference |
| --- | ---: | ---: |
| 検査済みsession / hand | 100,000 / 2,000,000 | 100,000 / 2,000,000 |
| 全体平均 big bet / 100 hand | 113.41602475 | 104.56745800 |
| cash平均 big bet / 100 hand | 95.30858750 | 91.45465000 |
| MTT平均 big bet / 100 hand | 131.52346200 | 117.68026600 |
| 観測session score範囲 | −100 ～ +500 | −100 ～ +500 |
| 最大hero推論時間 | 11.414 ms | 15.560 ms |
| 変換JSONL SHA256 | `d0adab487d1b0780c4761bf6638ce353b8dbfac45c11b589a70153376f938cc9` | `48b21436148f0f8063763bda344b3f9e50b57bc06db7099c8313cd62153901f4` |
| 監査JSON SHA256 | `483dcc1dd1f5e935c79cdbceb5e01f1439abf3a781f8c3af29c54c2c5cd74b22` | `eae89ecaa55f30311fb1e0b6e0e3aa4eee07050b3c41e431001db0d19c2f75cd` |

candidate − Proの記述的な平均差は全体 +8.84856675、cash +3.85393750、MTT +13.84319600 big bet / 100 hand。これは元G4のBB/hand数値を50倍した結果と一致する。元G4の負のpoint cellは12のまま保持する。

## H33b固定設定に限る収益範囲の証明

凍結code `a0f29914f206bffc177856dbb779c6e11933841f` の `BadugiControllerInteractiveV2Draft` と評価器のreset呼出しでは、cashは参加席あたり初期500 chip・全hand BB20、MTTは初期2,000 chip・全hand BB50で、session中の補充指示はない。全200,000 sessionの変換原本で、参加席数2/3/6、初期stack、20handすべてのBB、hand間全席stack連続性、終局チップ総量を照合した。浮動小数点許容差 `1e-9` 以内で `netBigBets = (最終hero stack − 初期hero stack) / (2 × BB)` が全件成立した。

参加席数を `O`、各席初期stackを `S`、固定BBを `B` とすると、負のstackがなくチップ総量 `O×S` が保存されるため、heroの20hand純増減は `−S ≤ Δchips ≤ (O−1)S`。したがって100hand正規化scoreの**理論範囲**はcash `[-62.5, 62.5×(O−1)]`、MTT `[-100, 100×(O−1)]` big bet/100hand、全cell共通では `[-100, +500]`。これは観測極値からの推測ではなく、この凍結設定・補充なし・連続ledgerを条件とする算術的上限である。ただし将来の新候補用ゲートでは、同じ設定、初期stack、固定BB、補充禁止、session長を**収集前の計画**へ固定し、実controllerと独立監査で再確認する。H33b過去データを新しいholdoutと見なす理由にはならない。

## 使える範囲と次の課題

- 変換JSONLは後続の逐次評価器に必要なsession単位の形を示すが、H33bを新しい最終holdoutとして再採点するためのものではない。
- 新しい`scoreBounds` は観測最小・最大から決めない。H33bと違うstack、BB、補充、session長なら同じ範囲を使えない。実行設定から範囲を事前計算し、計画とcontrollerの一致を独立監査する。
- 現行adapterは元トレースの正しさを構造的に照合する。行動maskと記録された額・stack遷移は確認するが、すべてのstreetでの額の完全な合法性や全中間ledgerは証明しない。モデルbody SHA、元学習seedとの不交差、逐次評価の予定look、未知相手分布も別の独立監査が必要。
- より小さい改善幅を実用的な計算予算で検証するため、誤判定率を保つ分散適応型の逐次法を次の独立PRで検討する。既存の採用基準を事後的に緩めない。
