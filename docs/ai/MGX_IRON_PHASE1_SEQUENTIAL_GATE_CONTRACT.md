# Iron Phase 1: 逐次評価器の最小契約

対象Issue: #332。これは**昇格候補の判定器**であり、Ironの学習・本番採用・公開を実行しない。既存のG4/H33b評価原本は研究用の履歴として保持し、同じseedを新候補の最終holdoutへ再使用しない。

## 現在実装した単位

`src/rl/evaluation/sequential_gate.py` は、実controllerから得た独立sessionを入力し、Pro対候補の `PROMOTE` / `REJECT` / `CONTINUE` を出す。`PROMOTE` は**候補として次の人間・独立評価へ送る**意味だけで、`productAdoptionApproved` は常に `false`。すべての結果に現行の判定限界を付ける。

入力planの重要な固定項目は次のとおり。

| 項目 | 内容 |
| --- | --- |
| `scoreUnit` | `big_bet_per_100_hands` 固定。Badugi固定リミットのビッグベットを使い、ビッグブラインドと区別する |
| `candidateModelSha256` / `referenceModelSha256` / `controllerContractSha256` | 候補、公開Pro、実controller契約の同一性 |
| `scoreBounds` | **ルール・スタック・再購入条件から事前に証明した**独立sessionスコアの有限上下限。観測後に変更しない。範囲外はclippingせず失敗 |
| `familywiseAlpha`, `minimumImprovement` | 許容誤判定率と実用改善幅。学習・選択・holdout観測前に固定 |
| `lookSessionsPerCell` | 各cell・各armで同数の独立sessionを揃える評価時点。最後の値が最大look |
| `handsPerSession`, `maxHandsPerArm` | 全session共通のhand数と1 armの計算上限。等長に固定することでsession平均を100 hand当たりの収益と一致させる |
| `cells` | 席数×cash/MTT×相手タイプ等と重み。cash/MTTを必ず含め、重み合計1 |
| `seedWindows`, `excludedSeedWindows` | 候補/Proの不交差評価seed範囲と学習・選択・H33b等の既使用範囲 |
| `maxInferenceMs` | 通常推論の事前固定期限 |

session JSONLには `sessionId`、cell内の連番 `sessionIndex`、一意の `seed`、`cell`、planどおり固定の `hands`、`netBigBets`、model/controller SHA、`source=real-controller`、`chipBalanced=true`、`illegalActions=0`、`fallbacks=0`、`inferenceRequests=inferenceUsed>0`、`maxInferenceMs` を要求する。`netBigBets` は元の**各handのchip差分÷そのhandの固定リミットbig bet額**から別の監査済みadapterが算出する必要がある。既存H33bの `chipBbPerHand` を名前だけ変えて入力することは禁止する。等長sessionを作れない条件はこの評価器に無理に通さず、可変長の収益率と依存性を扱う別契約を先に作る。評価器は偽の原本を見抜けないため、元のhand trace・モデル使用ログ・seed台帳の独立監査が先行条件となる。

## 判定と統計的保証

cash、MTT、事前重みを使ったoverallの3指標を同時に扱う。cellごとのsession平均を等価な独立観測として取り、各指標の差と区間を計算する。予定look数を `K`、familywise許容率を `α` とすると、各指標・各lookへ `α/(3K)` を割り当てる。各armの層化平均にHoeffding上界を適用し、候補差区間は二つのarm半径を足す。表示するcell平均・sample varianceは**記述値**であり、cellの合否区間ではない。

全3指標の区間下端が事前固定の改善幅を上回れば `PROMOTE`。いずれかの上端が改善幅以下なら `REJECT`。その間は次の固定lookへ `CONTINUE`。最大lookで曖昧な場合は `REJECT/MAX_BUDGET_NO_PROMOTION` とし、「劣ることが証明された」とは記述しない。安全契約違反、無効モデル使用、seed重複、score範囲外、部分lookは成功結果を出さず例外で停止する。異常を候補の収益成績に紛れ込ませない。

このα上界は**独立で真に有界なsession、事前固定planと重み、正しい単位、全lookの原本保全**を仮定する。session内のhandは独立数として数えない。反復lookで同じsessionを再利用すること自体は予定された逐次手順であり、Bonferroni割当で扱う。共通配牌や座席交換を使う場合は依存構造が変わるため、その方式に合わせて別の証明・検証を行う。現時点では二armを独立評価とする。

### 既存H33bを使った感度診断

現行v2 controllerは後半streetの固定リミットbet unitを `2 × activeBigBlind` としている。H33bの検証器は各handのchip差分を `activeBigBlind` で割って `chipBbPerHand` を作る。したがって**このcontroller設定に限り**、H33bのBB/hand差を `50 ×` するとbig bet/100 handになる。過去の候補−Proの点推定は全体約+8.85、cash約+3.85、MTT約+13.84 big bet/100 hand。従来の0.05 BB/hand改善幅は条件付きで2.5 big bet/100 handに相当する。これは過去G4の単位再表示であり、新規Iron強度・人実戦・新holdoutではない。

H33bの各arm 100,000 sessionで観測したsessionスコア範囲は −100〜+500 big bet/100 handだった。ただし**観測範囲を真の取り得る範囲と見なしてはいけない**。仮にこの幅600をルールから証明でき、3look・familywise α=0.01・40等重みcell・各cell 2,500 sessionを使ったとしても、このHoeffding差半径は全体約7.68、cash/MTT約10.86 big bet/100 handになる。cashの過去改善差3.85を2.5以上と判定するには大幅な追加sessionが必要である。従ってこの評価器だけで既存2百万hand/armのデータを自動昇格する設計にはしない。次の単位で、真のboundの証明と、分散に応じた**事前に検証した**逐次法の比較を行う。都合のよいlookや事後的なbound縮小で通過させない。

## 実行例

事前凍結したplanと両armのsession JSONLを用意した後、次を実行する。結果JSONには各入力のSHA256を記録する。出力先は新規JSONで、公開model/registry領域を拒否する。

```bash
python3 src/rl/evaluation/sequential_gate.py \
  --plan /isolated/evaluation/plan.json \
  --candidate /isolated/evaluation/candidate-sessions.jsonl \
  --reference /isolated/evaluation/pro-sessions.jsonl \
  --output /isolated/evaluation/gate-result.json
python3 -m unittest src/rl/__tests__/test_sequential_gate.py
```

テストは強い/弱い/曖昧な候補、安全・来歴・単位違反、区間半径の縮小を確認し、独立null分布300反復×最大3lookの偽陽性診断を実行する。このsimulationは計算式の保証に代わらない。

## 残るPhase 1作業

1. 実hand traceから `netBigBets` を再計算する監査adapterと、固定リミットのbig bet額・MTT level変化の独立照合。H33bは過去データの単位校正には使えるが、新Iron候補のholdoutには使わない。
2. ルール、スタック、再購入上限から `scoreBounds` を証明し、狭すぎる任意の範囲で偽の昇格を作れないようにする。
3. 既存H33bの分散と単位再計算、未知相手を含む事前simulationから `minimumImprovement` と最大session/費用を**採用前**に提案する。現行の `0.05 BB/hand` はこの単位へ無断変換しない。
4. 負セルの多重性、ポジション/アクション別安全下限、レイズ額・期限、fallback故障注入を独立ゲートへ追加する。
5. 現行mainで失敗中のnightly (#328) を別PR (#329) の独立採用手順で復旧し、同一SHA公開監査を再開する。

Iron H17bの凍結、公開Pro、G5人間原本未取得を維持する。PRのCI成功は公開強度・人間実戦の証明ではない。
