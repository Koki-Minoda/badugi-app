# MGX Badugi Phase 0: 実装棚卸しと計算予算

基準日: 2026-11-16 JST。対象は `Koki-Minoda/badugi-app` の `dd571b0370f026171d5217a90fa9b70c4460a811`。この文書は計算速度と実装順序の判断資料であり、AI強度の評価・Iron採用判定ではない。

## 結論

- 実controllerを通した6席cash/MTTの単一プロセス実測では、対戦のみ約267–280 hand/s、公開Pro ONNXの直接推論込み約224–229 hand/s、**新規・使い捨て**DQNの1 hand当たり1更新込み約182–198 hand/sだった。100万handの線形所要時間は順に約0.99–1.04時間、1.22–1.24時間、1.40–1.53時間。これらは観測した速度幅であり、統計的な信頼区間ではない。
- 5,000 handの安全・性能診断は3方式とも完走し、終局時の全席chip差分合計は15,000/15,000 handで0、処理速度の後半失速は見られなかった。実行時間は各18–26秒にすぎず、数時間運転の安定性や全遷移のchip保存は未証明。
- 6席・5,000 handの親Python＋子NodeのRSS標本最大は対戦のみ428 MiB、推論438 MiB、更新込み534 MiB。後半の増加は小さいが、短時間のRSS観測なので長期メモリリークなしとは断定しない。
- MacBook Pro M5 Pro/48 GiBで**一つのCPUジョブ**を進める容量の見込みはある。実際のIron訓練、チェックポイント保存、独立評価、並列実行、ブラウザQAを含めた所要時間は未測定。次段階で別々に予算化する。

## 再現方法と測定範囲

再現ツール: [`scripts/benchmark_badugi_phase0.py`](../../scripts/benchmark_badugi_phase0.py)。依存の直接ピンは [`scripts/benchmark_badugi_phase0_requirements.txt`](../../scripts/benchmark_badugi_phase0_requirements.txt)。Node依存は既存`package-lock.json`で固定する。

```bash
cd /path/to/badugi-app
python3.11 -m venv .venv
.venv/bin/python -m pip install -r scripts/benchmark_badugi_phase0_requirements.txt
npm ci
.venv/bin/python scripts/benchmark_badugi_phase0.py \
  --hands 100 --warmup-hands 8 --max-seconds 900 \
  --output /tmp/mgx-d03-matrix.json
.venv/bin/python scripts/benchmark_badugi_phase0.py \
  --seats 6 --hands 1000 --warmup-hands 20 --max-seconds 900 \
  --output /tmp/mgx-d03-1k.json
.venv/bin/python scripts/benchmark_badugi_phase0.py \
  --seats 6 --formats cash --seeds 20261118 --hands 5000 \
  --warmup-hands 20 --max-seconds 900 \
  --output /tmp/mgx-d03-5k-safety.json
```

出力先は既存ファイルやmodel/runtimeディレクトリを拒否する。`duel` は同じ観測に基づく公開情報だけのスクリプト方策、`inference` はchecksum照合した公開Pro ONNXをCPUExecutionProviderで直接使用、`scratch-update` は既存チェックポイントを読み込まず新規DQNとreplayをメモリ内で作り、各hand後に最大1回更新して終了時に破棄する。最後の方式は**学習計算の代理測定**であり、既存Ironの学習再開ではない。学習・候補ONNX書き出し・registry変更・本番配備はしていない。

各handで既存 `badugi-controller-v2-bridge.mjs` の `reset` と `step` を使い、既存の `run_hand` が96スロット観測、6行動mask、合法行動、終局chip差分を検査する。2/3/6席、cash/MTT、4種類の既存script相手を巡回し、hero席を交替する。原本JSONにはcommit、コード・model hash、seed、条件、処理時間、CPU秒、RSS推移、判断数、更新数、終局chip確認数、各hand時間が入る。

実測環境: macOS 26.6.2 arm64、Apple M5 Pro 18 logical CPU、48 GiB RAM、Node 24.18.0、Python 3.11.16、NumPy 2.4.6、PyTorch 2.15.0、ONNX Runtime 1.32.0、psutil 7.2.2。開始時の負荷平均はおおむね2.65。空きディスクは測定開始時約480 GiB。固定ProモデルIDは `model-badugi-pro-controller-v2-20261105`、ONNX SHA256はregistryと一致した `40acfcc089873bb1660227ceae3be808917222e090abd8916b03cc174d92af49`。

## 実測

100 hand × 2 seed × 2 format × 3席数 × 3方式 = 3,600 handのmatrix、6席1,000 hand × 2 seed × 2 format × 3方式 = 12,000 hand、6席cash 5,000 hand × 3方式 = 15,000 handを診断目的で実行した。warmupは各条件の測定前に別途実行。全条件で終局chip差分の合計0。

| 席数 | 対戦のみ 中央値 | Pro直接推論 中央値 | 新規DQN更新込み 中央値 | 備考 |
| --- | ---: | ---: | ---: | --- |
| 2 | 1,057 hand/s | 612 hand/s | 458 hand/s | 100 hand条件4反復の中央値 |
| 3 | 474 hand/s | 389 hand/s | 305 hand/s | 同上 |
| 6 | 230 hand/s | 198 hand/s | 171 hand/s | 同上。短い条件の固定費が大きい |

長めの6席1,000 hand条件4反復と、別seedの6席cash 5,000 hand条件1反復から得た速度範囲を次の表に示す。**6席・単一プロセス・連続稼働が同程度の速度を保つと仮定した線形外挿**である。

| 方式 | 実測 hand/s 範囲 | 100万hand | 500万hand | 1,000万hand | 5,000 handで観測したRSS最大 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 対戦のみ | 267–280 | 0.99–1.04時間 | 4.95–5.21時間 | 9.90–10.41時間 | 428 MiB |
| Pro直接推論 | 224–229 | 1.22–1.24時間 | 6.08–6.21時間 | 12.15–12.41時間 | 438 MiB |
| 新規DQN更新込み | 182–198 | 1.40–1.53時間 | 7.01–7.63時間 | 14.02–15.25時間 | 534 MiB |

1,000 hand条件のCPU消費は経過時間の約1.13–1.18倍のcore秒、5,000 hand条件では約1.06–1.07倍。上記速度は多coreを同時利用した集計値ではない。5,000 handの最初の1,000と最後の1,000の平均hand時間は、対戦3.69→3.57 ms、推論4.48→4.22 ms、更新5.21→5.12 ms。更新込みでは4,994/5,000 handで実際のgradient更新が起きた。

原本は `/Users/koki/Documents/Codex/MGX-RL-Artifacts/mgx-phase0-performance-20261116/` に分離保管した。`mgx-d03-phase0-matrix-20261116.json`（SHA256 `b90abe14f43b320cf5372331d7a0030b2d877127e005000b7a3b67c853e03f06`）、`mgx-d03-phase0-1k-20261116.json`（`f564757ce59b10301013a7f47fe65ef47fdf5a100f255dc3432ca772f9908f41`）、`mgx-d03-phase0-5k-20261116.json`（`41e3d4adf88f035291fb6ba80013d6447ca14c7702ff4f6d89295381df384d3e`）。計算結果の再集計には原本の `groups[*].handsPerSecond`、`rssAtHandMiB`、`scratchUpdates` を使用できる。大きな生データをPR差分に含めず、ハッシュと再実行コマンドで照合する。

### 外挿の限界

- Pro直接推論は公開ONNXの単一方策を測り、公開アプリのseat/mode別アンサンブル、browser/worker起動、通信、タイムアウト、fallbackを含まない。強度・本番体感遅延の証拠ではない。
- 新規DQN更新込みは通常trainerの模擬負荷。チェックポイントI/O、模倣学習、複数更新、定期独立評価、ONNX export、候補選択、可視化は含まない。したがって実Iron実験の総時間の見積もりとして直接採用しない。
- `run_hand` は終局差分合計と合法maskを検査するが、各遷移のstack＋pot＋commit ledger、side pot、cash再購入の完全監査ではない。公開QAの画面スナップショットもこの証明を代替しない。
- RSSは親Pythonと子Nodeのresident setの合算標本で、共有ページを重複計上しうる。100 ms標本は一時的なpeakを見逃しうる。5,000 handは約18–26秒であり、熱、スワップ、メモリ成長、再開耐性を数時間スケールで評価していない。
- 100 hand条件のseed/format差と1,000/5,000 handの速度幅はCIでも予測区間でもない。50%の稼働率を伴う暫定計算枠を確保し、次段階で実trainerと長時間soakから修正する。

## 既存資産と不足

| 領域 | 現行の実体 | 残るギャップ |
| --- | --- | --- |
| Badugi実controller | 96入力/6出力のv2 bridge、合法mask、2/3/6席cash/MTT、terminal chip検査、反復対局 | 全遷移ledgerと公開アプリとの契約一致をさらに独立監査する必要がある |
| Pro | 公開registryのv2 Pro ONNXとモード/席別routing。通常公開SHA `dd571b0` | 今回測定した直接ONNX速度は公開routing全体の速度ではない |
| Iron | registryに旧 `badugi_iron_v1.onnx` が `active-practice-gated` として残る。別のH17b候補は隔離・凍結 | 旧Iron登録を新Iron採用と混同しない。H17b人G5原本と独立公開監査がなく、昇格未了。H33b G4の負セル12を保持 |
| 学習 | `train_badugi_controller_v2_draft.py`、DQN/replay、GO manifest、既存評価・監査script | GTO近似基礎層、レンジ事後分布、未知相手holdout、逐次判定の単一契約、自律復旧を未実装/未検証 |
| QA/CI | RL安全test、段階別test、production live nightlyと公開SHA照合、ブラウザ/推論telemetry | 現行mainの定期nightlyは `ubuntu26.04-x64` とPlaywright 1.56.1の不一致で失敗中。修正PR #329は別Draft。今回のPhase 0で統合・配備しない |
| 人間向け学習 | 履歴、coaching preview/telemetry、復習導線の一部 | 判断前後の改善を測る独立基準、レンジ/EVの校正、PC/iPhoneの初見理解と実人間検証は未完 |

公開サイトの本人約50 handは自己申告で、同一ブラウザの履歴JSONが回収可能な設計だが原本未取得。公開通常対局を隔離Ironの人G5に算入しないし、同じhandの再実施を求めない。公開Proは維持する。

## 次の実装順序・見積もり

この表は**一人の開発担当の実装・自己検証日数**の初期レンジであり、独立レビュー、人間採用待ち、障害修復、実機利用可能時間は別。品質ゲートは日数に合わせて変更しない。各段階を小さいPRに分割し、候補モデル・評価原本・本番registryを分離する。

| Phase | 先に作る検証可能な単位 | 工数目安 | Macでの暫定計算枠・退出条件 |
| --- | --- | ---: | --- |
| 1 評価基盤 | 1a 現行CI障害の別PR復旧、1b 全遷移ledger・行動/金額/期限監査、1c 固定ルールの逐次統計判定と偽陽性simulation、1d 未知相手・seed分離manifest | 12–20人日 | 診断/評価を単一CPUジョブで開始。5–10百万handなら対局部分の下限約5–15時間/腕。統計誤判定率とデータ分離を先に実証 |
| 2 Iron戦略 | 2a 自己対戦DQN/CFR系の小規模同条件比較、2b 攻略されにくい基礎層、2c 公開情報だけのレンジ推定と校正、2d 不確実時に基礎へ戻る適応層、2e Pro/二層Iron比較 | 25–45人日 | 初期はCPU・逐次1ジョブ、各実験のhand/時間/RSS/停止条件を凍結。CFR系の全ゲーム解は目標にしない |
| 3 自律改善 | 3a 指標/異常分類、3b 隔離候補の生成・評価・保存、3c bounded retry/rollback、3d 長時間soakと復旧訓練 | 15–25人日 | 未評価候補を公開model/registryへ入れない。48 GiB下でもメモリ上限とcheckpoint先を明示。重大異常は停止・原本保全 |
| 4 独立評価・人の採用判断 | 4a 凍結候補の未使用holdout、4b 負セル/未知相手・人間実戦、4c 独立レビューと同一SHA公開監査の準備 | 10–20人日＋人の時間 | PROMOTEは候補提案まで。G5実人間原本・独立レビュー・人の承認なしにIron採用しない |
| 5 8-Game展開 | 5a 共通評価/ログ/モデル管理interface、5b 2-7 TD→Razz→Stud→Stud8→PLO等をゲーム別gateで移植 | ゲームごと8–20人日、全体60–140人日 | Badugi全5難度が完了するまで他種目Standardの新規学習/昇格を先行しない。FLO8対象、B06除外。S01 v2 draw-engine汚染停止 |

上記の時間は対局kernelの実測下限を基にした予算。例えば6席1,000万handの更新込みは約14–15時間/腕を観測速度から外挿するが、探索や保存を含む実研究サイクルには**少なくとも2倍の暫定枠**を割り当て、次の実trainer測定で修正する。学習/評価を並列化する場合は独立seedと機械負荷を分けて再測定し、速度が線形に伸びると仮定しない。

## 評価制度の提案（採用前に固定）

- 主指標はBadugiの固定リミット**big bet/100 hand**に統一。既存G4のBB/hand表記は当該コードが何を分母にしたか監査し、big blindとbig betを明示的に区別する。cash/MTTを分け、全体は事前固定の重みで報告する。
- 各20 hand程度の独立sessionを推定単位にし、席/形式/相手タイプを層化。共通配牌・席交換は分散低減の候補だが、行動後にtrajectoryが分かれたhandを因果ペアとして扱わない。
- 探索・選択に使った相手/seedを凍結holdoutへ再使用しない。H33bで使ったseedを新候補holdoutに使わない。未知の戦略と負セルを含める。
- 逐次評価は有限の予定lookとα消費、または時間一様の信頼系列を事前に選ぶ。主要改善幅・副指標の安全下限・上限hand/費用・PROMOTE/REJECT/CONTINUEを評価前に凍結する。シミュレーションで偽陽性率を検査する。閾値の数値は既存分布とシミュレーションを見て提案し、人による制度変更判断を経る。
- PROMOTEでも公開採用ではない。人G5原本・独立レビュー・同一SHA公開監査・Company OS P2 Human Gateを別に満たす。

## Phase 0の検証結果と未了

完了: 実controller測定器、依存固定、3方式/全席/両形式/複数seedの原本、6席1,000/5,000 handの安全診断、現行コード・モデル・CI・公開SHAの照合。未検証: 実Iron trainerの速度、数時間/数百万handの安定性、全遷移chip ledger、公開routingの端末別遅延、Iron戦略強度、統計的昇格、人G5。未着手: 本番採用・デプロイ・他種目学習。
