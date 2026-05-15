# MGX Pro Tier Definition

Last updated: 2026-05-07

## Role

Pro は最強 AI ではない。  
Pro は「明らかなミスをしない AI」として定義する。

必須条件:

- illegal action を返さない
- 明らかな EV マイナス行動を避ける
- made hand を無意味に壊さない
- draw / pat 判断が常識的
- all-in / short stack で破綻しない
- fold / call / raise 頻度が極端に壊れない
- variant rule を守る
- Standard より安定している

## Inference Priority

```txt
1. Safety guard
2. Pro rule-based overlay
3. ONNX model if valid
4. Standard rule-based
5. deterministic safe fallback
```

固定ルール:

- Pro rule が明らかに正しい場面では RL / ONNX より優先する
- RL / ONNX が legalActions 外を返したら破棄する
- model missing は error にしない
- fallback reason / blocked action / source / confidence を残す

## Step1 Scope

Step1 では以下のみ確定する。

- Major 10 の対象確定
- family 別の Pro strategy contract
- Draw/Badugi の初期 overlay 実装
- Pro tier の安全接続

Step1 では以下をまだやらない。

- 本格 RL 再学習
- Iron / WorldMaster の再設計
- 長時間 self-play
- 人間上位レベルの exploit / GTO claim

