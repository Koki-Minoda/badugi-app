import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TOURNAMENT_STAGES, getStageById } from "../../config/tournamentStages";
import {
  getBlindSheetForStage,
  getProBlindSheetById,
  getProBlindSheetForStage,
} from "../../config/tournamentBlindSheets";
import {
  loadTournamentProgress,
  getStageEligibility,
  canAffordEntry,
  deductEntryFee,
} from "../utils/tournamentState";
import {
  createTournamentSession,
  loadActiveTournamentSession,
} from "../tournament/tournamentManager";
import { loadTitleSettings } from "../utils/titleSettings";
import { usePlayerProgress } from "../hooks/usePlayerProgress.js";
import { computeUnlockState } from "../utils/playerProgress.js";
import { useRatingState } from "../hooks/useRatingState.js";
import { computeRankFromRating } from "../utils/ratingState.js";
import FinalTableOverlay from "../components/FinalTableOverlay.jsx";

const BLIND_PREVIEW_ROWS = 6;

function formatRange([min, max]) {
  return min === max ? `${min}` : `${min}〜${max}`;
}

function formatNumber(value) {
  if (value == null) return "0";
  if (typeof value.toLocaleString === "function") {
    return value.toLocaleString("ja-JP");
  }
  return `${value}`;
}

function formatBreakInfo(sheet) {
  if (!sheet?.breakEveryLevels) return null;
  const duration = sheet.breakDurationMinutes
    ? `${sheet.breakDurationMinutes}分`
    : "";
  return `${sheet.breakEveryLevels}レベルごとに${duration || "休憩"}`;
}

export default function TournamentScreen() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(() => loadTournamentProgress());
  const [activeSession, setActiveSession] = useState(() =>
    loadActiveTournamentSession()
  );
  const heroProfile = useMemo(() => loadTitleSettings(), []);
  const playerProgress = usePlayerProgress();
  const unlockState = computeUnlockState(playerProgress);
  const pendingStep = unlockState.chain.find((step) => !step.complete);
  const ratingState = useRatingState();
  const rankInfo = computeRankFromRating(ratingState.globalRating);
  const nextTier = rankInfo.nextTier;
  const nextTierLabel = nextTier ? nextTier.label : "Legend";
  const progressPercent = Math.round((rankInfo.progress ?? 0) * 100);
  const currentStage = activeSession ? getStageById(activeSession.stageId) : null;
  const currentBreakSheet = currentStage ? getBlindSheetForStage(currentStage.id) : null;
  const [breakCountdown, setBreakCountdown] = useState(
    currentBreakSheet?.breakDurationMinutes ? currentBreakSheet.breakDurationMinutes * 60 : null
  );
  const [finalTableOpen, setFinalTableOpen] = useState(false);
  const [breakRunning, setBreakRunning] = useState(false);

  useEffect(() => {
    if (!currentBreakSheet?.breakDurationMinutes) {
      setBreakCountdown(null);
      return undefined;
    }
    const resetSeconds = currentBreakSheet.breakDurationMinutes * 60;
    setBreakCountdown(resetSeconds);
    const interval = setInterval(() => {
      setBreakCountdown((prev) => {
        if (prev == null) return resetSeconds;
        if (prev <= 1) {
          setBreakRunning((run) => !run);
          return resetSeconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentBreakSheet]);

  useEffect(() => {
    if (!currentStage || !activeSession) return;
    const shouldShow = activeSession.remainingPlayers <= currentStage.tableSize && activeSession.remainingPlayers > 1;
    setFinalTableOpen(shouldShow);
  }, [activeSession, currentStage]);

  useEffect(() => {
    function handleStorage(event) {
      if (
        event?.key &&
        !["progress.tournament", "session.tournament.active"].includes(
          event.key
        )
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

  const formatSeconds = (value) => {
    if (value == null) return "waiting...";
    const minutes = Math.floor(value / 60);
    const seconds = value % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const nextBreakLevels =
    currentBreakSheet?.breakEveryLevels ?? currentStage?.breakEveryLevels ?? null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="max-w-6xl mx-auto px-6 py-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-widest text-emerald-300">
            Tournament Mode
          </p>
          <h1 className="text-3xl font-extrabold">CPU トーナメント</h1>
        </div>
        <div className="flex flex-1 items-center gap-4">
          <div className="flex-1 rounded-2xl bg-slate-900/70 border border-white/10 px-5 py-4">
            <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wide mb-1">
              <span>Global Rating</span>
              <span>{rankInfo.label}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <p className="text-3xl font-bold text-white">{Math.round(ratingState.globalRating ?? 1500)}</p>
              <span className="text-xs text-slate-400">Next: {nextTierLabel}</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Skill {Math.round(ratingState.skillRating ?? 1500)} ／ Mixed {Math.round(ratingState.mixedRating ?? 1500)}
            </p>
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
        </div>
        {currentStage && currentBreakSheet && (
          <div className="flex flex-col gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            <div className="flex items-center justify-between">
              <span>Break timer</span>
              <span>{nextBreakLevels ? `Every ${nextBreakLevels} levels` : "Break schedule"}</span>
            </div>
            <div className="text-3xl font-semibold">
              {breakRunning ? "Running break" : "Next break in"} {formatSeconds(breakCountdown)}
            </div>
            <p className="text-xs text-emerald-100/80">
              Duration {currentBreakSheet.breakDurationMinutes} min · {currentBreakSheet.breakEveryLevels} levels between breaks
            </p>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-16 space-y-8">
        <section className="rounded-3xl bg-slate-900/80 border border-white/10 p-6 grid gap-6 md:grid-cols-3">
          <div>
            <p className="text-sm text-slate-400">バンクロール</p>
            <p className="text-3xl font-bold text-white">
              ¥{formatNumber(progress.bankroll ?? 0)}
            </p>
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

        <section className="rounded-3xl bg-slate-900/70 border border-white/10 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Unlock Progress</h2>
            <span className="text-xs text-amber-300">
              {unlockState.worldChampCleared
                ? `Advanced modes unlocked (clears: ${unlockState.clearCount}).`
                : `Next goal: ${
                    TOURNAMENT_STAGES.find((s) => s.id === pendingStep?.id)
                      ?.label ?? "World"
                  } victory.`}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {unlockState.chain.map((step) => {
              const label =
                TOURNAMENT_STAGES.find((stage) => stage.id === step.id)?.label ??
                step.label;
              return (
                <div
                  key={step.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 flex items-center justify-between"
                >
                  <span className="font-semibold text-sm">{label}</span>
                  <span
                    className={`text-xs font-bold ${
                      step.complete ? "text-emerald-300" : "text-slate-400"
                    }`}
                  >
                    {step.current} / {step.required}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            {[
              { label: "Mixed Game", locked: unlockState.mixedGameLocked },
              { label: "Multi-Game", locked: unlockState.multiGameLocked },
              { label: "Dealer's Choice", locked: unlockState.dealerChoiceLocked },
            ].map((mode) => (
              <span
                key={mode.label}
                className={`px-3 py-1 rounded-full border ${
                  mode.locked
                    ? "border-white/10 text-slate-400"
                    : "border-emerald-400/40 text-emerald-200"
                }`}
              >
                {mode.label}: {mode.locked ? "Locked" : "Unlocked"}
              </span>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          {TOURNAMENT_STAGES.map((stage) => {
            const eligibility = getStageEligibility(stage.id, progress);
            const afford = canAffordEntry(stage.id, progress);
            const locked = !eligibility.eligible;
            const disabled = locked || (!afford.ok && stage.entryFee > 0);
            const primaryPrize = stage.prizeTable[0];
            const proSheet =
              stage.proBlindSheetId
                ? getProBlindSheetById(stage.proBlindSheetId)
                : getProBlindSheetForStage(stage.id);
            const sheet = proSheet ?? getBlindSheetForStage(stage.id);
            const breakInfo = formatBreakInfo(sheet);
            const previewLevels = sheet?.levels?.slice(0, BLIND_PREVIEW_ROWS) ?? [];
            return (
              <article
                key={stage.id}
                className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 space-y-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-widest text-emerald-300">
                      {stage.label}
                    </p>
                    <h2 className="text-2xl font-bold text-white mt-1">
                      {stage.description}
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-300">
                      <span>参加費: ¥{formatNumber(stage.entryFee)}</span>
                      <span>人数: {formatRange(stage.participantsRange)} 人</span>
                      <span>初期スタック: {stage.startingStack}</span>
                      <span>
                        プライズ: 1位 ¥{formatNumber(primaryPrize?.payout ?? 0)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {stage.eligibility?.text}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 w-full lg:w-48">
                    <button
                      className={`rounded-xl py-3 font-semibold ${
                        disabled
                          ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                          : "bg-emerald-500 text-slate-900 hover:bg-emerald-400"
                      }`}
                      onClick={() => handleEnter(stage)}
                      disabled={disabled}
                    >
                      {locked ? "ロック中" : `エントリー (¥${formatNumber(stage.entryFee)})`}
                    </button>
                    {!afford.ok && !locked && (
                      <p className="text-xs text-red-400 text-center">
                        バンクロールが不足しています。
                      </p>
                    )}
                    {sheet.notes && (
                      <p className="mt-2 text-[12px] text-slate-300">{sheet.notes}</p>
                    )}
                  </div>
                </div>

                {sheet && (
                  <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 uppercase tracking-widest">
                      <span>
                        {proSheet ? "Pro Blind Structure" : "Blind Structure Preview"}
                      </span>
                      <span>
                        {sheet.levelDurationMinutes}分 / LEVEL
                        {breakInfo ? ` ・ ${breakInfo}` : ""}
                      </span>
                    </div>
                    <div className="mt-3 max-h-52 overflow-y-auto">
                      <table className="w-full text-left text-xs text-slate-200">
                        <thead className="text-[11px] text-slate-400 border-b border-white/5">
                          <tr>
                            <th className="py-2 pr-3 font-medium">Lv</th>
                            <th className="py-2 pr-3 font-medium">SB / BB</th>
                            <th className="py-2 pr-3 font-medium">Ante</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewLevels.map((lvl) => (
                            <tr key={`${stage.id}-lvl-${lvl.level}`} className="border-b border-white/5 last:border-b-0">
                              <td className="py-1.5 pr-3">{lvl.level}</td>
                              <td className="py-1.5 pr-3">
                                {formatNumber(lvl.sb)} / {formatNumber(lvl.bb)}
                              </td>
                              <td className="py-1.5 pr-3">
                                {lvl.ante ? formatNumber(lvl.ante) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {sheet.levels.length > previewLevels.length && (
                      <p className="mt-2 text-right text-[11px] text-slate-500">
                        他 {sheet.levels.length - previewLevels.length} レベル →
                        ゲーム内で確認
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>
        {activeSession?.tableBalanceLog?.length ? (
          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 space-y-3">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <p className="font-semibold text-white">Table Balancing Log</p>
              <span className="text-xs uppercase tracking-widest">Multi-table</span>
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              {activeSession.tableBalanceLog.slice(-3).reverse().map((entry, index) => (
                <div key={`${entry.timestamp}-${index}`} className="flex items-center justify-between bg-white/5 px-3 py-2 rounded-lg">
                  <span>{new Date(entry.timestamp).toLocaleTimeString("ja-JP")}</span>
                  <span className="text-emerald-300">{entry.message}</span>
                  <span className="text-[11px] truncate max-w-[160px]">
                    Seats: {entry.assignmentSnapshot || "n/a"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <FinalTableOverlay
        open={finalTableOpen}
        stageLabel={currentStage?.label ?? "Tournament"}
        remainingPlayers={activeSession?.remainingPlayers ?? 0}
        totalEntrants={activeSession?.totalEntrants ?? 0}
        balancedLogs={activeSession?.tableBalanceLog ?? []}
        onClose={() => setFinalTableOpen(false)}
      />
    </div>
  );
}
