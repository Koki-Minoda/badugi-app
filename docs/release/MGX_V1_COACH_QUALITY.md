# MGX v1 Coach Quality

#295。新しい戦略採点の公開前契約。CPUの強度や学習量を採点の正しさと混同しない。
4候補は `coach-candidates.json`。現在の判定を再生成するには
`node scripts/quality/audit-v1-coach.mjs`。証拠がない項目はすべて保留する。

## 採点範囲

variant、人数、betting、mode、street、action、modelVersion、evaluatorVersionを固定。
N/Aを0点にしない。Overallは認定局面だけで集計しcoverageを示す。
勝った結果から判断を高得点にせず、合法性の検査だけでも戦略を高評価にしない。

## 公開Gate

- 実ゲームとの観測/action/rewardの意味一致。
- 合法手、隠れ情報不使用、未見評価、適合するbaseline。
- 正確なReplay参照、根拠への接続、採点保留、rollback。
- 校正されたconfidenceと独立した人による戦略レビュー。
- 対象局面における重大な誤助言0件。

初期の数値受入案は未見判断200件以上、baselineが許容するaction集合への一致率の95%下限0.95以上、
expected calibration error0.10以下、説明の根拠接続率1.0。単一GTO actionとの一致を要求する意味ではない。
これらは品質研究の入口条件であり、数値だけで最適性を保証しない。独立Reviewerが測定方法と範囲を確認する。
評価結果を見た後にこの閾値を都合よく変更しない。初期案を正式評価へ使う前に測定計画を固定する。

High Confidenceはsolverまたは独立認定された厳密なruleが必要。
Medium Confidenceは対象を限定した検証済み経験的baselineを許容する。
Experimentalは正式Score、Leak断定、Drill自動選定へ入れない。

## 今回の候補判定

BadugiはE11実推論の証拠があるが、#186観測意味と戦略採点の校正・独立reviewが未完。
D01はローカルのValue CalibrationでREADY=NO、Controlled RLも採用候補なし。
HU研究を6maxやTournamentへ一般化しない。#184とPR #283/#284も依存。
NLHとPLOはtraining fixtureの整備だけでは十分でなく、適合するsolver baselineと校正が未確認。
したがって4候補とも今回正式採点を公開しない。

既存preview lessons、session feedback、CPU routerは別の経路であり、この変更で昇格・置換しない。
`evaluateCoachQuality` は新規Score利用者のための前提条件で、まだ全既存画面への接続は行っていない。
次の実装Issueは、認定できる局面datasetとbaselineを固定し、Whyの根拠をレビューできる状態にすること。
理由生成は「結論→何を残し何を失うか→次回の見分け方→Replay」の順にし、根拠にない戦略を補わない。
