import React from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerProgress } from "../hooks/usePlayerProgress.js";
import { computeUnlockState } from "../utils/playerProgress.js";

const plannedFormats = [
  {
    title: "Stage Relay",
    description: "Rotate three variants in a fixed order and award stage points.",
    status: "Planning",
  },
  {
    title: "Survival Mix",
    description: "Different tables run different variants and rebalance every few hands.",
    status: "Planning",
  },
  {
    title: "Championship Relay",
    description: "Leverages Mixed Game profiles and ends with a Dealer's Choice final table.",
    status: "Planning",
  },
];

export default function MultiGameScreen() {
  const navigate = useNavigate();
  const progress = usePlayerProgress();
  const unlock = computeUnlockState(progress);
  const locked = unlock.multiGameLocked;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-300">
            Multi-Game Tournament
          </p>
          <h1 className="text-3xl font-extrabold">Multi-Game Tournament (Prototype)</h1>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition"
          >
            Title へ戻る
          </button>
          <button
            type="button"
            onClick={() => navigate("/games")}
            className="px-4 py-2 rounded-lg border border-cyan-400/40 text-cyan-200 hover:bg-cyan-400/10 transition"
          >
            Game Catalog
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-16 space-y-8">
        {locked && (
          <div className="rounded-3xl border border-amber-400/40 bg-amber-500/10 text-amber-100 text-sm p-4">
            Win the World Championship to unlock the Multi-Game prototype. Finish the stage chain first!
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 space-y-4">
            <h2 className="text-lg font-semibold">Progress Summary</h2>
            <div className="space-y-2 text-sm text-slate-300">
              <p>- Up to 6 seats per table (mirrors current training table size)</p>
              <p>- Variants rotate every 6-12 hands depending on stage</p>
              <p>- Eventually links with Mixed Game profiles and Dealer&apos;s Choice finals</p>
              <p>- RL logs will store `gameId` and `rotationIndex` for each hand</p>
            </div>
            <button
              type="button"
              disabled={locked}
              onClick={() => navigate("/tournament")}
              className={`w-full px-4 py-3 rounded-2xl font-semibold transition ${
                locked
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-emerald-500 text-slate-900 hover:bg-emerald-400"
              }`}
            >
              {locked ? "COMING SOON" : "Launch Prototype"}
            </button>
          </div>

          <div className="bg-slate-900/70 border border-white/10 rounded-3xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Formats in Planning</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {plannedFormats.map((format) => (
                <div
                  key={format.title}
                  className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold">{format.title}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {format.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{format.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Table Simulation (Mock)</h2>
          <p className="text-sm text-slate-300">
            Sample timeline only. Later specs will replace this card with live session data.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="text-slate-400 uppercase tracking-wide text-xs">
                  <th className="py-2 border-b border-white/10">Level</th>
                  <th className="py-2 border-b border-white/10">Game</th>
                  <th className="py-2 border-b border-white/10">Hands</th>
                  <th className="py-2 border-b border-white/10">Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2 border-b border-white/5">1</td>
                  <td className="py-2 border-b border-white/5">Badugi Draw</td>
                  <td className="py-2 border-b border-white/5">8 hands</td>
                  <td className="py-2 border-b border-white/5 text-slate-400">Opening phase</td>
                </tr>
                <tr>
                  <td className="py-2 border-b border-white/5">2</td>
                  <td className="py-2 border-b border-white/5">2-7 Triple Draw</td>
                  <td className="py-2 border-b border-white/5">10 hands</td>
                  <td className="py-2 border-b border-white/5 text-slate-400">Deep stack</td>
                </tr>
                <tr>
                  <td className="py-2 border-b border-white/5">3</td>
                  <td className="py-2 border-b border-white/5">Dealer&apos;s Choice</td>
                  <td className="py-2 border-b border-white/5">6 hands</td>
                  <td className="py-2 border-b border-white/5 text-slate-400">Final two tables</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
