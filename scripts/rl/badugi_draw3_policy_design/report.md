# D03 M1：3街の保持・交換方針比較の収集前設計（2026-11-26）

## 現状と結論

Issue [#483](https://github.com/Koki-Minoda/badugi-app/issues/483) の**設計**を `frozen-design.json` に固定した。M1の全初手・全16保持マスクの1回交換厳密分布（[#479](https://github.com/Koki-Minoda/badugi-app/issues/479)、Draft [#481](https://github.com/Koki-Minoda/badugi-app/pull/481)）は初回交換方針の候補選択に使える。ただし、相手の公開ベットから非公開札の分布が変わり、後続の交換では自分が見た/捨てた札、他席への配牌、burn、山札枯渇とdiscard再利用が条件になる。**独立な48枚山札からの1回交換分布を3回掛け合わせない。**

現在のV2 controller bridgeはONNXが交換枚数0〜4を選び、`badugiControllerDrawIndexesV2Draft.js` が保持札を決定する。16保持マスクをモデル判断として直接指定する経路は未実装。候補専用に明示keepを実controller `DRAW`へ渡す最小拡張と、actor公開情報だけを渡すprojectionが先決。設計段階であり、新3街実験結果・入場EV・Iron実力の主張はない。

## 実controller・公開情報境界の監査

| 事実 | 実ファイル・意味 |
|---|---|
| 3回交換、交換前後にBET街 | `src/games/badugi/engine/BadugiEngine.js` は `maxDrawRounds:3`。候補bridgeの`drawRoundIndex`はDRAW0〜2、最終BET3。 |
| 初期deck/burn | `src/games/badugi/engine/BadugiEngine.js` が52枚をshuffleし1枚burn。controller bridgeは実`DeckManager`から各席に4枚配る。 |
| 交換順序とdiscard | `src/rl/badugiControllerInteractiveV2Draft.js` はdraw枚数分を`DeckManager.draw(..., activeCards)`し、その後に旧札を`discard`。同一交換で今捨てた札は引かない。 |
| 山札不足時 | `src/games/badugi/utils/deck.js` はdraw前/途中に`recycleIfNeeded`/`recycleNow`し、discardとburnのうちactive cardsでない札をshuffleして戻す。6席全員が4枚ずつ交換し続けると初期残27枚だけでは足りない。 |
| 現在の行動入力 | V2観測は本人4枚、位置、価格、合法mask、公開相手の集約行動/交換枚数を持つ。候補V3 `af058a52` は本人の既視札と自分のreplacement、当局の公開BET額・交換枚数、過去handの公開頻度を別証拠として渡す。 |
| 非公開境界 | `badugiControllerSeatEventViewV2Draft.js` は相手DRAWの枚数のみ、本人DRAWだけ旧札/新札を含める。候補V3もshowdown札を未監査の段階では除外。対局真値のdeck・burn・他席手札は監査器だけが読む。 |
| 既存制約 | V2はDRAW action index 0〜4から固定discard selectorを呼ぶ。保持マスク16通りの比較には候補専用の明示`drawIndexes`経路、controller照合とactor可視情報のテストが必要。公開モデル経路は触らない。 |

6人全員参加なら初期24枚＋burn1枚で山札は27枚。各人が初回4枚交換すると24枚を消費し、次の街でrecycleが必要になる。2人/3人の同じ方針とは札の可用性が異なる。初回の48枚分布は本人4枚だけを条件にした**周辺分布**として正しいが、相手の公開行動を見た条件付き分布や3街controllerの代用品ではない。

## 計算量と採用する比較方法

初手を問わず、3街の固定マスク列だけで16³=4,096通り。全270,725初手に掛けると1,108,889,600通りの行動列で、各列には交換札・相手行動・山札再利用の分岐がさらに付く。適応方針を厳密に全展開しない。1回交換の全分布を**初回方針の候補生成**に限定し、3街結果は実controllerで条件付きサンプリングする。

`frozen-design.json` は最初の**安全・機会pilotだけ**を収集前に固定する。4初手層（A-6-T境界、A-2〜A-6の有効2枚、完成4枚T〜K、他の自然対照）×cash/MTTと物理/参加席の10卓群×既知人工相手5型×各2新seed＝400同条件の基準局面。それぞれ6方針を同一初期deck seed・同席で再生し、計2,400一局run。方針は基準ONNX、初回完成率重視、初回9ロー完成率重視、2回目/3回目に現在最良有効札を保持する単一介入、3回目PAT対照。BET判断は全腕同じcheckpoint31とし、1回の比較で複数街を同時に変えない。2,400は安全・観測機会用で、統計的優劣を結論しない。

pilotは全判断の合法手/額、本人4枚、全席chip、52枚重複・deck/discard/burn保存、実ONNX、期限とfallback0を確認し、deck枯渇/recycle、all-in DRAW、折りたたみ席、PAT、交換1〜4枚の頻度を記録する。固定60基準seedを完全再生し、本人が見える行動列と監査だけの真値列を別保存する。将来の収益比較にpilot seedを再利用しない。新seedは32-bit実deck seedへの変換で既記録分と衝突0を確認し、collector/model/code/seed一覧のSHAとともに**収集前**に別実行manifestへ凍結する。いまはcollectorと明示keep経路がないためseed収集・対局は開始しない。

pilot後は別seedのFIT/VALIDATEを設計して、街別/終局の役分布、4枚完成の最高5/9/T以下の確率、改善/悪化、PAT/交換頻度をsession単位の不確実性とともに比較する。特定相手へのEQを付けるなら、その相手の**公開情報からのレンジモデルと較正**を別証拠にする。BET価格を含むFOLD/CALL/RAISEのEVと入場表はM2〜M4、Iron実力はM8の独立対局でのみ判定する。

## 次のチェックポイント

1. 候補専用の明示keep経路と公開/非公開projectionの拒否テストをDraft PRで実装。全16マスク、PAT、2/3/6席、all-in、recycle、既存ONNX count経路とのparityを検査。
2. 5〜20手のbounded smokeで実行速度・メモリとdeck/recycle監査を測り、pilotの最大時間を固定する。
3. 層化配牌の再現可能なseed screeningと既使用実deck seed衝突監査、collector/model/code/seed SHAを凍結。`frozen-design.json` の条件を満たす2,400一局安全pilotを実行。
4. pilot原本・欠落セル・資源負荷を独立再集計してから、別seedで役分布の比較計画を凍結。入場EVとCPU強度の評価へ流用しない。
