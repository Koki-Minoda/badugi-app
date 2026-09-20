import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {updateProgress} from './progress.mjs';
const root=new URL('./',import.meta.url);
const read=async name=>JSON.parse(await readFile(new URL(`artifacts/${name}.json`,root),'utf8'));
const portrait=await read('phase-physical-portrait');
for(const r of (await read('phase-physical-portrait-a5-recheck')).rows)portrait.rows[portrait.rows.findIndex(x=>x.id===r.id)]=r;
assert.equal(portrait.rows.length,35);assert.ok(portrait.rows.every(r=>r.status==='PASS'));
const features=await read('phase-physical-features-verified'),chinese=await read('phase-physical-chinese-portrait'),network=await read('phase-physical-network-final'),family=await read('phase-physical-comparison'),keypad=await read('phase-physical-keypad');
assert.ok([...features.rows,...chinese.rows,network,family,keypad].every(r=>r.status==='PASS'));
const evidence={updated:new Date().toISOString(),baseCommit:'25023ce',scope:'Oval-table phase colors, clipboard feedback, storage pressure and pending physical QA; local build only',phaseConvention:'Green felt throughout. Red rail and draw labels during DRAW, neutral rail during BET. Same source as action controls.',physical:{device:'iPhone17,3 / iOS 26.5.2 / Safari 26.5.2',method:'USB Web Inspector, real LAN preview/API; DOM activations with hit testing, not native finger input',portrait:{passed:35,viewport:[393,695],scope:'1 natural CPU hand per variant, layout, phase colors, saved replay requirements, cash out and exit',rows:portrait.rows.map(r=>({id:r.id,status:r.status,actions:r.heroActions.length,phases:r.phaseTransitions?.map(t=>t.phase),history:r.records?.map(h=>({handId:h.handId,valid:h.replay.valid}))})),sources:['artifacts/phase-physical-portrait.json','artifacts/phase-physical-portrait-a5-recheck.json']},arrangement:{passed:2,handsPerVariant:3,exactReplay:true,evidence:'artifacts/phase-physical-chinese-portrait.json'},features:{rows:features.rows.map(r=>({id:r.id,status:r.status,resumed:r.resumed})),evidence:'artifacts/phase-physical-features-verified.json'},network:{...network,evidence:'artifacts/phase-physical-network-final.json'},family:{status:family.status,evidence:'artifacts/phase-physical-comparison.json'},keypad:{status:keypad.status,evidence:'artifacts/phase-physical-keypad.json'},landscape:{status:'PENDING',reason:'Current page remains 393×695 portrait. Rotation requested; no new landscape measurement yet.'},homeScreen:{status:'PENDING',reason:'Safari share/add-to-home UI is outside page automation. User asked to add and launch; no standalone launch observed.'}},browser:{webkitFinal:{passed:13,notApplicable:2,scope:'8 phase cases, 3 family geometry comparisons, 2 storage-pressure cases; desktop-only cases excluded from mobile profile',evidence:'artifacts/phase-final-browser'},desktopPhase:{passed:2,evidence:'artifacts/phase-final-desktop'},multigame:{passed:3,scope:'Play/resume + explicit championship fixtures for result paths, not natural full tournament completion',evidence:'artifacts/phase-save-browser'},friendAndManifest:{passed:2,evidence:'artifacts/phase-friend-browser'}},unit:{phaseAndSeats:10,clipboard:4,friendScreen:18,storageAndResumeAndNotice:29},build:'PASS',lint:'0 errors; 2 pre-existing App.jsx warnings',productionDeployment:false};
await writeFile(new URL('phase-evidence.json',root),JSON.stringify(evidence,null,2)+'\n');
await updateProgress(p=>{
 p.summary='丸テーブルのドロー色を復元。色と操作状態の参照元、コピー成功の誤表示、保存容量不足時の大会保存を修正。実機縦35種目、大会3形式の再開、Dealer’s Choice、友達対戦の通信復帰、Chinese/OFC各3ハンド、数字入力・種目間配置比較が合格。最新の実機横画面とホーム画面追加・再起動は利用者の端末操作待ち。';
 for(const g of p.games){
  if(portrait.rows.some(r=>r.id===g.id)){
   g.cashIphone='丸テーブル実機縦：1ハンド・履歴要件・精算・退出 合格（DOM操作）';
   g.portrait='実機393×695：丸テーブル配置・フェーズ色・1ハンド 合格';
   g.landscape='丸テーブルWebKit852×283 合格／最新の実機横は回転待ち';
  }else if(['ofc','chinese_poker'].includes(g.id)){
   g.portrait='最新実機縦：3ハンド・固定得点・履歴完全再現 合格';
   g.cashIphone='最新実機縦3ハンド合格／横3ハンドは先行版で合格（DOM操作）';
  }
 }
 const feature=(name,status,evidence='PHASE-AND-PENDING-QA.md')=>{const f=p.features.find(f=>f.name===name);if(f)Object.assign(f,{status,evidence});};
 feature('友達対戦・通信復帰','実機：2人参加・手札非公開・WS再接続・RESTへの切替・HTTP中断復帰・終了・再読込 合格');
 feature('Multi-Game Tournament','最新実機：3形式で各1ハンド→再読込→再開後1ハンド 合格。容量不足時の保存も修正');
 feature('Dealer’s Choice','最新実機：NLH→Badugi、各1ハンド・キュー消費・色・配置 合格');
 feature('一目で操作できる画面','利用者から丸テーブルのレイアウトに肯定的な反応。実機NLH/2−7 TD/SDで席・カード・操作欄の寸法一致。主観評価と機械検査は区別');
 feature('丸テーブル・周囲の6席・共通対局デザイン','最新実機縦35種目・色切替・種目間比較 合格。WebKitは縦横検査済み。最新の実機横は回転待ち');
 feature('実キーボード・タッチ操作','最新実機DOM：88→削除→80・取消・確定・113×48pxの数字キー当たり判定 合格。指で80確定は先行版で利用者操作を確認');
 feature('実機の縦横回転・セーフエリア','最新丸テーブル：実機縦393×695 合格。横はWebKit852×283確認済み、実機は回転待ち');
 feature('PWAインストール・再起動','manifest/PNG実体/起動URLの再検査合格。実機の共有→ホーム追加→起動は依頼済み、未確認。オフライン機能なし');
 for(const id of ['QA-010','QA-017']){const b=p.bugs.find(b=>b.id===id);if(b)b.status=id==='QA-017'?'丸テーブルも実機縦NLH/2−7 TD/SDで一致。WebKit3サイズ比較も合格':'丸テーブル：最新実機縦35種目とWebKit縦横で合格。最新実機横は待ち';}
 const bugs=[
  {id:'QA-018',title:'丸テーブルでドロー中の赤い縁が失われた',status:'修正済み・実機縦35種目とWebKit/PCで再検査合格',environment:'モバイル丸テーブル、Badugiなどのフェーズ切替',steps:'ベット→ドロー→次のベットへ進行',actual:'丸テーブルに色分岐がなく、旧phase値も操作側とずれることがあった',expected:'操作と同じ進行状態で縁・交換ラベルを赤にし、ベットで戻す。フェルトは緑',evidence:'phase-evidence.json'},
  {id:'QA-019',title:'クリップボードが使えなくてもコピー成功と表示',status:'代替コピーと失敗表示を実装・部品22件合格',environment:'HTTPのiPhone Safariなど',steps:'友達対戦のルームコードをコピー',actual:'Clipboard API不在を成功扱いし、拒否時はエラー処理がなかった',expected:'代替処理も含め成功時だけ成功表示。失敗時は長押しコピー案内',evidence:'src/ui/utils/__tests__/copyTextToClipboard.test.js / FriendMatchSetupScreen.test.jsx'},
  {id:'QA-020',title:'実機検査プロキシがWebSocket認証情報を転送しない',status:'検査環境を修正・実機友達対戦と再接続合格',environment:'ローカル4179/4180プロキシ',steps:'友達対戦へ接続',actual:'認証サブプロトコルと異常切断コードが欠落して再接続を繰り返した',expected:'認証プロトコルと切断理由を転送。本番APIの不具合とは分ける',evidence:'artifacts/phase-physical-network-final.json'},
  {id:'QA-021',title:'保存容量不足でも大会進行を保存済みとして返す',status:'補助ログ整理・再試行・失敗通知へ修正。実機3形式再開、容量制限ユニットとブラウザ2ケース合格',environment:'長期プレイ後のiPhone localStorage',steps:'履歴・補助ログが蓄積した端末で大会を進めて再開',actual:'実機でQuotaExceededError。保存失敗でもsnapshotを返し、同期キューの再試行も同じ容量で失敗',expected:'補助ログだけ古い順に整理し保存・同期キューを再試行。対局履歴/成績/認証を削除せず、失敗はnullと画面通知',evidence:'artifacts/phase-storage-before-fix.json / artifacts/phase-physical-features-verified.json / artifacts/phase-storage-after-fix.json / artifacts/phase-final-browser'}
 ];
 p.bugs=p.bugs.filter(b=>!bugs.some(n=>n.id===b.id)).concat(bugs);
});
const oval=JSON.parse(await readFile(new URL('oval-table-evidence.json',root),'utf8'));
oval.physical={status:'PORTRAIT_PASS_LANDSCAPE_PENDING',latestEvidence:'phase-evidence.json',portraitVariants:35,reason:'Physical portrait reconnected and verified. Current landscape and home-screen checks await native device actions.'};
await writeFile(new URL('oval-table-evidence.json',root),JSON.stringify(oval,null,2)+'\n');
