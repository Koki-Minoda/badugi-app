# Draw Lowball RL 仕様書
# 2-7 Triple Draw / A-5 Triple Draw / Single Draw CPU AI

更新日: 2026-06-01  
対象バリアント: D01（2-7TD）, D02（A-5TD）, S01（2-7SD）, S02（A-5SD）

---

## 1. 概要と位置づけ

Draw Lowball 系 CPU は DQN（Deep Q-Network）ベースの RL エージェントであり、
フロントエンドの ONNX ランタイムで推論する。

学習環境は Python（Gymnasium）、推論は JavaScript（onnxruntime-web）で行う。

```
Python（学習）
  DrawLowballEnv / DualAgentDrawLowballEnv
      ↓ train_selfplay_draw_dqn.py
  DQNAgent（PyTorch）
      ↓ export_draw_dqn_onnx.py
  ONNX（public/models/*.onnx）
      ↓ onnxPolicyAdapter.js
JavaScript（推論）
  DeuceToSevenTripleDrawController.getCpuActionAsync()
```

---

## 2. 観測ベクトル仕様（96次元）

### 2.1 現行仕様（v1）

| スロット | 内容 | 値域 | 備考 |
|---------|------|------|------|
| 0 | draw_round / max_draws | 0.0〜1.0 | ドロー進行度 |
| 1 | phase==BET | 0 or 1 | |
| 2 | phase==DRAW | 0 or 1 | |
| 3 | pot_odds | 0.0〜1.0 | to_call / (pot + to_call) |
| 4 | pot / 100 | 0.0〜1.0 | |
| 5 | hero_is_button | 0 or 1 | **二値のみ。多人数での位置情報不足 ⚠** |
| 6 | is_final_street | 0 or 1 | 最終ドロー後BETラウンド |
| 7 | opp_last_draw_count / 5 | 0.0〜1.0 | 直前ドロー枚数 |
| 8 | opponent.bluff_frequency | 0.0〜1.0 | 相手プロファイル |
| 9 | opponent.open_strength | 0.0〜1.0 | 相手プロファイル |
| 10 | opponent.call_strength | 0.0〜1.0 | 相手プロファイル |
| 11 | opponent.raise_strength | 0.0〜1.0 | 相手プロファイル |
| 12 | draws_remaining / max_draws | 0.0〜1.0 | |
| 13 | opp_draw_history[R1] / 5 | 0.0〜1.0 | ラウンド別ドロー履歴 |
| 14 | opp_draw_history[R2] / 5 | 0.0〜1.0 | |
| 15 | made_cards / 5 | 0.0〜1.0 | ユニークランク数（現在の手） |
| 16 | highest_rank / 14 | 0.0〜1.0 | 最高ランク |
| 17 | rank_sum / 70 | 0.0〜1.0 | ランク合計 |
| 18 | duplicate_ranks / 4 | 0.0〜1.0 | 重複ランク数 |
| 19 | duplicate_suits / 4 | 0.0〜1.0 | 重複スーツ数 |
| 20 | is_straight | 0 or 1 | 2-7のみペナルティ |
| 21 | is_flush | 0 or 1 | 2-7のみペナルティ |
| 22 | hand_strength | 0.0〜1.0 | 現在の手役強度 |
| 23 | opp_draw_history[R3] / 5 | 0.0〜1.0 | |
| 24 | opp_total_draws / 15 | 0.0〜1.0 | 累計ドロー枚数 |
| 25 | current_bet / 20 | 0.0〜1.0 | |
| 26 | raise_count / 4 | 0.0〜1.0 | このラウンドのレイズ回数 |
| 27 | opp_is_pat | 0 or 1 | 相手がドロー0か |
| 28 | opp_opened_current_round | 0 or 1 | 相手が今ラウンドBET/RAISEしたか |
| 29 | opp_bet_history[R1] | 0 or 1 | |
| 30 | opp_bet_history[R2] | 0 or 1 | |
| 31 | draw_adjusted_strength | 0.0〜1.0 | ドロー予定カードを除いた手の強度 **⚠ 重複カードのケースに欠陥あり** |
| 32 | planned_draw_count / 5 | 0.0〜1.0 | 予定ドロー枚数 |
| 33〜39 | **(未使用 → v2 で追加予定)** | — | 下記 §2.2 参照 |
| 40 | 0.0（未使用） | — | |
| 41 | family==low-27 | 0 or 1 | バリアントフラグ |
| 42 | family==low-a5 | 0 or 1 | |
| 43〜47 | **(未使用 → v2 で追加予定)** | — | |
| 48〜58 | legal_action_mask | 0 or 1 | 11アクション分 |
| 59〜95 | **(未使用)** | — | 将来拡張用 |

### 2.2 未実装の既知欠陥

#### 欠陥A: draw_adjusted_strength の重複カードバグ

`_draw_adjusted_strength` は「ランク10以上のカード」だけを破棄対象として扱う。
重複カード（ペア、トリップス）を捨てるケースを考慮しないため、値が不正確になる。

**具体例 (2-7TD)**:

| ハンド | draw_adjusted_str (現行) | 正しい評価 |
|-------|------------------------|----------|
| 2,2,2,3,7 | 0.626（raw strengthそのまま） | 0.910×0.75≈**0.68**（2,3,7を残してdraw2） |
| 2,5,8,9,10 | 0.272 | 0.272（概ね正しい） |

現行モデルは方向性は合っているが根拠が誤っている。
ドロー後のターゲットハンド強度（`kept_strength`）が使われていない。

#### 欠陥B: 進展性（improvability）の評価軸不在

Draw ゲームにおいて手の価値は「今の強さ」より「ドロー後に到達できる最終強度」で決まる。
現行ベクトルにはこの軸がない。

**問題を示す例**:
- `2,2,2,3,7`: 今は弱いが、2枚ドローで7-low以下に到達できる可能性が非常に高い
- ブロッカーとしても強力（2が3枚 = 相手がナッツ（2-x-x-x-x）を作れない）
- `2,5,8,9,10`: 今はやや強く見えるが、1枚ドローしても`2,5,8,9,x`止まりのリスク大

#### 欠陥C: プレイヤー数・位置情報の欠如

現在のモデルはヘッズアップ専用環境で学習されており、
プレイヤー数や詳細な位置情報が観測に含まれていない。

**症状**: UTGオープンに対してHUレンジで乗ってくる
（後ろのプレイヤー数を認識できないため）

---

## 3. v2 観測ベクトル拡張仕様（計画中）

### 3.1 追加フィーチャー（slots 33〜39）

| スロット | 名前 | 計算式 | 意図 |
|---------|------|--------|------|
| 33 | active_players | active_players / 6.0 | テーブル人数（HU=0.33, 4max=0.67, 6max=1.0） |
| 34 | position_index | position / max(1, active_players-1) | UTG=0.0 〜 BTN=1.0 の連続値 |
| 35 | players_yet_to_act | players_behind / max(1, active_players-1) | 後ろに何人残っているか |
| 36 | draw_target_strength | kept_eval.strength × draw_discount | **ドロー後ターゲットハンド強度（最重要）** |
| 37 | draw_target_high_rank | kept_eval.highest_rank / 14.0 | ドロー先の最高ランク（低いほど良） |
| 38 | premium_card_count | count(rank ≤ 7 in 2-7, or A/2-5 in A-5) / 5.0 | 低ランクプレミアムカード枚数 |
| 39 | deuce_blocker | count(rank==2) / 4.0 (2-7) / ace_count / 4.0 (A-5) | ナッツブロッカー枚数 |

**draw_discount の計算**:
```python
draw_discount = max(0.40, 1.0 - len(discards) * 0.12)
# draw0（パット）: 1.00
# draw1: 0.88
# draw2: 0.76
# draw3: 0.64
# draw4: 0.52
# draw5: 0.40
```

### 3.2 vector[31] の修正

現行の `_draw_adjusted_strength` を廃止し、
`discard_indexes_for_family` ベースの正しい計算に置き換える。

```python
# 修正後
discards = discard_indexes_for_family(hand, family)
kept = [c for i, c in enumerate(hand) if i not in discards]
if kept:
    kept_feat = evaluate_lowball(kept, family)
    draw_discount = max(0.40, 1.0 - len(discards) * 0.12)
    vector[31] = kept_feat.strength * draw_discount
else:
    vector[31] = 0.0
```

### 3.3 位置インデックスの計算方針（多人数対応）

```
4人テーブル（実戦最大の想定）:
  UTG  (0番): position_index = 0 / 3 = 0.00
  HJ   (1番): position_index = 1 / 3 = 0.33
  CO   (2番): position_index = 2 / 3 = 0.67
  BTN  (3番): position_index = 3 / 3 = 1.00
```

---

## 4. 多人数対応の設計方針

### 4.1 実戦における人数分布

2-7 Triple Draw / A-5 Triple Draw の実戦における実態：

| テーブル人数 | 戦略的意味 | 実装優先度 |
|------------|-----------|----------|
| 2人（HU） | 超広レンジ、ブラフ高頻度 | ✅ 実装済み（warm-start源） |
| 3人 | レンジ締まり始める | **高** |
| **4人** | **実戦最頻。レンジ構成が最も重要** | **最高** |
| 5人 | エッジケース、たまにある | 中 |
| 6人 | **デッキ構造上ほぼ別ゲー** ⚠ 参照 | 低 |

#### ⚠ 6人テーブルがレアな理由（デッキ構造の制約）

ナッツハンド（2-7TD: 7-5-4-3-2, A-5TD: A-2-3-4-5）に必須の「2」は4枚しかない。
6人テーブル × 3ドローラウンドでは理論上 90枚以上必要なのに対しデッキは52枚。
→ 6人では「2を誰が持つか」ゲームに退化し、レンジ戦略の意義が薄れる。
→ **実装目標は4人テーブルを完成形とし、6人は低優先とする。**

### 4.2 カリキュラム学習計画（CPU前提）

| フェーズ | 人数 | エピソード | 推定時間（CPU） |
|---------|-----|-----------|--------------|
| 1（済） | HU（2人） | 20k | ≈4時間 |
| 2 | 3人 warm-start | 50k | ≈10時間 |
| 3 | 4人 warm-start | 100k | ≈20時間 |
| 4 | 2〜4人混合（汎化） | 50k | ≈10時間 |
| **合計** | | **≈220k** | **≈44時間** |

### 4.3 なぜ「切り替え」であって「乗せ直し」ではないか

`active_players` を観測ベクトルに入れることで、
**同一モデルが人数に応じてレンジを切り替える**学習が可能になる。

- 手役評価の基礎（ランク評価、ドロー価値）は人数によらず共通
- 変わるのは「どこで折るか / どこでレイズするか」の閾値
- → HU の学習はPhase1（基礎）として有効。捨てる必要はない

---

## 5. 訓練アーキテクチャ

### 5.1 エージェント構成

| コンポーネント | 実装 |
|-------------|------|
| Q-Network | 96→192→192→11 の MLP（PyTorch） |
| Double DQN | ✅ online net で行動選択、target net で価値推定 |
| Prioritized Experience Replay | ✅ alpha=0.6, beta annealing |
| Behavior Cloning（模倣学習） | ✅ teacher warmup + expert replay ratio |
| Action Margin Update | ✅ fold_margin, call_margin で過剰フォールド防止 |

### 5.2 Self-Play 設計

```
opp_epsilon=0.0（デフォルト）: 純GTO自己対戦
  → oppは常にgreedyで行動 = 最適な自分自身と対戦 = Nash均衡への収束

opp_epsilon=0.05〜0.15（オプション）: ルース/アグレ相当の多様性
  → heroが確率的相手への耐性を学習
  → GTOからは少し外れるが実戦ロバスト性が向上
```

**opponent_update_interval=500エピsoデ**ごとに opponent の重みを hero の最新重みで更新。
古すぎる opponent との対戦は非効率なため、適度に追従させる。

### 5.3 モード崩壊検出

各ログ区間（デフォルト1000エピ）で以下を監視:

| 指標 | 閾値 | 意味 |
|-----|------|------|
| fold% > 55% | ⚠ HIGH-FOLD | 常にフォールドする退化ポリシー |
| raise% < 5% | ⚠ LOW-AGGRESSION | チェック/コールの受動的均衡（passive equilibrium） |

**passive equilibrium について**:
固定制限ポーカーの自己対戦で起きやすい退化。fold%=15%, raise%=1% という
「誰もレイズしない均衡」は上記2つの条件を同時チェックすることで検出できる。
（elif ではなく独立した if を使うこと）

### 5.4 訓練後のデプロイ手順

```bash
# 1. ONNX エクスポート
.venv/bin/python3 src/rl/training/export_draw_dqn_onnx.py \
  --family low-27-selfplay \
  --checkpoint rl/models/draw/low-27_selfplay_dqn_latest.pt

# 2. modelRegistry.json の variantIds を追加
#    "variantIds": [] → ["D01", "S01"]  (2-7TD/SD)
#    "variantIds": [] → ["D02", "S02"]  (A-5TD/SD)

# 3. アセット検証
node scripts/verifyAiModelAssets.mjs

# 4. 評価
.venv/bin/python3 src/rl/training/evaluate_selfplay_draw.py \
  --checkpoint rl/models/draw/low-27_selfplay_dqn_latest.pt \
  --family low-27 --json-out reports/selfplay-eval.json
```

---

## 6. アクション仕様

| インデックス | アクション | BET有効 | DRAW有効 |
|------------|-----------|---------|---------|
| 0 | fold | ✅ | — |
| 1 | check | ✅ | — |
| 2 | call | ✅ | — |
| 3 | bet | ✅ | — |
| 4 | raise | ✅ | — |
| 5 | draw_0（パット） | — | ✅ |
| 6 | draw_1 | — | ✅ |
| 7 | draw_2 | — | ✅ |
| 8 | draw_3 | — | ✅ |
| 9 | draw_4 | — | ✅ |
| 10 | draw_5 | — | ✅ |

---

## 7. 実装状況（2026-06-01現在）

| 項目 | 状態 | 備考 |
|-----|------|------|
| DrawLowballEnv（HU, 単体訓練） | ✅ 完成 | 2-7 / A-5 両対応 |
| DualAgentDrawLowballEnv（HU自己対戦） | ✅ 完成 | opp_epsilon対応 |
| train_selfplay_draw_dqn.py | ✅ 完成 | call_buffer, モード崩壊検出済み |
| evaluate_selfplay_draw.py | ✅ 完成 | 5プロファイル評価 |
| export_draw_dqn_onnx.py | ✅ 完成 | self-play用エントリ追加済み |
| DeuceToSevenTripleDrawController.getCpuActionAsync | ✅ 完成 | ONNX推論+フォールバック |
| ONNX HU self-play（2-7TD / A-5TD） | 🔄 訓練中 | 20k エピソード進行中 |
| v2 観測ベクトル（slots 33-39） | 📋 設計済み | **未実装** |
| 多人数対応環境（3〜4人） | 📋 設計済み | **未実装** |
| 3〜4人カリキュラム訓練 | 📋 設計済み | HU完走後に着手 |

---

## 8. 既知の問題と対応方針

### P1: HU学習モデルの多人数ゲームへの適用（緊急度：高）

**問題**: 現在デプロイ済みの standard/beginner/pro モデルはすべてHU環境で学習。
4人テーブルで UTGオープンに対してHUレンジで乗ってくる。

**原因**: `active_players` / `position_index` が観測ベクトルにない。

**対応**: v2 観測ベクトル実装 → 2〜4人カリキュラム再学習 → ONNX 全tier更新

### P2: draw_adjusted_strength の重複カードバグ（緊急度：中）

**問題**: `2,2,2,3,7` のような重複高価値カードを持つ手で
draw_adjusted_strength の計算根拠が誤っている。

**対応**: v2 実装時に `discard_indexes_for_family` ベースに修正。
現行モデルは方向性は正しいため、v1 を直ちに修正する必要はない。

### P3: ブロッカー・進展性評価の欠如（緊急度：中）

**問題**: `2,2,2,3,7` のブロッカー価値（2が3枚）や
マルチラウンドの改善軌跡が評価されていない。

**対応**: slots 38（premium_card_count）, 39（deuce_blocker）で対処予定。
