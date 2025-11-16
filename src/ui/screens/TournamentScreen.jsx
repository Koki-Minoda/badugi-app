import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TOURNAMENT_STAGES } from "../../config/tournamentStages";
import { TOURNAMENT_OPPONENTS } from "../../config/tournamentOpponents";
import OpponentCard from "../components/OpponentCard";

export default function TournamentScreen() {
  const navigate = useNavigate();
  const tiers = useMemo(() => {
    const groups = new Map();
    TOURNAMENT_OPPONENTS.forEach((opponent) => {
      if (!groups.has(opponent.tier)) groups.set(opponent.tier, []);
      groups.get(opponent.tier).push(opponent);
    });
    return Array.from(groups.entries()).map(([tier, opponents]) => ({
      tier,
      opponents,
    }));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-emerald-300">Tournament Mode</p>
          <h1 className="text-3xl font-extrabold">CPU トーナメント</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 rounded-lg border border-white/30 hover:bg-white/10 transition"
          >
            タイトルへ
          </button>
          <button
            onClick={() => navigate("/game")}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400 transition"
          >
            トレーニングへ
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-16 space-y-10">
        <section className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 shadow-2xl">
          <h2 className="text-2xl font-bold mb-4">ステージ仕様</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TOURNAMENT_STAGES.map((stage) => (
              <div key={stage.id} className="rounded-2xl bg-slate-800/80 p-4 border border-white/10">
                <p className="text-sm uppercase tracking-widest text-emerald-300">{stage.name}</p>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-400">1アクション</dt>
                    <dd>{stage.actionLimitSeconds}秒</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">TB初期</dt>
                    <dd>{stage.timebankInitial}秒</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">回復</dt>
                    <dd>{stage.recovery}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">上限</dt>
                    <dd>{stage.cap}秒</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {tiers.map(({ tier, opponents }) => (
          <section key={tier} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">{tier} リーグ</h3>
              <button className="text-sm text-emerald-300 underline decoration-dotted" disabled>
                Coming soon
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {opponents.map((opponent) => (
                <OpponentCard key={opponent.id} opponent={opponent} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
