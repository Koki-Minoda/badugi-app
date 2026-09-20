# TapliMIX 111種目 × MGX 対応表

2026-09-20 / TapliMIX v1.6.2.2 / MGX a44479e。根拠：[Tapliカタログ](https://taplimix.app/games)、[MGX定義](mgx-variants.json)、[公開状態・実装根拠](SOURCES.md#m01)。

これは対応する実装の索引であり、全ルール一致の認証ではありません。「公開・主要仕様対応」でも交換上限・端数・特殊ルールの全面比較は未完です。全111種をプレイした結果ではありません。MGXの公開種目は25、previewは12。111から37を引いた74をそのまま不足種目数とはしません。

| 判定 | 件数 |
|---|---:|
| 公開・主要仕様対応 | 19 |
| 近縁実装あり・仕様差 | 24 |
| preview・主要仕様対応 | 4 |
| 該当実装なし | 58 |
| 同一性要照合 | 6 |

P0/P1は先に是正・公開品質を整える対象。P2は追加候補、P3は保留。ソルバーは不要ですが、合法手、評価、秘匿、資金保存、履歴再生、CPU、モバイルの検証が必要です。

## FLOP（41）

| ID | Tapli種目 / 形式 | MGX対応候補 | 判定 | 優先 | 不足・確認事項 |
|---|---|---|---|---|---|
| V001 | No Limit Hold'em / NL | B01 NL Hold'em | 公開・主要仕様対応 | 維持 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V002 | Pot Limit Hold'em / PL | B01 NL Hold'em | 近縁実装あり・仕様差 | P2 | NLH基盤はあるがPLの合法上限が別 |
| V003 | Fixed Limit Hold'em / FL | B02 FL Hold'em | preview・主要仕様対応 | P1 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V004 | NL Super Hold'em / NL | B03 NL Super Hold'em | preview・主要仕様対応 | P2 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V005 | FL Super Hold'em Hi/Lo / FL | B04 FL Super Hold'em | 近縁実装あり・仕様差 | P2 | MGXはHighのみ。Hi/Lo8の評価軸が不足 |
| V006 | NL Pineapple Hold'em / NL | — | 該当実装なし | P2 | 追加候補。既存評価器/進行の再利用可否を先に調べ、実際の要望を確認して採用。 |
| V007 | NL Crazy Pineapple Hold'em / NL | — | 該当実装なし | P2 | 追加候補。既存評価器/進行の再利用可否を先に調べ、実際の要望を確認して採用。 |
| V008 | NL Watermelon Hold'em / NL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V009 | NL Hold'em 2nd Best / NL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V010 | Pot Limit Omaha / PL | B05 Pot-Limit Omaha | 公開・主要仕様対応 | 維持 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V011 | PLO Lazy Rivers / PL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V012 | PLO Double Boards / PL | — | 該当実装なし | P2 | 追加候補。既存評価器/進行の再利用可否を先に調べ、実際の要望を確認して採用。 |
| V013 | PLO Double Boards Bombpot / PL | — | 該当実装なし | P2 | 追加候補。既存評価器/進行の再利用可否を先に調べ、実際の要望を確認して採用。 |
| V014 | Pot Limit Omaha 8 or Better / PL | B06 PLO8 | 公開・主要仕様対応 | 維持 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V015 | PL Omaha Hi/Lo Regular / PL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V016 | PLO8 Double Boards / PL | — | 該当実装なし | P2 | 追加候補。既存評価器/進行の再利用可否を先に調べ、実際の要望を確認して採用。 |
| V017 | Fixed Limit Omaha High / FL | B05 Pot-Limit Omaha | 近縁実装あり・仕様差 | P2 | PLOはあるがFL Highの独立種がない |
| V018 | Double Board Omaha Hi/Hi / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V019 | Double Board Omaha 5 Hi/Hi / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V020 | Fixed Limit Omaha 8 or Better / FL | B09 FLO8 | 公開・主要仕様対応 | 維持 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V021 | Double Board Omaha Best/Best / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V022 | Double Board Omaha 5 Best/Best / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V023 | PLO5 (5-Card Pot Limit Omaha) / PL | B08 5-Card PLO | 公開・主要仕様対応 | 維持 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V024 | PLO5 Double Boards / PL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V025 | PLO 5-Card Double Boards Bombpot / PL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V026 | Big-O (5-Card PLO Hi/Lo) / PL | B07 Big-O | 公開・主要仕様対応 | 維持 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V027 | FL Big-O / FL | B07 Big-O | 近縁実装あり・仕様差 | P3 | Big-OはPL。FLは別種 |
| V028 | FL Big-O Ocean / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V029 | Ultimate Big-O / PL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V030 | Big-O Lazy River / PL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V031 | Sick-O / PL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V032 | PL Courchevel Hi/Lo / PL | — | 該当実装なし | P2 | 追加候補。既存評価器/進行の再利用可否を先に調べ、実際の要望を確認して採用。 |
| V033 | PL Courchevel Hi / PL | — | 該当実装なし | P2 | 追加候補。既存評価器/進行の再利用可否を先に調べ、実際の要望を確認して採用。 |
| V034 | PL Cincinnati Hi/Lo / PL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V035 | PL Stairway to Seven / PL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V036 | PL Stairway to Seven Hi/Lo / PL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V037 | PL Fusion / PL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V038 | PLO 6-Card / PL | — | 該当実装なし | P2 | 追加候補。既存評価器/進行の再利用可否を先に調べ、実際の要望を確認して採用。 |
| V039 | No Limit Hold'em ShortDeck / NL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V040 | Pot Limit Omaha ShortDeck / PL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V041 | No Limit Joker Hold'em / NL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |

## STUD（19）

| ID | Tapli種目 / 形式 | MGX対応候補 | 判定 | 優先 | 不足・確認事項 |
|---|---|---|---|---|---|
| V042 | 7 Card Stud / FL | ST1 Stud | 公開・主要仕様対応 | 維持 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V043 | Stud 8 or Better / FL | ST2 Stud 8 | 公開・主要仕様対応 | 維持 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V044 | Stud Hi/Lo Regular / FL | — | 該当実装なし | P2 | 追加候補。既存評価器/進行の再利用可否を先に調べ、実際の要望を確認して採用。 |
| V045 | Super Stud Hi/Lo Regular / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V046 | NL 7 Card Stud / NL | ST1 Stud | 近縁実装あり・仕様差 | P3 | StudはFL。NL特有のレイズ/街進行を検証する必要 |
| V047 | NL 7 Card Stud 8 or Better / NL | ST2 Stud 8 | 近縁実装あり・仕様差 | P3 | Stud8はFL。NL+splitを独立検証する必要 |
| V048 | Kentrel / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V049 | Razz / FL | ST3 Razz | 公開・主要仕様対応 | 維持 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V050 | Super Stud 8 / FL | — | 該当実装なし | P2 | 追加候補。既存評価器/進行の再利用可否を先に調べ、実際の要望を確認して採用。 |
| V051 | Super Stud / FL | — | 該当実装なし | P2 | 追加候補。既存評価器/進行の再利用可否を先に調べ、実際の要望を確認して採用。 |
| V052 | Super Razz / FL | — | 該当実装なし | P2 | 追加候補。既存評価器/進行の再利用可否を先に調べ、実際の要望を確認して採用。 |
| V053 | Razzdugi / FL | ST4 Razzdugi | 公開・主要仕様対応 | 維持 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V054 | Super Razzdugi / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V055 | 2-7 Razz / FL | ST6 2-7 Razz | 公開・主要仕様対応 | 維持 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V056 | Super 2-7 Razz / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V057 | 2-7 Razzdugi / FL | ST5 Razzducey | 同一性要照合 | P2 | 名称が異なる。2-7とBadugi軸は対応候補だがBadugi側のA/低役規則を要照合 |
| V058 | Super 2-7 Razzdugi / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V059 | Action Razz / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V060 | Action Razz 2-7 / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |

## DRAW（30）

| ID | Tapli種目 / 形式 | MGX対応候補 | 判定 | 優先 | 不足・確認事項 |
|---|---|---|---|---|---|
| V061 | Fixed Limit 2-7 Triple Draw / FL | D01 2-7 Triple Draw | 公開・主要仕様対応 | 維持 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V062 | Pot Limit 2-7 Triple Draw / PL | D01 2-7 Triple Draw | 近縁実装あり・仕様差 | P2 | 評価器は再利用候補だがPL上限の実装が必要 |
| V063 | Pot Limit 2-7 Double Draw / PL | D01 2-7 Triple Draw | 近縁実装あり・仕様差 | P3 | PL化と2回ドローへの進行変更が必要 |
| V064 | No Limit 2-7 Single Draw / NL | S01 2-7 Single Draw | 近縁実装あり・仕様差 | P0 | MGXはFL。NLとはベット上限/再開権が異なる |
| V065 | Fixed Limit A-5 Triple Draw / FL | D02 A-5 Triple Draw | 公開・主要仕様対応 | 維持 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V066 | NL A-5 Single Draw / NL | S02 A-5 Single Draw | 近縁実装あり・仕様差 | P2 | MGXはFL。NL版を別に追加/定義する必要 |
| V067 | Badugi / FL | D03 Badugi | 公開・主要仕様対応 | 維持 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V068 | Pot Limit Badugi / PL | D03 Badugi | 近縁実装あり・仕様差 | P2 | 評価器は再利用候補だがPL上限の実装が必要 |
| V069 | PL Badugi Double Draw / PL | D03 Badugi | 近縁実装あり・仕様差 | P3 | PL化と2回ドローへの進行変更が必要 |
| V070 | NL Badugi Single Draw / NL | S04 Badugi SD | 近縁実装あり・仕様差 | P2 | MGXはFLかつpreview。NL版ではない |
| V071 | Badacey / FL | D05 Badacey TD | preview・主要仕様対応 | P1 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V072 | NL Badacey Single Draw / NL | S06 Badacey SD | 近縁実装あり・仕様差 | P3 | MGXはFLかつpreview。NL版ではない |
| V073 | Badeucey / FL | D04 Badeucey TD | preview・主要仕様対応 | P1 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V074 | NL Badeucey Single Draw / NL | S05 Badeucey SD | 近縁実装あり・仕様差 | P3 | MGXはFLかつpreview。NL版ではない |
| V075 | Hi-dugi / FL | D06 Hidugi TD | 同一性要照合 | P1 | high BadugiのA/同点/4枚未満の強弱をルール詳細で照合。MGXはpreview |
| V076 | Badugi Hi/Lo / FL | — | 該当実装なし | P2 | 追加候補。既存評価器/進行の再利用可否を先に調べ、実際の要望を確認して採用。 |
| V077 | Archie / FL | D07 Archie TD | 近縁実装あり・仕様差 | P0 | MGXは任意の1ペア以上。TapliのHigh条件は99以上。公開前に採用ルールと表示を合わせる |
| V078 | NL Archie Single Draw / NL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V079 | Ari / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V080 | NL 6-Card Archie Single Draw / NL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V081 | FL 5-Card Triple Draw High / FL | S03 5-Card Single Draw | 近縁実装あり・仕様差 | P2 | High評価の土台はあるがドロー回数と公開品質が不足 |
| V082 | PL 5-Card Double Draw High / PL | S03 5-Card Single Draw | 近縁実装あり・仕様差 | P3 | PL化と2回ドロー、公開品質が必要 |
| V083 | NL 5-Card Single Draw High / NL | S03 5-Card Single Draw | 近縁実装あり・仕様差 | P2 | MGXはFLかつpreview。NL版ではない |
| V084 | FL 49/0 Triple Draw / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V085 | 素dugi / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V086 | Ba合成 / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V087 | 826 (basil) / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V088 | No Limit 826 Single Draw / NL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V089 | Pot Limit 826 Triple Draw / PL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V090 | Triple Seven / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |

## HYBRID（21）

| ID | Tapli種目 / 形式 | MGX対応候補 | 判定 | 優先 | 不足・確認事項 |
|---|---|---|---|---|---|
| V091 | Dramaha Hi / FL | H01 Dramaha Hi | 公開・主要仕様対応 | 維持 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V092 | Dramaha 2-7 / FL | H02 Dramaha 2-7 | 公開・主要仕様対応 | 維持 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V093 | Dramaha A-5 / FL | H03 Dramaha A-5 | 公開・主要仕様対応 | 維持 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V094 | Dramadugi / FL | H06 Dramaha Badugi | 公開・主要仕様対応 | 維持 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 MGX名はDramaha Badugi。最大交換枚数の差は追加照合対象。 |
| V095 | Dramaha Badugi-Hi / FL | H05 Dramaha Hidugi | 同一性要照合 | P2 | TapliはHi-dugiと別項目。H05で両方対応済みとは数えない |
| V096 | Dramaha 49 / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V097 | Dramaha 0 / FL | H04 Dramaha Zero | 公開・主要仕様対応 | 維持 | 名称/評価軸/ベット形式が対応。細則と全局面の同一性までは未検証。 |
| V098 | Dramaha Hi-dugi / FL | H05 Dramaha Hidugi | 同一性要照合 | P2 | MGX high Badugiと同名候補。評価規則と最大交換3枚を照合 |
| V099 | Dramaha Prime / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V100 | Dramaha Not-Prime / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V101 | Dramaha Wild / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V102 | PL Dramaha Hi / PL | H01 Dramaha Hi | 近縁実装あり・仕様差 | P2 | MGXはFL、PL版の別検証が必要 |
| V103 | PL Dramaha 2-7 / PL | H02 Dramaha 2-7 | 近縁実装あり・仕様差 | P2 | MGXはFL、PL版の別検証が必要 |
| V104 | PL Dramaha A-5 / PL | H03 Dramaha A-5 | 近縁実装あり・仕様差 | P3 | MGXはFL、PL版の別検証が必要 |
| V105 | PL Dramadugi / PL | H06 Dramaha Badugi | 近縁実装あり・仕様差 | P3 | MGXはFL、PLと交換上限の照合が必要 |
| V106 | PL Dramaha Badugi-Hi / PL | H05 Dramaha Hidugi | 同一性要照合 | P2 | H05との同一性不明かつPL。名称だけで対応済みにしない |
| V107 | PL Dramaha 49 / PL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V108 | PL Dramaha 0 / PL | H04 Dramaha Zero | 近縁実装あり・仕様差 | P3 | MGXはFL、PL版の別検証が必要 |
| V109 | PL Dramaha Hi-dugi / PL | H05 Dramaha Hidugi | 同一性要照合 | P2 | Hi-dugi定義の照合に加えてPL化が必要 |
| V110 | FL Scarney / FL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |
| V111 | PL Scarney Omaha / PL | — | 該当実装なし | P3 | 需要確認後。既存種目の品質を優先し、専用ルール・UI・再生の実装は保留。 |

## MGX側にあり、Tapliと同じ名前・ルールとして数えていないもの

- Chinese Poker / OFC：MGXでは公開。今回のTapli111種カタログには見当たらない。MGXの独自の価値として維持。
- FL Super Hold’em：MGX B04はHigh。TapliのFL Super Hold’em Hi/Loと混同しない。
- FLのSingle Draw各種：MGXの実装を否定するものではなく、TapliのNL版との違い。標準的な名称・MIX説明と矛盾しないように表示する。
- Hidugi Single Draw：MGX S07はpreview。今回のTapli一覧に同じ項目なし。
- Razzducey：MGX ST5は公開。Tapliの2-7 Razzdugiとの同一性を名称だけで断定しない。

## 追加の順序

1. FLHと既存previewのBadacey/Badeucey/Archie/Hidugiを品質確認して公開。
2. NL 2−7 Single Drawの仕様差を解消し、HORSE/8/10の定義を統一。
3. 需要を聞く候補はPL Badugi、PL 2−7TD、NL A5SD、NL 5CD、Pineapple/Crazy Pineapple、6-card PLO、Double-board Omaha、Super Stud群。小さな設定変更で済むとは見積もらない。
4. 独自の素数/合成数/数値和/ジョーカー/Scarney系の大量追加は保留。ルールの権利や命名を含め独自に仕様を確定し、コード・画像・文章はコピーしない。
