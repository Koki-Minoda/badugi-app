import { Link } from 'react-router-dom';
import { useLanguage } from '../preferences/language.js';
import LanguageSelect from '../preferences/LanguageSelect.jsx';
import React, { useEffect, useRef } from "react";
import mgxTitleKitsune from "../../assets/mgx_title_kitsune.png";

export default function TitleScreen({ onEnter }) {
  const containerRef = useRef(null);
  const ja = useLanguage() === 'ja';

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && event.target === event.currentTarget) {
      onEnter?.();
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-testid="title-screen"
      className="flex min-h-[100dvh] flex-col items-center justify-center overflow-y-auto bg-black px-6 py-4 text-center text-[#fbe8ba]"
    >
      <LanguageSelect />
      <img
        src={mgxTitleKitsune}
        alt="MGX Kitsune Logo"
        className="mb-4 max-h-[58dvh] w-auto max-w-full shrink object-contain kitsune-glow sm:mb-8"
      />
      <button
        type="button"
        onClick={() => onEnter?.()}
        className="shrink-0 rounded-full border border-amber-300/60 px-10 py-3 text-sm uppercase tracking-[0.3em] text-amber-100 transition hover:bg-amber-300/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        data-testid="title-enter-button"
      >
        {ja ? '登録・ログイン' : 'Sign up / log in'}
      </button>
      <Link to="/try" className="mt-3 min-h-11 rounded-xl px-5 py-3 text-emerald-200 underline">{ja ? '登録せずに体験する' : 'Try without signing up'}</Link>
    </div>
  );
}
