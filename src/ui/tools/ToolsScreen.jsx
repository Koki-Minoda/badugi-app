import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../preferences/language.js';
import LanguageSelect from '../preferences/LanguageSelect.jsx';
import CardPicker from './CardPicker.jsx';
import { cardText } from './cardText.js';
import TableClock from './TableClock.jsx';
import { CHECKER_GAMES, compareHands, recommendGames, validCards } from './handTools.js';
import { practiceUrl } from '../practice/practiceTransfer.js';
import { getLearningGame } from '../learning/learningCatalog.js';
const partNames = { badugi27:['Badugi（Aは高い）','Badugi (ace high)'], high: ['ハイ', 'High'], low27: ['2-7ロー', '2-7 low'], lowA5: ['A-5ロー', 'A-5 low'], badugi: ['Badugi','Badugi'], low8: ['8以下のロー','Eight-or-better low'], archieHigh: ['9のペア以上','Pair of nines or better'] };
const categoryNames = { 'straight-flush':'ストレートフラッシュ', 'four-of-a-kind':'フォーカード', 'full-house':'フルハウス', flush:'フラッシュ', straight:'ストレート', 'three-of-a-kind':'スリーカード', 'two-pair':'ツーペア', 'one-pair':'ワンペア', 'high-card':'ハイカード', onePair:'ワンペア', twoPair:'ツーペア', trips:'スリーカード', quads:'フォーカード', fullHouse:'フルハウス', straightFlush:'ストレートフラッシュ', highCard:'ペアなし' };
function label(e, ja) {
  if (e.qualifies === false) return ja ? '成立しません' : 'Does not qualify';
  if (e.metadata?.size) return `${e.metadata.size}${ja ? '枚のBadugi' : '-card Badugi'}`;
  return `${ja ? categoryNames[e.metadata?.category] ?? e.handName : e.handName} · ${(e.metadata?.ranks ?? []).join('-')}`;
}
export default function ToolsScreen() {
  const ja = useLanguage() === 'ja';
  const [params, setParams] = useSearchParams();
  const tab = ['checker','recommend','clock'].includes(params.get('tab')) ? params.get('tab') : 'checker';
  const [gameId, setGameId] = useState('low27');
  const [hands, setHands] = useState([['7S','5H','4D','3C','2S'], ['8S','6H','4C','3D','2H']]);
  const [cards, setCards] = useState(['AS','2H','3D','4C','5S']);
  const game = CHECKER_GAMES.find(g => g.id === gameId);
  let result = null;
  try { result = compareHands(gameId, hands); } catch { /* Incomplete card selection has no result. */ }
  const recommendations = validCards(cards, 5) ? recommendGames(cards).suggestions : [];
  return <main className="min-h-screen bg-slate-950 px-4 py-6 text-white"><div className="mx-auto max-w-4xl space-y-5"><header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{ja ? 'ポーカーツール' : 'Poker tools'}</h1><LanguageSelect /><Link className="min-h-11 py-2 text-emerald-200" to="/learn">{ja ? '学習へ戻る' : 'Back to learning'}</Link></header><nav className="flex flex-wrap gap-2">{[['checker','役と分配を比べる','Compare hands'],['recommend','手札から練習を選ぶ','Find a practice game'],['clock','ゲーム札・時計','Game sign & clock']].map(([id,jp,en]) => <button type="button" aria-pressed={tab === id} key={id} onClick={() => setParams({ tab:id })} className={`min-h-11 rounded-xl border px-4 py-2 ${tab === id ? 'border-emerald-300 bg-emerald-300 text-slate-950' : 'border-white/25'}`}>{ja ? jp : en}</button>)}</nav>
    {tab === 'clock' ? <TableClock ja={ja} /> : tab === 'checker' ? <section className="space-y-5"><p className="text-sm text-slate-300">{ja ? '完成した手札2組を比べます。表示する分配は、両者が同額を出した1つのポットの割合です。Omahaの手札・ボード選択やサイドポットは扱いません。' : 'Compare two completed hands. Shares assume one pot with equal contributions. Omaha hole/board selection and side pots are not included.'}</p><label className="block">{ja ? '比べ方' : 'Rules'}<select className="mt-2 min-h-11 w-full rounded-xl bg-slate-800 p-3 text-base" value={gameId} onChange={e => { setGameId(e.target.value); setHands([[],[]]); }}>{CHECKER_GAMES.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label><div className="grid gap-4 md:grid-cols-2">{hands.map((hand,i) => <CardPicker key={`${gameId}-${i}`} cards={hand} count={game.count} blocked={hands[1-i]} label={ja ? `手札 ${i+1}` : `Hand ${i+1}`} ja={ja} onChange={value => setHands(hands.map((h,j) => j === i ? value : h))} />)}</div>
      {!result ? <p role="status">{ja ? `重複しないカードを各${game.count}枚選んでください。` : `Choose ${game.count} distinct cards for each hand.`}</p> : <div className="space-y-4 rounded-2xl border border-emerald-300/40 p-4" role="status"><h2 className="text-lg font-bold">{ja ? '比較結果' : 'Comparison'}</h2>{result.fallbackHigh && <p>{ja ? '両側とも成立しないため、MGXでは最も強いハイが全体を受け取ります。' : 'Neither side qualifies; MGX awards the whole pot to the best high hand.'}</p>}{result.parts.map(part => <div key={part.id} className="space-y-2 border-b border-white/15 pb-3"><h3 className="font-bold">{partNames[part.id][ja ? 0 : 1]}</h3>{part.evaluations.map((e,i) => <p key={i}>{ja ? '手札' : 'Hand'} {i+1}: {label(e,ja)}<span className="ml-2 text-sm text-slate-300">{(e.metadata?.cards ?? []).map(cardText).join(' ')}</span></p>)}<p className="text-emerald-200">{part.winners.length === 2 ? (ja ? '同点です' : 'Tie') : part.winners.length ? `${ja ? '手札' : 'Hand'} ${part.winners[0]+1} ${ja ? 'の勝ち' : 'wins'}` : (ja ? 'どちらも成立しません' : 'Neither hand qualifies')}</p></div>)}<p className="font-bold">{result.noQualifier ? (ja ? '両側とも成立しないため、この比較では分配を確定できません。卓のルールを確認してください。' : 'Neither side qualifies. Consult the table rules before distributing the pot.') : result.shares.map((share,i) => `${ja ? '手札' : 'Hand'} ${i+1}: ${share*100}%`).join(' / ')}</p><p className="text-xs text-slate-400">{ja ? 'ローは高い数字から順に比べます。Badugiは有効枚数が多い方が優先です。片側だけ成立する場合は、その側で全体を分けます。端数チップは卓の規定に従います。' : 'Low hands compare ranks from highest downward. More valid cards take priority in Badugi. If only one side qualifies, it receives the whole pot. Odd chips follow the table rules.'}</p></div>}
    </section> : <section className="space-y-5"><p className="text-sm text-slate-300">{ja ? '手札の特徴から、比較・練習しやすい種目を選びます。利益や最善手の予測ではありません。' : 'Find games worth studying from the features of your cards. These suggestions do not predict profit or optimal play.'}</p><CardPicker cards={cards} count={5} onChange={setCards} ja={ja} label={ja ? '手札' : 'Hand'} />{recommendations.map(item => <article key={item.id} className="space-y-3 rounded-2xl border border-white/20 p-4"><h2 className="text-lg font-bold">{getLearningGame(item.id)?.name}</h2><p>{item.reason[ja ? 0 : 1]}</p><p>{item.cards.map(cardText).join(' ')}</p><Link className="inline-block min-h-11 rounded-lg bg-emerald-300 px-4 py-2 font-bold text-slate-950" to={practiceUrl({ variant: item.id, cards: item.cards })}>{ja ? 'この手札で練習' : 'Practice these cards'}</Link><Link className="ml-3 inline-block min-h-11 py-2 text-emerald-200" to={`/learn?variant=${item.id}`}>{ja ? 'ルールを見る' : 'Read rules'}</Link></article>)}</section>}
  </div></main>;
}
