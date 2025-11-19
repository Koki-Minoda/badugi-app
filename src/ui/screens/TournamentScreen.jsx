import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TOURNAMENT_STAGES } from "../../config/tournamentStages";
import {
  loadTournamentProgress,
  getStageEligibility,
  canAffordEntry,
  deductEntryFee,
} from "../utils/tournamentState";
import { createTournamentSession, loadActiveTournamentSession } from "../tournament/tournamentManager";
import { loadTitleSettings } from "../utils/titleSettings";

function formatRange([min, max]) {
  return min === max ? String(min) : `${min}~${max}`;
}

export default function TournamentScreen() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(() => loadTournamentProgress());
  const [activeSession, setActiveSession] = useState(() => loadActiveTournamentSession());
  const heroProfile = useMemo(() => loadTitleSettings(), []);

  useEffect(() => {
    function handleStorage(event) {
      if (
        event?.key &&
        !["progress.tournament", "session.tournament.active"].includes(event.key)
      ) {
        return;
      }
      setProgress(loadTournamentProgress());
      setActiveSession(loadActiveTournamentSession());
    }
    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorage);
      return () => window.removeEventListener("storage", handleStorage);
    }
    return undefined;
  }, []);

  const wins = progress?.wins ?? {};

  function handleEnter(stage) {
    const eligibility = getStageEligibility(stage.id, progress);
    if (!eligibility.eligible) {
      alert(eligibility.reason || "出場条件を満たしていません");
      return;
    }
    const funds = canAffordEntry(stage.id, progress);
    if (!funds.ok) {
      alert(funds.reason || "エントリー費が不足しています");
      return;
    }
    const deduction = deductEntryFee(stage.id);
    if (!deduction.ok) {
      alert(deduction.reason || "エントリー費の引き落としに失敗しました");
      return;
    }
    setProgress(deduction.progress);
    const session = createTournamentSession(stage.id, heroProfile);
    setActiveSession(session);
    navigate(`/game?tournament=${session.id}`);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
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

      <main className="max-w-6xl mx-auto px-6 pb-16 space-y-8">
        <section className="rounded-3xl bg-slate-900/80 border border-white/10 p-6 grid gap-6 md:grid-cols-3">
          <div>
            <p className="text-sm text-slate-400">バンクロール</p>
            <p className="text-3xl font-bold text-white">¥{progress.bankroll ?? 0}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">優勝履歴</p>
            <dl className="text-sm text-white grid grid-cols-2 gap-x-4 gap-y-1">
              {["store", "local", "national", "world"].map((id) => {
                const stage = TOURNAMENT_STAGES.find((s) => s.id === id);
                return (
                  <React.Fragment key={id}>
                    <dt className="text-slate-400">{stage?.label ?? id}</dt>
                    <dd>{wins[id] ?? 0} 勝</dd>
                  </React.Fragment>
                );
              })}
            </dl>
          </div>
          {activeSession ? (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
              <p className="text-sm text-emerald-300">進行中のトーナメント</p>
              <p className="text-xl font-semibold">{activeSession.stageLabel}</p>
              <button
                className="mt-3 w-full rounded-lg bg-emerald-500 text-slate-900 py-2 font-semibold"
                onClick={() => navigate(`/game?tournament=${activeSession.id}`)}
              >
                再開する
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 p-4 text-slate-400 text-sm">
              参加したいステージを選び、エントリー費を支払って開始してください。
            </div>
          )}
        </section>

        <section className="space-y-6">
          {TOURNAMENT_STAGES.map((stage) => {
            const eligibility = getStageEligibility(stage.id, progress);
            const afford = canAffordEntry(stage.id, progress);
            const locked = !eligibility.eligible;
            const disabled = locked || (!afford.ok && stage.entryFee > 0);
            const primaryPrize = stage.prizeTable[0];
            return (
              <div
                key={stage.id}
                className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div>
                  <p className="text-sm uppercase tracking-widest text-emerald-300">{stage.label}</p>
                  <h2 className="text-2xl font-bold text-white">{stage.description}</h2>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-300">
                    <span>参加費: ¥{stage.entryFee}</span>
                    <span>人数: {formatRange(stage.participantsRange)} 人</span>
                    <span>初期スタック: {stage.startingStack}</span>
                    <span>プライズ: 1位 ¥{primaryPrize?.payout ?? 0}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{stage.eligibility?.text}</p>
                </div>
                <div className="flex flex-col gap-2 w-full md:w-48">
                  <button
                    className={`rounded-xl py-3 font-semibold ${
                      disabled
                        ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                        : "bg-emerald-500 text-slate-900 hover:bg-emerald-400"
                    }`}
                    onClick={() => handleEnter(stage)}
                    disabled={disabled}
                  >
                    {locked ? "ロック中" : `エントリー (¥${stage.entryFee})`}
                  </button>
                  {!afford.ok && !locked && (
                    <p className="text-xs text-red-400 text-center">バンクロールが不足しています。</p>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
