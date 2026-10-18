import React from 'react';
import { Link } from 'react-router-dom';
import { practiceFromReview, practiceUrl } from './practiceTransfer.js';

export default function ReviewPracticeLink({ hand, language }) {
  const ja = language === 'ja';
  const setup = practiceFromReview(hand);
  return <div className="space-y-2 rounded-xl border border-emerald-300/25 p-3">
    {setup.error ? <p className="text-sm text-slate-300">{setup.error === 'unsupported'
      ? (ja ? 'この種目は配牌練習に未対応です。Badugi・A-5 Triple Draw・2-7 Triple Drawに対応しています。' : 'Starting-hand practice supports Badugi, A-5 Triple Draw and 2-7 Triple Draw. This game is not supported yet.')
      : (ja ? '自分の開始手札が完全に記録されていないため、このハンドから練習を始められません。' : 'Your complete starting hand is unavailable, so this record cannot be used for practice.')}</p>
      : <><Link to={practiceUrl(setup)} className="inline-block min-h-11 py-2 font-semibold text-emerald-200">{ja ? 'この開始手札で練習' : 'Practice this starting hand'}</Link><p className="text-sm text-slate-300">{ja ? '種目と自分の開始手札を引き継ぎます。6人卓・自分はボタン・全員2,000点。相手と山札は毎回ランダムです。' : 'Use this game and your starting cards. Six seats, you on the button, 2,000 chips each. Opponents and the deck are randomized each time.'}</p></>}
  </div>;
}
