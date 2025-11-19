# Spec 14 – Evaluator Architecture (Unified Hand Evaluation System)
(High-hand / Lowball / Badugi / Split-pot / Stud-up-cards / Multi-game対応)

## 1. Purpose

This spec defines the complete unified Evaluator architecture for all 30ゲームに対応する
評価ロジック。  
GameEngine (Spec 09) がゲーム構造を担当するのに対し、Evaluator は各ゲーム固有の
ハンドの強さを計算する純粋関数として分離される。

目的:
- 全ゲームが使える統一 Evaluator API を作る
- High-hand（通常の役）を全ゲーム共通で使用
- Lowball (2-7, A-5), Badugi, Badugi-high, Split-pot, Hi-Lo8 などに対応
- Stud 系の「アップカード情報」を評価の補助に使えるようにする
- Evaluator が GameEngine から独立するため吉（テスト容易）
- 全 Evaluator が Mixed Game (Spec 11) と World Unlock (Spec 12) に無関係に動作

---

## 2. Design Philosophy

Evaluator は **状態を持たず完全関数型**であるべき。  
要求される入力→出力が完全に決まる。

完全分離のメリット:
- Codex による自動生成が安全
- テスト自動化が容易
- 将来の拡張（新ゲーム追加）も Evaluator 追加だけで済む
- UI・GameEngine の再利用性が高い

---

## 3. Unified Evaluator API

全 Evaluator は以下の共通 API を実装する。

evaluate(params):

入力:
- cards: 役判定対象のカード（hole + board + draw後の最終形）
- gameType: ゲームID (Spec 10 参照)
- context (任意): Stud の upcards / Hi-Lo 用の board 情報など
- options:  
  - evaluateHigh: boolean  
  - evaluateLow: boolean  
  - lowType: "27" または "A5" または null  
  - badugi: boolean  
  - badugiHigh: boolean  
  - isSplit: boolean  

出力:
- rankPrimary: 数値（小さいほど強い）
- rankSecondary: 数値（split-pot の場合、2つめ）
- handName: 例) "Straight", "Badugi 3-card", "A-5 Wheel"
- isValid: boolean
- debug (任意): 内部計算詳細、ログ用

Evaluator の返す rankPrimary が最終順位比較に使われる。
split-pot の場合は rankSecondary が利用される。

---

## 4. Evaluator Families

Evaluator を以下のファミリーに分類する。

1) Standard High-hand Evaluator  
2) Lowball Evaluator（2-7 / A-5）  
3) Badugi Evaluator（Low / High）  
4) Split-pot Evaluator（Hi-Lo8, Badeucey, Badacey, Razzdugi, etc.）  
5) Stud Evaluator（upcard を条件に含めるが、基本は High/Low/Badugi 系と共通）  
6) Hybrid Evaluator（Dramaha 系）

---

## 5. High-hand Evaluator (Standard Poker)

対象ゲーム:
- NLH / FLH
- PLO / PLO8 の high 部分
- Dramaha high 部分
- Stud high
- 5-card draw high

役判定:
- Royal Flush
- Straight Flush
- Four of a Kind
- Full House
- Flush
- Straight
- Three of a Kind
- Two Pair
- One Pair
- High Card

仕様:
- 全ゲームで同じ評価関数を使用
- 「5枚の最強役」を返す
- Input が 6枚以上ある場合は、5枚コンビネーション全探索
- Omaha 系は「hole2 + board3」の制約が GameEngine 側でカード候補を制限する

---

## 6. Lowball Evaluator

Lowball 評価対象ゲーム:
- 2-7 Triple Draw
- 2-7 Single Draw
- A-5 Triple Draw
- A-5 Single Draw
- Razz (A-5 Low)
- Razzducey (A-5 Low + 2-7 Low)
- Dramaha 2-7 / A-5
- Big O の low8 (Hi-Lo8) の low

共通仕様:
- rankPrimary の比較は「小さいほど強い」
- ペアは弱い（2-7, A-5）
- ストレート/フラッシュ扱いが異なる

低ハンドの扱い:

(1) 2-7 Lowball  
- A は常に high  
- ストレート/フラッシュは「弱い」  
  例: A2345（Wheel）は最弱ではなく A-high ストレート

(2) A-5 Lowball  
- A は low  
- ストレート/フラッシュは無視（A-5 wheel が最強）  

---

## 7. Badugi Evaluator (Low and High)

対象ゲーム:
- Badugi (Triple Draw)
- Badugi Single Draw
- Badeucey / Badacey の Badugi 部分
- Hidugi (Badugi High)
- Dramaha Badugi / Hidugi
- Razzdugi の Badugi 部分

共通仕様:
-スート重複禁止  
-ランク重複禁止  
-4枚揃わなければ 3-card, 2-card, 1-card へ降格  
-ランク比較は A 低 (A=1) のローバリュー  
-High Badugi は比較を逆転（rankPrimary 大きいほど強い）

出力:
- rankPrimary  
- handName ("Badugi 4-card", "Badugi 3-card" etc.)

---

## 8. Split-pot Evaluator

対象ゲーム:
- PLO8 の Hi-Lo8
- FLO8
- Badeucey (Badugi + 2-7)
- Badacey (Badugi + A-5)
- Razzdugi (Razz + Badugi)
- Razzducey (Razz + 2-7)

仕様:
- High Evaluator と Low Evaluator を呼び出し、
  rankPrimary = high 部分  
  rankSecondary = low 部分  
- isValid = highValid AND lowValid  
- Low8 では「8 or better」の制約を評価する  
- 両者の rank を独立に返却し、GameEngine で Pot 分割を行う

Split-pot 全体評価:
- 比較は first: rankPrimary  
- tie → compare rankSecondary  

---

## 9. Stud Evaluator

対象ゲーム:
- 7 Card Stud
- Stud 8
- Razz
- Razzdugi
- Razzducey
- 2-7 Razz

Evaluator 部分は High/Low/Badugi のどれかになる。

追加の Stud 特有の要素:
- Upcard 最低/最高で bring-in を決定する
- Evaluator 側は「hand strength」だけ計算し、bring-in ロジックは GameEngine が担当

Evaluator 要件:
- 7枚中の最強5枚を抽出（High）
- 7枚中の最強 Low を計算（Low）
- 7枚中の最良 Badugi を計算（Badugi 系）

---

## 10. Dramaha Evaluator

対象ゲーム:
- Dramaha Hi
- Dramaha 2-7
- Dramaha A-5
- Dramaha 0（Zero-hand）
- Dramaha Badugi / Hidugi

仕様:
- High 部分は High-hand Evaluator
- Low / Badugi 部分は対応 Evaluator を使用  
- Dramaha 0 は A〜5を0とみなす特殊ルール（カスタム Evaluator が必要）
- 基本は「hole 5枚から draw 後の5枚」を評価。

---

## 11. Registry and Dynamic Loading

全 Evaluator は registry に登録され、GameEngine は gameType から evaluator を取得する。

registry 概念:

- key = game ID (Spec 10 の GID)
- value = evaluator function または evaluatorConfig

GameEngine は:
- 現在の gameType を見て evaluator を呼び出す
- Evaluator の内部で必要な種別の評価（High/Low/Badugi/etc）を auto routing

Mixed Game (Spec 11) と組み合わせることで、ゲームが切り替わっても evaluator は自動切り替わる。

---

## 12. Testing Strategy

Evaluator は純粋関数のため、広範囲の自動テストが可能。

推奨テスト:
1) 5-card 全役テスト（Royal〜HighCard）
2) 2-7 Low（Wheel, Straights, Pairs）
3) A-5 Low（Wheel, Straights無効など）
4) Badugi 4→1 card 変換テスト
5) Split-pot correctness（PLO8, Badeucey, Badacey）
6) 大量ランダムテスト（1万〜10万回で順位が壊れないこと）

Codex nightly に以下を入れておくと良い:
- 「Evaluator ランダムテスト生成」  
- 「Evaluator リファクタリング」  
- 「Evaluator 新仕様対応」  
などのタスク。

---

## 13. Acceptance Criteria

Spec 14が完全とみなされる条件:

1. evaluate(params) の共通 API が確立している。
2. High-hand Evaluator が全ゲーム共通プールとして整備されている。
3. 2-7 / A-5 Lowball Evaluator の挙動が仕様通りである。
4. Badugi Evaluator（Low/High）が正しく 4→3→2→1カード処理を行う。
5. Split-pot Evaluator が high/low 2つの rank を返せる。
6. Razz系 / Stud系の特殊性（7枚中5枚抽出）が評価される。
7. Evaluator registry が動作し、Mixed Game 切り替えに対応。
8. 1000〜10000件のランダムテストで矛盾がゼロである。
9. GameEngine（Spec 09）と完全に独立して動作する。

