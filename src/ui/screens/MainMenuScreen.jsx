import React from "react";
import { useNavigate } from "react-router-dom";
import { designTokens } from "../../styles/designTokens.js";

const menuItems = [
  {
    label: "Ring Game",
    description: "Sit in for a quick cash-style Badugi hand.",
    path: "/game",
  },
  {
    label: "Tournament Mode",
    description: "Climb the bracket, unlock specs, and win titles.",
    path: "/tournament",
  },
  {
    label: "Mixed Game Builder",
    description: "Stack rare variants into a rotating mixed session.",
    path: "/mixed",
  },
  {
    label: "Dealer's Choice",
    description: "Queue variants and let the dealer spin the wheel.",
    path: "/dealers-choice",
  },
];

export default function MainMenuScreen() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 text-white"
      style={{
        background:
          `linear-gradient(160deg, ${designTokens.colors.background}, #020617 60%, #01030a)`,
        color: designTokens.colors.textStrong,
      }}
    >
      <div className="max-w-4xl w-full space-y-8">
        <header className="text-center space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-400">
            Badugi Arcade
          </p>
          <h1 className="text-4xl md:text-5xl font-extrabold">Main Menu</h1>
          <p className="text-sm text-slate-300">
            Choose a mode below and keep the streak alive.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate(item.path)}
              className="group rounded-3xl border border-white/10 bg-slate-900/80 p-6 text-left transition hover:border-emerald-400/70 hover:bg-slate-800/90"
              style={{
                boxShadow: designTokens.elevation.card,
              }}
            >
              <p className="text-sm text-slate-400 uppercase tracking-wide">
                {item.label}
              </p>
              <p className="text-lg font-semibold text-white">
                {item.description}
              </p>
              <span className="inline-flex items-center gap-2 text-xs text-emerald-300 mt-3">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Start
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
