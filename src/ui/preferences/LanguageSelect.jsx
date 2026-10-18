import React from 'react';
import { useLanguage, setLanguage } from './language.js';
export default function LanguageSelect() {
  const language = useLanguage();
  return <label className="flex items-center justify-between gap-3 text-sm"><span>言語 / Language</span><select aria-label="言語 / Language" className="min-h-11 rounded-lg border border-slate-500 bg-slate-900 px-3 text-base text-white" value={language} onChange={event => setLanguage(event.target.value)}><option value="ja">日本語</option><option value="en">English</option></select></label>;
}
