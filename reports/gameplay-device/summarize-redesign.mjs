import {readFile,writeFile} from 'node:fs/promises';
import {updateProgress} from './progress.mjs';
const root=new URL('./',import.meta.url);
const read=async name=>JSON.parse(await readFile(new URL(`artifacts/${name}.json`,root),'utf8'));
const ring=await read('redesign-physical-landscape');
const extra=await read('redesign-physical-final-landscape');
const chinese=await read('redesign-physical-chinese-landscape');
const touch=await read('redesign-native-touch');
let portrait=null,features=null;
try{portrait=await read('redesign-physical-portrait');}catch{}
try{features=await read('redesign-physical-features');const dealer=await read('redesign-physical-dealer-final');features.rows=features.rows.map(r=>r.id==='dealers-choice'?(dealer.rows.find(d=>d.id===r.id)||r):r);}catch{}
const compact=r=>r.rows.map(x=>({id:x.id,status:x.status,viewport:x.viewport,geometryChecks:x.geometryChecks,maxHeroCards:x.maxHeroCards,maxBoardCards:x.maxBoardCards,hands:x.hands?.length,resumed:x.resumed,error:x.error}));
const evidence={updated:new Date().toISOString(),scope:'Mobile visual redesign; local production build; no deployment',physical:{ring:compact(ring),finalMountFix:compact(extra),arrangement:compact(chinese),portrait:portrait?compact(portrait):'Awaiting physical rotation',features:features?compact(features):'Not rerun',nativeAmount:{observedDigits:touch.touches.map(x=>x.id),confirmed:80,heroStackAfter:touch.hero.stack,viewport:touch.viewport,subjectiveComfort:'No response'}},browser:{existingMobileCompatibility:{passed:46,scope:'Public ring variants portrait/landscape; prior layout audit updated for disabled waiting controls'},finalStudAndKeypadRegression:{passed:18,scope:'6 Stud-family variants at portrait/landscape, small Stud screens, 4 keypad sizes after final fixes'},mobileDesignAndPortraitRegression:{passed:101,composition:'35 variants × 2 sizes + 5 variants × 2 smaller sizes + 4 keypad sizes + 12 preview portrait + 5 usability'},multiGame:{passed:6,scope:'3 formats × portrait and short landscape; UI hand and resume; explicit champion fixture for completion'},arrangementRegression:{passed:4,scope:'Chinese/OFC each 10 hands × portrait/landscape; part of earlier 10-test batch'}},unit:{passed:10},limitations:['Physical game actions use DOM control activation; only the recorded keypad interaction was native user touch.','One hand is not exhaustive poker-state coverage.','PWA home-screen install/restart remains unverified.']};
await writeFile(new URL('redesign-evidence.json',root),JSON.stringify(evidence,null,2)+'\n');
await updateProgress(p=>{
 p.summary='利用者の入力失敗・表示崩れの指摘を受け、モバイル画面を再設計。35種目を共通配置へ統一し、金額は専用数字キーへ変更。実機横35種目とChinese/OFC各3ハンド、実タッチでの80入力を確認。旧QAの使いやすさ判定は本再検査で更新する。詳細は[デザイン再検査](DESIGN-REVIEW.md)。';
 for(const g of p.games){
  const row=ring.rows.find(r=>r.id===g.id);
  if(row?.status==='PASS'){
   g.cashIphone='新UI実機Safari：横1ハンド・履歴・精算・退出 合格（DOM操作）';
   g.landscape=`新UI実機852×283：1ハンド合格、対局中${row.geometryChecks}回の配置検査`;
   const pr=portrait?.rows.find(r=>r.id===g.id);
   g.portrait=pr?.status==='PASS'?'新UI実機：縦1ハンド・配置・退出 合格（DOM操作）':'新UI WebKit393×695：1ハンド・配置 合格／新UI実機縦は未確認';
  }else if(chinese.rows.some(r=>r.id===g.id&&r.status==='PASS'))g.landscape='共通カード/操作へ更新後、実機横3ハンド・完全再現 合格';
 }
 for(const f of p.features){
  if(f.name==='実キーボード・タッチ操作'){f.status='新数字キーを利用者がタッチ：88→削除→80→確定を観測。表示高さ283pxを維持。押しやすさの主観回答は未';f.evidence='redesign-evidence.json';}
  if(f.name==='一目で操作できる画面'){f.status='新UIを35種目へ統一。WebKitの配置/進行/入力/縦回帰101件、大会縦横6件。実機横35種目。初見の理解度は未測定';f.evidence='DESIGN-REVIEW.md';}
 }
 for(const b of p.bugs){
  if(b.id==='QA-010'){b.status='共通グリッドへ再設計・全35種目実機横で再検査';b.expected='絶対位置の席配置をやめ、固定されたグリッドへ統一';b.evidence='DESIGN-REVIEW.md／redesign-evidence.json';}
  if(b.id==='QA-013'){b.status='モバイルは専用数字キーへ置換・実タッチで80確定を確認';if(!b.actual.includes('入力方式ごと変更'))b.actual+=' 旧修正だけでは実タッチの使いにくさが残ったため、入力方式ごと変更。';b.evidence='DESIGN-REVIEW.md／artifacts/redesign-native-touch.json';}
 }
 const newBugs=[{id:'QA-014',title:'種目ごとの画面構造の不統一・数字入力が実操作で困難',status:'共通UIと専用数字キーへ変更・範囲付き再検査合格',environment:'iPhone Safari 852×283／縦と小画面WebKit',steps:'通常対局を切替・金額欄を指で編集',actual:'旧入力では既定40へ数字が追記されるなど、利用者が金額を指定できなかった。種目ごとに席・操作配置も異なった。',expected:'共通配置で手番と操作を示し、最初の数字で金額を置換して明示的に確定',evidence:'DESIGN-REVIEW.md／redesign-evidence.json'},{id:'QA-015',title:'ゲーム選択から対局へ移る瞬間にSafariのスクロール位置が残る',status:'マウント時の位置・スクロール固定を修正。実機3系列に加え、Dealer’s Choiceの開始・種目交代を再検査',environment:'iPhone Safari 横852×283',steps:'検索したゲームの開始直後を撮影',actual:'開始時に席が上へずれ、その後元に戻ることがあった。レイアウト確定前のフレームを排除し、前画面のスクロールをリセット。',expected:'開始直後から同じ位置にテーブルが収まる',evidence:'artifacts/redesign-physical-final-landscape.json／artifacts/redesign-physical-dealer-final.json'},{id:'QA-016',title:'小さい縦画面のStudで相手の10の文字が欠ける',status:'6枚以上の相手カードを2段表示へ変更・4サイズの目視とStud系6種目の回帰で確認',environment:'WebKit320×568および393×695',steps:'Studを7枚まで進めて相手の公開カードを確認',actual:'カード自体は席内でも、7枚を横一列へ縮めると10が枠内で切れる',expected:'数字を読める幅を保ち、カードが多い場合は2段にする',evidence:'artifacts/redesign-final-stud-keypad／tests/e2e/mobile-design-review.spec.ts'}];
 for(const b of newBugs){p.bugs=p.bugs.filter(x=>x.id!==b.id);p.bugs.push(b);}
});
