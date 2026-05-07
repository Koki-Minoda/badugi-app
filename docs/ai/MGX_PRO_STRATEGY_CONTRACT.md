# MGX Pro Strategy Contract

Last updated: 2026-05-07

## DRAW / BADUGI

Targets:

- `D03` Badugi
- `D01` 2-7 Triple Draw
- `D02` A-5 Triple Draw
- `S01` 2-7 Single Draw
- `S02` A-5 Single Draw

Minimum rules:

- made strong hand は基本 pat
- 3-card Badugi は基本 1 draw
- trash hand は draw 多め
- duplicate / paired / high card を優先 discard
- drawCount 上限を守る
- final draw 後の弱い hand で過剰 raise しない
- strong pat hand は value bet / raise 候補
- all-in 時は betting action を返さない

## FLOP / HOLDEM

Targets:

- `B01` NLH

Minimum rules:

- preflop trash hand の過剰 call を避ける
- premium hand は raise
- made strong hand は value bet
- weak no pair は過剰 call しない
- draw hand は pot odds が悪ければ fold
- river bluff 頻度を低く制御
- all-in / short stack で極端なミスをしない

Step1 status:

- Contract defined
- Strategy skeleton only

## OMAHA / BIG BET SPLIT

Targets:

- `B05` PLO
- `B06` PLO8

Minimum rules:

- Omaha は hole cards 2 枚使用ルール前提
- connected / suited / high-card coordination を評価
- weak disconnected hand で過剰参加しない
- nut draw を重視
- non-nut draw を過大評価しない
- Hi-Lo では low eligibility を確認
- quartering risk を考慮する

Step1 status:

- Contract defined
- Strategy skeleton only

## STUD / RAZZ

Targets:

- `ST1` Stud
- `ST3` Razz

Minimum rules:

- door card / up cards を見る
- bring-in / complete の最低限判断
- dead cards を考慮する準備をする
- Razz は低い up card を重視
- Stud Hi-Lo contract は Step2 で `ST2` 拡張
- 明らかに負けている board で過剰 call しない

Step1 status:

- Contract defined
- Strategy skeleton only

