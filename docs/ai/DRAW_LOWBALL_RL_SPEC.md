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

## 3. v2 観測ベクトル拡張仕様（設計確定）

本セクションは決断タイミング別の仕様レビュー（2026-06-01）の結果を記録する。
4つの決断タイミング（①初回BET / ②DRAW / ③中盤BET / ④最終BET）それぞれで
「強い人間が見る情報」を洗い出し、26個の新規フィーチャーを確定した。

---

### 3.1 決断タイミング × フィーチャー マトリクス

```
                         ①初回 ②DRAW ③中盤 ④最終
active_players             ✓
hero_position_index        ✓      ✓
original_raiser_pos        ✓
players_yet_to_act         ✓
callers_in_pot             ✓
raises_before_hero         ✓
stack_depth_ratio          ✓
is_big_bet_round           ✓             ✓     ✓
draw_target_strength       ✓      ✓
draw_target_high_rank      ✓      ✓
premium_card_count         ✓      ✓
deuce_blocker              ✓      ✓
hero_draws_first                  ✓
hero_draw_R1                      ✓      ✓
hero_draw_R2                      ✓      ✓
hero_raised_predraw        ✓      ✓      ✓
hero_bet_R1                              ✓
hero_bet_R2                              ✓
street_was_passive_R1                    ✓
street_was_passive_R2                    ✓
opp_draw_trajectory_R1R2          ✓      ✓
opp_draw_trajectory_R2R3                 ✓     ✓
draw_count_differential                  ✓
dead_twos                                       ✓
dead_premium_cards                              ✓
opp_draw_congruence                             ✓
opp_pat_round_count                             ✓
```

---

### 3.2 確定フィーチャー全リスト（27個）

#### グループA: テーブル状況・位置（slots 33〜35, 43〜45）

| スロット | 名前 | 計算式 | 用途 |
|---------|------|--------|------|
| 33 | active_players | active_players / 6.0 | テーブル人数。draw枚数の意味もここで変わる |
| 34 | hero_position_index | hero_pos / max(1, active_players-1) | UTG=0.0 〜 BTN=1.0 |
| 35 | players_yet_to_act | players_behind / max(1, active_players-1) | 後ろ何人→スクイーズリスク |
| 43 | original_raiser_position | raiser_pos / max(1, active_players-1) | UTGレイズ vs BTNスチールの区別 |
| 44 | callers_in_pot | callers_count / max(1, active_players-1) | コール後レイズはバリュー極振り |
| 45 | raises_before_hero | raise_count_before / 4.0 | リレイズ状況 |

```
なぜ callers_in_pot と raises_before_hero が両方必要か:
  callers=2, raises=1（コール2人の後のレイズ）→ バリュー極振り
  callers=0, raises=1（シンプルなオープン）     → 通常レンジ
  モデルが両方の積から学習できる
```

#### グループB: ベッティング構造（slots 46〜47）

| スロット | 名前 | 計算式 | 用途 |
|---------|------|--------|------|
| 46 | stack_depth_ratio | hero_stack / (big_bet × 4 × remaining_rounds) | 残りストリートのコミットメント量 |
| 47 | is_big_bet_round | 1.0 if draw_round >= 2 else 0.0 | スモールベット vs ビッグベット |

```
2-7TD の固定リミット構造:
  Pre-draw / Post-draw1: small bet = 1単位
  Post-draw2 / Final:    big bet  = 2単位（2倍）

is_big_bet_round = 1 の状態で 4-bet = 8単位 = ほぼナッツ宣言
→ モデルがベット強度のスケールを正確に学習するために必要
```

#### グループC: 進展性・ブロッカー（slots 36〜39）

| スロット | 名前 | 計算式 | 用途 |
|---------|------|--------|------|
| 36 | draw_target_strength | kept_eval.strength × draw_discount | **ドロー後ターゲット強度（最重要）** |
| 37 | draw_target_high_rank | kept_eval.highest_rank / 14.0 | ドロー先の形の品質 |
| 38 | premium_card_count | count(rank≤7) / 5.0 ※A-5はA,2,3,4,5 | 低ランクプレミアム枚数 |
| 39 | deuce_blocker | count(rank==2) / 4.0 ※A-5はace_count | ナッツブロッカー枚数 |

```python
# draw_discount: ドロー枚数に応じた改善期待値の割引率
draw_discount = max(0.40, 1.0 - len(discards) * 0.12)
# draw0（パット）: 1.00    draw3: 0.64
# draw1:           0.88    draw4: 0.52
# draw2:           0.76    draw5: 0.40

# 具体例 2,2,2,3,7（2-7TD）:
# kept=[2,3,7], kept_strength=0.910, draw2 → discount=0.76
# draw_target_strength = 0.910 × 0.76 = 0.692  ← 現行の 0.626 より正確

# 具体例 2,5,8,9,10（2-7TD）:
# kept=[2,5,8,9], kept_strength=0.320, draw1 → discount=0.88
# draw_target_strength = 0.320 × 0.88 = 0.282
```

#### グループD: アクション履歴（slots 59〜63）

| スロット | 名前 | 値 | 用途 |
|---------|------|-----|------|
| 59 | hero_raised_predraw | 0 or 1 | hero がプリドローでレイズしたか |
| 60 | hero_bet_R1 | 0 or 1 | R1 BETで hero がBET/RAISEしたか |
| 61 | hero_bet_R2 | 0 or 1 | R2 BETで hero がBET/RAISEしたか |
| 62 | street_was_passive_R1 | 0 or 1 | R1 BETが双方チェックで終わった |
| 63 | street_was_passive_R2 | 0 or 1 | R2 BETが双方チェックで終わった |

```
なぜ hero のアクション履歴が必要か:

  ドンクベット検出:
    R1で hero がレイズ（hero_raised_predraw=1）
    R2で相手がいきなりBET（opp_opened_current_round=1）
    → 「プリドローのレイザーに向かってベット」= ドンクベット
    → hero のアクション履歴がないと ドンクかどうか判定不能

  チェックレイズ検出:
    street_was_passive_R1=1 → その後の R2 BET は「静かな後の爆発」= 強いシグナル

  相手のイメージ管理:
    hero_draw_R1=3, hero_bet_R1=1 → 「3枚引いてベット」= ブラフ or 引けた
    hero_draw_R1=1, hero_bet_R1=1 → 「1枚引いてベット」= 自信のバリュー
```

#### グループE: ドローフェーズ情報（slots 64〜69）

| スロット | 名前 | 計算式 | 用途 |
|---------|------|--------|------|
| 64 | hero_draws_first | 1.0 if OOP else 0.0 | OOPでのパットは最強シグナル |
| 65 | hero_draw_R1 | hero_draw_count_R1 / 5.0 | 自分のR1ドロー枚数（相手が見た情報） |
| 66 | hero_draw_R2 | hero_draw_count_R2 / 5.0 | 自分のR2ドロー枚数 |
| 67 | opp_traj_R1R2 | (opp_draw_R1 - opp_draw_R2) / 5.0 | 相手の改善軌跡（正=改善中） |
| 68 | opp_traj_R2R3 | (opp_draw_R2 - opp_draw_R3) / 5.0 | 相手の最終改善軌跡 |
| 69 | draw_diff_current | (opp_last_draw - hero_last_draw) / 5.0 | 今ラウンドの相対ドロー差 |

```
draw_diff_current の意味:
  +0.6 → 相手 draw3、自分 draw0（パット）→ 自分が圧倒的有利
   0.0 → 同枚数 → 中立（完成してないならベット控える）
  -0.6 → 自分 draw3、相手 draw0       → 相手が有利

「同枚数でベット控える」の学習:
  draw_diff=0.0 + hand_strength 低い → check が最適解
  draw_diff=0.0 + hand_strength 高い（強い形）→ ベット可

OOP パットの強さ:
  hero_draws_first=1（OOP）+ hero_draw_R1=0（パット）
  → 「後ろを見ずに手を守った」= 最強のストレングスシグナル
  → 相手はこの情報を見てドロー枚数を決める
```

#### グループF: デッドカード・最終BET（slots 70〜73）

| スロット | 名前 | 計算式 | 用途 |
|---------|------|--------|------|
| 70 | dead_twos | dead_2s_count / 4.0 | 自分が見た2の枚数（手元+捨て牌） |
| 71 | dead_premium | dead_premium_count / 16.0 | 2,3,4,5（A-5はA,2,3,4,5）のデッド数 |
| 72 | opp_draw_congruence | 1.0 - opp_last_draw / 5.0 | ドロー軌跡とベットの整合性 |
| 73 | opp_pat_rounds | opp_pat_count / max_draws | パットした回数（range floor推定） |

#### グループG: スタック情報（slots 74〜76）

| スロット | 名前 | 計算式 | 用途 |
|---------|------|--------|------|
| 74 | opp_stack_depth | opp_stack / starting_stack | **相手スタック深さ（完全に欠落していた）** |
| 75 | hero_stack_depth | hero_stack / starting_stack | hero の絶対スタック量（slot 46 と補完） |
| 76 | stack_ratio | min(2.0, opp_stack / max(1, hero_stack)) / 2.0 | 相対スタック比（正規化） |

```
opp_stack_depth の意味:
  < 0.30 → ショートスタック
    → ブラフコスト高（失うとアウト）→ パッシブ化が正解
    → ドロー系でレイズ = ほぼバリューのみ
    → hero はコールレンジを広げられる

  > 1.50 → チップリーダー
    → ブラフを仕掛ける余裕あり
    → ドローを広くコールできる
    → hero は bluff-catch に慎重になるべき

stack_ratio の意味（正規化後 0〜1.0）:
  0.25 → 相手は自分の半分 → 自分がスタック有利
  0.50 → 同スタック
  > 0.50 → 相手の方が大きい → スクイーズ・圧力リスク
```

#### グループH: ICM・トーナメント情報（slots 77〜79）

| スロット | 名前 | 計算式 | 用途 |
|---------|------|--------|------|
| 77 | chip_share | hero_stack / max(1, total_chips) | チップシェア（ICM簡易近似） |
| 78 | near_bubble | 1.0 if near_bubble else 0.0 | バブル近傍フラグ |
| 79 | tournament_stage | players_remaining / total_players_started | トーナメント進行度 |

```
ICMと報酬構造の問題:

  キャッシュゲーム: チップ = お金（線形）
    1チップ増 = 常に同じ価値

  トーナメント: チップ = ICM EV（非線形）
    ショートスタック: 1チップ失う = 価値大（存続コスト）
    チップリーダー:   1チップ得る = 価値小（逓減収益）

  ⚠ 重要: ICMを正しく学習させるには観測ベクトルの変更だけでは不十分。
    報酬関数自体をICM-weightedに変更する必要がある。
    → 現在の DrawLowballEnv は cash-game 前提の reward
    → tournament_env を別途設計する必要あり（将来課題）

near_bubble の影響:
  1.0 = フォールドエクイティが激増
    → 相手はバスト回避のためブラフを大幅減少
    → ドロー系の外れベットが激減
    → hero のコールレンジを締めるべき

chip_share の使い方:
  小さい（< 0.10）= 存続プレッシャー高い = タイト化が正解
  大きい（> 0.30）= チップ余裕あり = 積極的に圧力をかけられる
```

```
dead_twos の意味（2-7TD）:
  自分が3枚の2を見た（手元に持っていた or 捨てた）
  → 相手のデッキに2は最大1枚
  → 相手がナッツ（2-x-x-x-x）を持っている確率が激減
  → より広いブラフキャッチレンジが正当化される

opp_draw_congruence の使い方:
  draw3 → 最終ベット: congruence=0.4 → ブラフ警戒
  draw0 → 最終ベット: congruence=1.0 → バリュー寄り
  → ペア（duplicate_ranks > 0, slot 18）でもコールが正当化される条件

opp_pat_rounds の意味:
  R1からパット（opp_pat_rounds=1.0）
    → 最低でも 9-low 以上は確定
    → range floor が上がる = tight なコール判断が必要
  全ラウンドドロー（opp_pat_rounds=0.0）
    → ブラフ頻度高い可能性 = 広いブラフキャッチが正当化
```

---

### 3.3 vector[31] の修正

現行の `_draw_adjusted_strength` は「ランク10以上のカードのみ」を捨て対象として扱うため、
**重複カード（ペア、トリップス）を捨てるケースを計算しない欠陥**がある。

```python
# 修正前（欠陥あり）
bad_indexes = [i for i, (r, _) in enumerate(hand) if _must_discard_rank(r, family)]
# rank>=10 のみ → 2,2,2,3,7 は bad_indexes=[] → raw strength をそのまま返す

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

---

### 3.4 スロット割当の全体図（v2確定版）

```
 0〜32:  既存フィーチャー（一部修正あり）
33〜35:  テーブル状況・位置（active_players, hero_pos, players_behind）
36〜39:  進展性・ブロッカー（draw_target_str, rank, premium, deuce）
40〜42:  バリアントフラグ（既存）
43〜47:  BET構造（raiser_pos, callers, raises, stack_depth, big_bet_flag）
48〜58:  legal action mask（既存, 11スロット）
59〜63:  アクション履歴（hero_raised, hero_bet×2, passive×2）
64〜69:  ドロー情報（draws_first, hero_draw×2, opp_traj×2, draw_diff）
70〜73:  最終BET用（dead_twos, dead_premium, congruence, pat_rounds）
74〜76:  スタック情報（opp_depth, hero_depth, stack_ratio）
77〜79:  ICM・トーナメント（chip_share, near_bubble, tournament_stage）
80〜95:  未使用（将来拡張用, 16スロット）
```

**v1 → v2 の変化:**
- 使用スロット: 32 → 65（+33）
- 未使用スロット: 53 → 16（-37 使用）
- 全モデルの再学習が必要（観測形状は 96 次元のまま変更なし）

**⚠ ICM に関する重要注記:**
ICM 近似値（slot 77〜79）を観測に加えても、報酬関数が cash-game 前提のままでは
正しいトーナメント戦略を学習できない。ICM-weighted reward を持つ
`DrawLowballEnvTournament` の別途設計が必要（将来課題として P4 に記録）。

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
| v2 観測ベクトル（slots 33-79, 33個） | 📋 設計済み | **未実装** |
| 多人数対応環境（3〜4人） | 📋 設計済み | **未実装** |
| 3〜4人カリキュラム訓練 | 📋 設計済み | HU完走後に着手 |
| ICM-weighted reward 環境 | 📋 将来課題 | 報酬関数の再設計が必要 |

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

### P4: スタック情報の完全欠如（緊急度：高）

**問題**: hero_stack も opp_stack も観測ベクトルに含まれていない。
相手がショートスタックかチップリーダーかを一切考慮できない。
トーナメントでは相手スタックに応じてパッシブ化する判断が必要。

**症状**: 相手スタックに依存しないフラットな戦略 → 短スタック相手にブラフを
過剰に信頼、深スタック相手のブラフを過小評価。

**対応**: slots 74〜76（opp_stack_depth, hero_stack_depth, stack_ratio）で対処予定。

### P5: ICM・トーナメント報酬の未対応（緊急度：将来課題）

**問題**: 現在の報酬関数は cash-game 前提（チップ = 線形価値）。
トーナメントでは ICM により同じチップでも価値が異なるが、これを学習できない。

**原因**: 観測ベクトルの問題ではなく、`DrawLowballEnv` の reward 設計が
cash-game 前提であること。

**対応**: ICM-weighted reward を持つ `DrawLowballEnvTournament` の別途設計。
slots 77〜79 はICM近似値として観測に追加するが、正しい学習には報酬関数の
再設計が必要。優先度は P1〜P4 完了後。
