# MGX Design Constitution

Version 0.2、2026-11-02。#293の比較とB案実装の設計規則。方向選定と品質合格を区別する。

MGXは静かな競技と、判断を磨く学習を表す。Competitive、Intelligent、Calm、Premium、
High-density、Learning-oriented、Modernを、装飾量より読みやすさと操作の予測可能性で表現する。

## 情報の優先順位

自分のカード→Pot→現在手番→相手stack→可能action→補助情報。
手番到来時は操作欄にも強調を加える。現在の判断に不要な累積情報は展開して読む。
Historyは常設入口から1タップでSheetへ。現在betと最新actionは卓に残す。

## 基礎tokens

| 意味 | 初期値 |
| --- | --- |
| Background / Surface / Table | #0B1114 / #141D21 / #123A32 |
| Text / Secondary | #F2F5F3 / #AAB8B1 |
| Focus and primary / Warning / Error | #79D8AF / #E8B86D / #ED8B85 |
| Spacing | 4 / 8 / 12 / 16 / 24 / 32px |
| Radius | button 8px、sheet/panel 12〜16px、card 5px |
| Typography | system sans、日本語system sans、数字tabular |
| Size | 本文14〜16px、補助12〜13px、Pot24〜28pxを起点 |

Colorは意味を持つ。greenは焦点・操作、amberは注意、redはエラーと破壊操作。
通常Foldを危険色で過剰強調しない。ゲームごとに色の意味を変えない。
contrastは通常文字4.5:1、主要な非文字要素3:1を検証目標にする。
prototypeの微小なcaptionを製品の最小文字サイズの認定に使わない。

## 部品と状態

| 部品 | 規則 |
| --- | --- |
| Button | 通常48px以上、最小tap44px、間隔8px。Fold / Check-Call / Bet-Raiseを固定位置 |
| Card | rankとsuitを優先。交換選択は輪郭＋移動＋枚数。色だけに依存しない |
| Table | matteな単色、細い輪郭。neon、多重shadow、意味のないgradientを避ける |
| Seat | name、stack、現在actionを統一。avatarは補助。Hero位置を維持 |
| Chip | 数字を正本にし、chipの山は補助。BBとchipsの単位を混在させない |
| Current actor | seat輪郭と文言の両方。相手と自分の手番を区別 |
| Action state | Waiting / Turn / Submitting / Settled / Error。二重送信を抑止し受付を表示 |
| Disabled | 判読できる状態を保ち、必要なら理由。別の危険操作へ突然置換しない |
| Active / Selected | activeは現在操作、selectedは交換や予約。輪郭・文言でも区別 |
| Animation | 操作応答120〜180ms、配布180〜300msから検証。演出で合法操作を待たせない |
| Modal | 重要確認・Review。focus、Escape、閉じた後の復帰を統一。重ねない |
| Bottom sheet | 金額・History。safe area、独立scroll、閉じる操作、元の卓へ復帰 |
| Mobile | 下端に主要操作。hover不要。横向きでも順序と意味を維持 |

## 金額と予約

To Call、今回追加する額、Raise to合計を必ず区別する。
NL / PL / FLに合う合法presetを最大3つ常設し、詳細額はSheetへ。
最小raise、stack、cap、Pot Limitの上限はengineに照合する。

Action予約はhand/street/actor/状態版と条件に結び付ける。
Check予約はベットが入ったら取消。Call予約は明示上限を持つ。
次handや金額増加で古い予約を実行しない。予約取消は常設する。

## 6画面

1. Play：現在の判断。Historyと補助情報は展開する。
2. Hand Result：純増減、勝敗理由、Next Hand。詳細Reviewは任意。
3. Hand Review：認定されたScore、Why、Your / Recommended Line。
4. History / Replay：street・action順・金額を追い、該当判断へ直接戻る。
5. Drill：課題1つと回答後のWhy。未検証の問題を生成しない。
6. Growth / Stats：skill推移、判断機会数、評価版。収支とは分ける。

## 比較と採用

[比較画面](prototypes/play-comparison.html)を静的HTTPで開く。製品の対局に接続しない操作デモ。
Aは既存ovalを保つ改善最小案、Bはカードと判断額を近づける選定案、CはReview導線を持つ案。
同じNLH、Stud8、2-7TD局面を使う。prototypeの固定額や履歴は説明用で戦略推奨ではない。

自動検査は `node scripts/quality/check-play-prototype.mjs`。
ローカルでprototypeをport8793へserveしてから実行する。
Chromium/WebKit、390×844・844×390・320×568・1280×900、3案×3ゲームを確認。
横overflowだけでなく、seat・Pot・Heroの重なり、履歴、金額上限、予約取消、交換選択を検査する。
これは比較用webページの検査。製品画面の120分QA・実機・初見評価とは別。

初見評価は5名以上を目安に、手番・Pot・Call額の識別中央値2秒以内、基本操作成功率95%以上、
重大な金額誤解0件を形成的な受入目標とする。未実施の値は掲載しない。
Bの設計根拠は操作の近さと一貫性。独立評価で操作上の問題が見つかれば修正する。

ユーザーはiPhoneで後日確認可能。お願いする操作は、3案の情報識別、NLH金額、Stud公開札、
2-7TD交換、History開閉、予約取消、縦横切替。Androidと協力者の評価は別途未確認。
具体的な手順と未記入の比較表は [iPhone確認シート](MGX_V1_IPHONE_REVIEW.md) を使う。

## B Decision Firstの選定

2026-11-02、ユーザーはAという中間回答を「ごめんBのDecision Firstがいいわ」と訂正し、
続けて「作業進めて」と指示した。最新の選択をBとして記録し、Aを選定結果として扱わない。
Bの操作の近さ・情報のまとまりを軸に実装する。好みの選択から計測秒数や実機合格は推定しない。
物理端末での測定、初見5名、Android確認は引き続き未実施。
最初の実装は #302 の現ハンド履歴Sheet。後続でカード・Pot・手番と操作領域の視覚階層を整える。
