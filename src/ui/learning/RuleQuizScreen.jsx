import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { QUIZ_TOPICS, createQuizRound, answerForQuestion, quizExplanation } from './quizCatalog.js';
import { readLearningLanguage } from './learningCatalog.js';

const suitNames = { S: '♠', H: '♥', D: '♦', C: '♣' };
function Cards({ cards, label }) {
  return <div className="space-y-2"><p className="font-bold">{label}</p><div className="flex flex-wrap gap-2">
    {cards.map(card => <span key={card} className={`rounded-lg bg-white px-3 py-4 text-lg font-bold ${/[HD]$/.test(card) ? 'text-red-700' : 'text-slate-950'}`}>
      {card.slice(0, -1)}{suitNames[card.slice(-1)]}
    </span>)}
  </div></div>;
}
export default function RuleQuizScreen() {
  const [params, setParams] = useSearchParams();
  const topic = QUIZ_TOPICS.some(t => t.id === params.get('topic')) ? params.get('topic') : 'lowball';
  const language = readLearningLanguage();
  const ja = language === 'ja';
  return <main className="min-h-screen bg-slate-950 p-4 py-8 text-white sm:p-8">
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-bold">{ja ? 'ルール・役比較クイズ' : 'Rules and hand comparison quiz'}</h1><Link className="text-emerald-200 underline" to="/learn">{ja ? '学習に戻る' : 'Back to learning'}</Link></header>
      <p className="text-slate-300">{ja ? '1回6問。回答すると正解と理由を確認できます。' : 'Six questions per round. Answer to see the correct choice and explanation.'}</p>
      <label className="block">{ja ? '練習テーマ' : 'Practice topic'}<select aria-label={ja ? '練習テーマ' : 'Practice topic'} value={topic} onChange={event => setParams({ topic: event.target.value })} className="mt-2 block w-full rounded-xl bg-slate-800 p-3">
        {QUIZ_TOPICS.map(t => <option key={t.id} value={t.id}>{t[language]}</option>)}
      </select></label>
      <QuizRound key={topic} topic={topic} language={language} />
    </div>
  </main>;
}

function QuizRound({ topic, language }) {
  const ja = language === 'ja';
  const [questions, setQuestions] = useState(() => createQuizRound(topic));
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const feedbackRef = useRef(null);
  const titleRef = useRef(null);
  const question = questions[index];
  const selected = question ? answers[question.id] : undefined;
  const answered = selected !== undefined;
  useEffect(() => { if (answered) feedbackRef.current?.focus(); }, [answered]);
  useEffect(() => { titleRef.current?.focus(); }, [index]);
  const restart = list => { setQuestions(list); setIndex(0); setAnswers({}); };
  const choiceLabel = key => ({ left: ja ? '左の手札' : 'Left hand', right: ja ? '右の手札' : 'Right hand', tie: ja ? '引き分け' : 'Tie', yes: ja ? 'ロー成立' : 'Qualifies', no: ja ? 'ロー不成立' : 'Does not qualify' })[key] ?? `${key}${ja ? '枚' : ' cards'}`;
  if (!question) {
    const wrong = questions.filter(q => answers[q.id] !== answerForQuestion(q));
    return <section className="space-y-5 rounded-2xl border border-emerald-300/30 bg-slate-900 p-6">
      <h2 tabIndex={-1} ref={titleRef} className="text-xl font-bold">{ja ? '練習結果' : 'Round results'}</h2>
      <p className="text-3xl font-bold text-emerald-200">{questions.length - wrong.length} / {questions.length}</p>
      <p>{ja ? 'この回の正解数です。' : 'Correct answers in this round.'}</p>
      <div className="flex flex-wrap gap-3">
        {wrong.length > 0 && <button className="min-h-11 rounded-xl bg-emerald-300 px-4 py-3 font-bold text-slate-950" onClick={() => restart(wrong)}>{ja ? '間違えた問題だけ復習' : 'Retry missed questions'}</button>}
        <button className="min-h-11 rounded-xl border border-white/30 px-4 py-3" onClick={() => restart(createQuizRound(topic))}>{ja ? '新しく6問' : 'New six-question round'}</button>
      </div>
    </section>;
  }
  const answer = answerForQuestion(question);
  const choices = question.kind === 'compare' ? ['left', 'right', 'tie'] : question.kind === 'count' ? ['1', '2', '3', '4'] : ['yes', 'no'];
  return <section className="space-y-5 rounded-2xl border border-white/20 bg-slate-900 p-5">
    <p className="text-sm text-emerald-200">{index + 1} / {questions.length}</p>
    <h2 ref={titleRef} tabIndex={-1} className="text-xl font-bold">{question.kind === 'compare' ? `${question.lowType === 'A5' ? 'A-5' : '2-7'} — ${ja ? '強いのはどちら？' : 'Which hand wins?'}` : question.kind === 'count' ? (ja ? 'Badugiの有効枚数は？' : 'How many valid Badugi cards?') : (ja ? 'この5枚で8-or-betterのローは成立する？' : 'Do these five cards qualify for eight-or-better low?')}</h2>
    <div className="grid gap-5 sm:grid-cols-2">{question.kind === 'compare' ? <><Cards cards={question.left} label={ja ? '左の手札' : 'Left hand'} /><Cards cards={question.right} label={ja ? '右の手札' : 'Right hand'} /></> : <Cards cards={question.cards} label={ja ? '手札' : 'Hand'} />}</div>
    <div className="flex flex-wrap gap-3">{choices.map(choice => <button type="button" key={choice} disabled={answered} aria-pressed={selected === choice} onClick={() => setAnswers(previous => ({ ...previous, [question.id]: choice }))} className={`min-h-11 rounded-xl border px-5 py-3 font-bold disabled:cursor-default ${selected === choice ? 'border-emerald-300 bg-emerald-400/20' : 'border-white/30 hover:border-emerald-300'}`}>{choiceLabel(choice)}</button>)}</div>
    {answered && <div role="status" tabIndex={-1} ref={feedbackRef} className={`space-y-3 rounded-xl border p-4 ${selected === answer ? 'border-emerald-300/50' : 'border-amber-300/50'}`}>
      <p className="font-bold">{selected === answer ? (ja ? '正解' : 'Correct') : (ja ? 'もう一度確認しよう' : 'Review this rule')}{' · '}{ja ? '正解：' : 'Answer: '}{choiceLabel(answer)}</p>
      <p className="text-sm leading-relaxed text-slate-200">{quizExplanation(question, language)}</p>
      <button type="button" onClick={() => setIndex(index + 1)} className="min-h-11 rounded-lg bg-emerald-300 px-4 py-3 font-bold text-slate-950">{index === questions.length - 1 ? (ja ? '結果を見る' : 'See results') : (ja ? '次の問題' : 'Next question')}</button>
    </div>}
  </section>;
}
