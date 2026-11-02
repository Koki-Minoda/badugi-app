const $ = id => document.getElementById(id);
const comparison = document.querySelector('.comparison');
const games = {
  nlh: { name: 'NL Hold’em', limit: 'NO LIMIT', street: 'FLOP', pot: 18, call: 4, currentBet: 6, invested: 2, cards: ['A♠','J♠'], board: ['J♦','7♣','2♠'], sizes: [12,18,24], min: 10, max: 90, draw: false },
  stud8: { name: 'Stud8', limit: 'FIXED LIMIT', street: '5TH STREET', pot: 12, call: 2, currentBet: 2, invested: 0, cards: ['A♠','2♦','3♣','7♥','K♠'], board: [], sizes: [4], min: 4, max: 4, draw: false },
  draw: { name: '2-7 Triple Draw', limit: 'FIXED LIMIT', street: '2ND DRAW', pot: 12, call: 0, currentBet: 0, invested: 0, cards: ['2♣','3♦','4♥','7♠','K♣'], board: [], sizes: [], min: 0, max: 0, draw: true },
};
const designs = {
  a: ['卓の形を保ち、静かに整える。','既存のovalを保つ改善最小案。移行しやすい一方、卓の空白と金額Sheetを開く手間が残ります。'],
  b: ['判断情報を、ひとまとまりに。','第一候補。カード、Pot、手番と必要額を読みやすく分け、頻出操作を下部へ固定。Studの公開カードと横画面での収まりを確認します。'],
  c: ['Playから、Reviewへつなぐ。','desktopでは補助rail、mobileでは対局の下へReview導線を配置。復習に強い一方、プレイ中の注意が分散しないか確認します。'],
};
let gameId = 'nlh', design = 'b', amount = 12;
const selected = new Set();
const names = ['Sora','Ren','Hana','Jun','Mina'];
function card(text, interactive = false, index = 0) {
  const el = document.createElement(interactive ? 'button' : 'span');
  el.className = `card${/[♥♦]/.test(text) ? ' red' : ''}${interactive && games[gameId].draw ? ' selectable' : ''}`;
  el.append(document.createTextNode(text.slice(0,-1)));
  const suit = document.createElement('span'); suit.textContent = text.slice(-1); el.append(suit);
  if (interactive) {
    el.setAttribute('aria-label',text);
    el.disabled = !games[gameId].draw || $('waiting').checked;
    el.setAttribute('aria-pressed',String(selected.has(index)));
    el.onclick = () => { selected.has(index) ? selected.delete(index) : selected.add(index); render(); };
  }
  return el;
}
function feedback(text) { $('feedback').textContent = text; }
function render() {
  const g = games[gameId], waiting = $('waiting').checked;
  comparison.dataset.design = design; comparison.dataset.game = gameId;
  $('hero-position').textContent=gameId==='stud8'?'Seat 1':'BTN';
  $('game-title').textContent = g.name; $('limit').textContent = g.limit; $('street').textContent = g.street;
  $('pot').replaceChildren(document.createTextNode(`${g.pot} `));
  const unit = document.createElement('small'); unit.textContent = 'BB'; $('pot').append(unit);
  $('board').replaceChildren(...g.board.map(c=>card(c)));
  $('hero-cards').replaceChildren(...g.cards.map((c,i)=>card(c,g.draw,i)));
  $('seats').replaceChildren(...names.map((name,i)=>{
    const seat = document.createElement('div'); seat.className=`seat seat-${i}${waiting && i===0 ? ' is-actor':''}`;
    const n=document.createElement('span'); n.className='name'; n.textContent=name;
    const stack=document.createElement('strong'); stack.className='stack'; stack.textContent=`${[94,100,76,113,108][i]} BB`;
    seat.append(n,stack);
    if (gameId==='stud8') { const shown=document.createElement('div');shown.className='exposed';shown.textContent=['4♣ 8♦ Q♠','A♥ 5♠ 9♣','2♣ 6♥ J♦','3♠ 9♦ K♣','5♦ 8♣ Q♥'][i];seat.append(shown); }
    if(i===0 && !g.draw && !waiting){const bet=document.createElement('div');bet.className='bet';bet.textContent=`ベット ${g.currentBet} BB`;seat.append(bet);}
    return seat;
  }));
  $('turn-label').textContent = waiting ? 'Soraの番' : 'あなたの番';
  $('call-label').textContent = waiting ? '手番を待っています' : g.draw ? `${selected.size}枚を交換` : g.call ? `コール ${g.call} BB` : 'チェックできます';
  $('call').textContent = waiting ? 'チェック' : g.draw ? selected.size ? `${selected.size}枚交換` : '交換しない' : g.call ? `コール ${g.call} BB` : 'チェック';
  $('raise').hidden = g.draw; $('fold').hidden = g.draw;
  $('call').disabled = waiting; $('raise').disabled = waiting; $('fold').disabled = waiting;
  $('raise-value').textContent=`${amount} BBまで`;
  $('custom-open').hidden=g.draw || gameId==='stud8'; $('custom-open').disabled=waiting;
  $('presets').replaceChildren(...g.sizes.map(size=>{const b=document.createElement('button');b.textContent=`${size} BBまで`;b.disabled=waiting;b.setAttribute('aria-pressed',String(size===amount));b.onclick=()=>{amount=size;render();};return b;}));
  $('presets').hidden=g.draw || waiting;
  document.querySelector('.reserve').hidden=!waiting || g.draw;
  $('decision-note').textContent=waiting ? 'Soraの判断待ち · ベットが入ったらチェック予約を取消' : g.draw ? '交換するカードをタップ · Aは高い / ストレート・フラッシュは不利' : `現在のベット ${g.currentBet} BB · あなたは${g.invested} BB投入済み`;
  $('option-tag').textContent=`OPTION ${design.toUpperCase()}`; $('option-title').textContent=designs[design][0];$('option-description').textContent=designs[design][1];
  document.querySelectorAll('[data-design]').forEach(button=>{if(button.tagName==='BUTTON')button.setAttribute('aria-pressed',String(button.dataset.design===design));});
}
document.querySelectorAll('button[data-design]').forEach(b=>b.onclick=()=>{design=b.dataset.design;render();});
$('game').onchange=()=>{gameId=$('game').value;amount=games[gameId].sizes[0]??0;selected.clear();$('reserve-check').checked=false;feedback('');render();};
$('waiting').onchange=()=>{$('reserve-check').checked=false;feedback('手番変更時に古い予約を取り消しました。');render();};
$('reserve-check').onchange=()=>feedback($('reserve-check').checked?'チェック予約中。ベット額・ハンド変更時は取り消します。':'予約を取り消しました。');
$('call').onclick=()=>feedback(`デモ：${$('call').textContent}を選択しました。`);
$('raise').onclick=()=>feedback(`デモ：合計${amount} BBへレイズ。今回の追加は${amount-games[gameId].invested} BBです。`);
$('fold').onclick=()=>feedback('デモ：フォールドを選択しました。');
function openHistory(){const g=games[gameId];const lines=g.draw?[['1st Draw','あなた Draw 1'],['Betting','Sora Check → あなた Check'],['2nd Draw','あなたの交換待ち']]:[['前のstreet','あなた Check → Sora Check'],[g.street,`Sora Bet ${g.currentBet} BB`],['現在',`あなたの判断待ち · Call ${g.call} BB`]];$('history-line').replaceChildren(...lines.map(([label,text])=>{const li=document.createElement('li');const a=document.createElement('span');a.textContent=label;const b=document.createElement('strong');b.textContent=text;li.append(a,b);return li;}));$('history').showModal();}
$('history-open').onclick=openHistory;$('study-history').onclick=openHistory;
$('custom-open').onclick=()=>{const g=games[gameId];$('amount-input').min=g.min;$('amount-input').max=g.max;$('amount-input').value=amount;$('amount-error').textContent='';$('amount').showModal();};
$('amount-confirm').onclick=()=>{const g=games[gameId],value=Number($('amount-input').value);if(!Number.isSafeInteger(value)||value<g.min||value>g.max){$('amount-error').textContent=`${g.min}〜${g.max} BBで指定してください。`;return;}amount=value;$('amount').close();render();feedback(`合計${amount} BBを選択。追加額は${amount-g.invested} BBです。`);};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
render();
