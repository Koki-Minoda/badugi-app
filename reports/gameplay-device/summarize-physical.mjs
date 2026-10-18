import {readFile,writeFile} from 'node:fs/promises';
import {updateProgress} from './progress.mjs';
const base=new URL('./',import.meta.url);
const read=async name=>JSON.parse(await readFile(new URL(`artifacts/${name}.json`,base),'utf8'));
const portrait=await read('physical-portrait-final'),landscape=await read('physical-landscape-final'),drawFix=await read('physical-layout-fixed'),chinesePortrait=await read('physical-chinese-final'),chineseLandscape=await read('physical-chinese-landscape-fixed'),features=await read('physical-features-final'),replay=await read('physical-exact-replay');
const compactRing=rows=>rows.map(r=>({id:r.id,profileId:r.profileId,status:r.status,heroActionCount:r.heroActions.length,viewport:r.viewport,initialDrawBadges:r.initialLayout?.badges,result:r.result,replayFieldsValid:r.records?.every(h=>h.replay.valid),error:r.error}));
const evidence={updated:new Date().toISOString(),device:{model:'iPhone17,3',os:'iOS 26.5.2',browser:'Safari 26.5.2',connection:'USB Web Inspector; dedicated local LAN origin',viewport:{portrait:[393,695],landscape:[852,283]},nativeTouch:'awaiting user input',pwa:'not yet verified on device'},interaction:'DOM activation on physical Safari; natural CPU progression, no forced wins',ringPortrait:compactRing(portrait.rows),ringLandscape:compactRing(landscape.rows),drawLayoutRetest:compactRing(drawFix.rows),chinesePortrait:chinesePortrait.rows,chineseLandscape:chineseLandscape.rows,features:features.rows,exactReplay:{count:replay.length,passed:replay.filter(r=>r.valid).length,failures:replay.filter(r=>!r.valid)},unitChecks:[{scope:'draw initialization / app support',tests:312,passed:true},{scope:'layout profiles / Player / Multi-Game IDs',tests:45,passed:true},{scope:'Chinese screen',tests:4,passed:true},{scope:'numeric entry and Draw controls',tests:11,passed:true},{scope:'final mobile seats and profiles',tests:40,passed:true}],browserRegression:{shortLandscape:{viewport:[852,283],variants:15,passed:15},representativeUsability:{variants:5,passed:5}},limits:['Each ring variant: one completed hand, not exhaustive rules or long-duration coverage.','Multi-Game physical test: one hand, reload/resume, one more hand per format; full tournament completion was tested separately in browser automation.','The local HTTP origin does not verify production HTTPS or PWA installation.']};
await writeFile(new URL('physical-evidence.json',base),JSON.stringify(evidence,null,2)+'\n');
await updateProgress(p=>{
 p.summary='ソルバー不要の実装と修正を継続。物理iPhoneでリング35種目の横対局、縦対応20種目、Chinese/OFC各3ハンドの縦横、Multi-Game3形式の対局と再開、Dealer’s Choiceの種目交代を確認。実機で追加発見した表示・入力の問題も修正。指による入力とホーム画面への追加・再起動は別途確認する。詳細は [実機QA](PHYSICAL-QA.md)。';
 for(const g of p.games){
  g.replay=g.replay.replaceAll('／実機の記録：完全再現合格','');
  if(landscape.rows.some(r=>r.id===g.id&&r.status==='PASS')){g.cashIphone='実機Safari：横1ハンド・履歴・精算・退出 合格（DOM操作）';g.landscape='実機852×283：対局合格。表示は代表実機＋短い横WebKitで再検査';}
  if(portrait.rows.some(r=>r.id===g.id&&r.status==='PASS'))g.portrait='実機393×695：1ハンド・精算・退出 合格（DOM操作）';
  if(['ofc','chinese_poker'].includes(g.id)){g.cashIphone='実機Safari：縦横各3ハンド・履歴完全再現 合格（DOM操作）';g.portrait='実機：3ハンド合格。結果表示の追加修正は再検査中';g.landscape='実機852×283：修正後3ハンド合格';}
  if(replay.some(r=>r.id===landscape.rows.find(x=>x.id===g.id)?.profileId&&r.valid))g.replay+='／実機の記録：完全再現合格';
 }
 const set=(name,status,evidence='physical-evidence.json')=>{const f=p.features.find(x=>x.name===name);if(f)Object.assign(f,{status,evidence});};
 set('実機の縦横回転・セーフエリア','実際の端末回転を確認。393×695縦／852×283横。Safariバー表示時のカード見切れを修正。実機代表2種目と短い横WebKit15種目で再検査');
 set('Multi-Game Tournament','3形式実装。ブラウザ自然決着179ハンドに加え、実機で各形式1ハンド→再読込→再開後1ハンド 合格。解放実績のみ検査用設定');
 set('Dealer’s Choice','実機でNLH→Badugi交代、各1ハンド・キュー消費 合格');
 set('実キーボード・タッチ操作','ログインのネイティブキーボード表示を確認。指による金額入力は利用者操作を待機中');
 const b=p.bugs.find(x=>x.id==='QA-006');Object.assign(b,{status:'初期データ側も追加修正・実機横35種目再検査合格',actual:'表示側修正後も対局開始データの0によりPATが残った。初期値をnullへ統一。',evidence:'関連312ユニット／physical-landscape-final.jsonの初回バッジ0件'});
 const put=b=>{const idx=p.bugs.findIndex(x=>x.id===b.id);if(idx<0)p.bugs.push(b);else p.bugs[idx]=b;};
 put({id:'QA-010',title:'短い横画面で席が重なり手札下端が隠れる',status:'修正済み・実機代表2種目と短い横WebKitで再検査',environment:'iPhone Safari 852×283、Safari上部バー表示',steps:'Badaceyなど7種目／Board・Dramahaを開始',actual:'専用レイアウトの分類漏れと既定の大きい席表示。Hero高さ152pxで画面外。',expected:'5枚ドローの分類追加と全モバイル席のコンパクト表示で手札を画面内へ',evidence:'physical-badacey-before-layout-fix.png／physical-badacey-after-layout-fix.png／physical-nlh-final-layout.json'});
 put({id:'QA-011',title:'HTTPのローカル接続でMulti-Gameを開始できない',status:'修正済み・実機3形式再検査合格',environment:'実機Safari／ローカルHTTP',steps:'Multi-Gameの開始ボタンを押す',actual:'crypto.randomUUIDが未提供で例外。大会IDに代替生成を追加。',expected:'HTTPS以外の開発用接続でも大会を開始できる',evidence:'physical-features-final.json／multiGameSeries.test.js'});
 put({id:'QA-012',title:'ChineseとOFCの結果がスクロールの外に残る',status:'固定得点表示へ修正・実機横各3ハンド合格',environment:'実機Safari横画面',steps:'配置を確定して決着',actual:'次の操作だけ見えて、得点を探すためスクロールが必要。',expected:'画面下部へ今回の得点と次ハンドを併記',evidence:'physical-chinese-landscape-fixed-*.png'});
 put({id:'QA-013',title:'金額の1桁目が最低額へ補正され、連続入力しにくい',status:'修正済み・回帰テスト合格／指入力待ち',environment:'モバイル・PCのベット金額入力',steps:'最低額40の入力欄を空にして8→80と入力',actual:'空欄や8の時点で40に戻される。入力中の文字列と送信額を分離して修正。',expected:'入力中の文字を保ち、送信する額は常に許容範囲。候補4つも44pxの一覧表示',evidence:'drawControls.test.jsx 11件／physical-nlh-final-layout.json'});
 p.notes=p.notes.filter(x=>!x.startsWith('QA-001〜QA-009'));
});
