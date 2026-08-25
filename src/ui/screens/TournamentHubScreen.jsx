import React, { useMemo, useState } from "react";
import {
  TOURNAMENT_STAGES,
  buildTournamentConfigFromStage,
  getStageBlindSheet,
} from "../../config/tournamentStages.js";
import {
  TOURNAMENT_VARIANTS,
  evaluateTournamentUnlocks,
  formatUnlockRequirement,
  getUnlockForVariant,
  getTournamentVariantById,
} from "../../config/tournamentUnlocks.js";
import { resolveAiTierForGameContext } from "../utils/aiTierContext.js";
import { loadConsolidatedProgress } from "../utils/consolidatedProgress.js";
import {
  clearActiveMTTSnapshot,
  isResumeableMTTSnapshot,
  loadActiveMTTSnapshot,
} from "../tournament/tournamentManager.js";

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : "--";
}

function buildStageViewModel(stage, unlockState) {
  const config = buildTournamentConfigFromStage(stage.id);
  const blindSheet = getStageBlindSheet(stage.id);
  const aiTier = resolveAiTierForGameContext({
    mode: "tournament-mtt",
    config: config ?? { stageId: stage.id },
  });
  const variantId =
    getTournamentVariantById(config?.gameVariant ?? stage.gameVariant)?.id ??
    config?.gameVariant ??
    stage.gameVariant ??
    "badugi";
  const variantUnlocked = unlockState.unlockedVariants.includes(variantId);
  const hasPlayableConfig =
    Boolean(config) &&
    Array.isArray(config.levels) &&
    config.levels.length > 0;

  return {
    stage,
    config,
    blindSheet,
    aiTier,
    playable: hasPlayableConfig && variantUnlocked,
    status: variantUnlocked ? "PLAYABLE" : "LOCKED",
    variantUnlocked,
    title: stage.tournamentName ?? config?.name ?? stage.label ?? stage.id,
    subtitle: stage.seriesLabel ?? stage.description ?? "",
    stageLabel: String(stage.id ?? "").toUpperCase(),
    aiTierLabel: aiTier?.label ?? "Standard",
    players: config?.totalPlayers ?? null,
    tables: config?.tables ?? null,
    startingStack: config?.startingStack ?? stage.startingStack ?? null,
    blindSheetLabel: blindSheet?.label ?? stage.blindSheetId ?? "COMING SOON",
  };
}

export default function TournamentHubScreen({
  stages = TOURNAMENT_STAGES,
  progress = null,
  activeSnapshot = null,
  onBack = null,
  onStartTournament = null,
  onResumeTournament = null,
  onRetireTournament = null,
}) {
  const [savedSnapshot, setSavedSnapshot] = useState(
    () => activeSnapshot ?? loadActiveMTTSnapshot(),
  );
  const effectiveProgress = useMemo(
    () => progress ?? loadConsolidatedProgress().tournament,
    [progress],
  );
  const resumeableSnapshot = isResumeableMTTSnapshot(savedSnapshot)
    ? savedSnapshot
    : null;
  const unlockState = useMemo(
    () => evaluateTournamentUnlocks(effectiveProgress),
    [effectiveProgress],
  );
  const stageViews = useMemo(
    () => stages.map((stage) => buildStageViewModel(stage, unlockState)),
    [stages, unlockState],
  );
  const [selectedStageId, setSelectedStageId] = useState(
    stageViews[0]?.stage?.id ?? null,
  );
  const selected =
    stageViews.find((view) => view.stage.id === selectedStageId) ??
    stageViews[0] ??
    null;

  const handleStart = () => {
    if (!selected?.playable || !selected.config) return;
    onStartTournament?.(selected.config, selected.stage);
  };
  const handleResume = () => {
    if (!resumeableSnapshot) return;
    onResumeTournament?.(resumeableSnapshot);
  };
  const handleRetire = () => {
    clearActiveMTTSnapshot();
    setSavedSnapshot(null);
    onRetireTournament?.();
  };

  return (
    <div className="min-h-screen bg-[#050507] px-5 py-6 text-slate-100 md:px-8 md:py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">
              Tournament Hub
            </p>
            <h1 className="mt-2 text-3xl font-black text-white">BADUGI SERIES</h1>
          </div>
          {onBack ? (
            <button
              type="button"
              className="w-fit rounded-md border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-200 hover:border-emerald-300/70 hover:text-emerald-100"
              onClick={onBack}
            >
              Back
            </button>
          ) : null}
        </header>

        <main className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <section className="grid gap-3 md:grid-cols-2" aria-label="Badugi Series">
            {stageViews.map((view) => {
              const active = view.stage.id === selected?.stage?.id;
              return (
                <button
                  key={view.stage.id}
                  type="button"
                  data-testid={`tournament-stage-${view.stage.id}`}
                  onClick={() => setSelectedStageId(view.stage.id)}
                  className={`rounded-lg border p-4 text-left transition ${
                    active
                      ? "border-emerald-300/70 bg-emerald-300/10"
                      : "border-white/10 bg-slate-950/80 hover:border-white/25 hover:bg-slate-900/80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
                        {view.stageLabel}
                      </p>
                      <h2 className="mt-1 text-lg font-black uppercase text-white">
                        {view.title}
                      </h2>
                      <p className="mt-1 text-sm font-semibold text-slate-300">
                        {view.subtitle}
                      </p>
                    </div>
                    {!view.variantUnlocked ? (
                      <span className="rounded-md border border-red-300/40 px-2 py-1 text-[10px] font-black uppercase text-red-200">
                        Locked
                      </span>
                    ) : !view.playable ? (
                      <span className="rounded-md border border-amber-300/40 px-2 py-1 text-[10px] font-black uppercase text-amber-200">
                        Coming Soon
                      </span>
                    ) : null}
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <div>
                      <dt className="font-black uppercase tracking-wide text-slate-500">AI</dt>
                      <dd>AI: {view.aiTierLabel}</dd>
                    </div>
                    <div>
                      <dt className="font-black uppercase tracking-wide text-slate-500">Players</dt>
                      <dd>{formatNumber(view.players)}</dd>
                    </div>
                    <div>
                      <dt className="font-black uppercase tracking-wide text-slate-500">Stack</dt>
                      <dd>{formatNumber(view.startingStack)}</dd>
                    </div>
                    <div>
                      <dt className="font-black uppercase tracking-wide text-slate-500">Blinds</dt>
                      <dd className="truncate">{view.blindSheetLabel}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
                    {view.status}
                  </p>
                </button>
              );
            })}
          </section>

          <aside
            className="rounded-lg border border-white/10 bg-slate-950/88 p-5"
            data-testid="tournament-stage-detail"
          >
            {selected ? (
              <>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
                  {selected.stageLabel}
                </p>
                <h2 className="mt-2 text-2xl font-black uppercase text-white">
                  {selected.title}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-300">
                  {selected.subtitle}
                </p>

                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                    <dt className="text-slate-400">Players</dt>
                    <dd className="font-black text-white">{formatNumber(selected.players)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                    <dt className="text-slate-400">Tables</dt>
                    <dd className="font-black text-white">{formatNumber(selected.tables)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                    <dt className="text-slate-400">Starting Stack</dt>
                    <dd className="font-black text-white">
                      {formatNumber(selected.startingStack)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                    <dt className="text-slate-400">AI Tier</dt>
                    <dd className="font-black text-white">{selected.aiTierLabel}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                    <dt className="text-slate-400">Blind Sheet</dt>
                    <dd className="text-right font-black text-white">
                      {selected.blindSheetLabel}
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  data-testid="tournament-start"
                  disabled={!selected.playable}
                  onClick={handleStart}
                  className="mt-6 w-full rounded-md bg-emerald-400 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {selected.variantUnlocked
                    ? selected.playable
                      ? "Start Tournament"
                      : "Coming Soon"
                    : "Locked"}
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-400">COMING SOON</p>
            )}
          </aside>
        </main>

        {resumeableSnapshot ? (
          <section
            className="rounded-lg border border-yellow-300/25 bg-yellow-300/10 p-4"
            data-testid="tournament-resume-panel"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-yellow-200">
                  Active Save
                </p>
                <h2 className="mt-1 text-lg font-black text-white">
                  Resume Tournament
                </h2>
                <p className="text-sm text-slate-300">
                  {resumeableSnapshot.config?.name ?? "Tournament"} · Players{" "}
                  {formatNumber(resumeableSnapshot.tournamentState?.playersRemaining)}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  data-testid="tournament-resume"
                  onClick={handleResume}
                  className="rounded-md bg-yellow-300 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-950 hover:bg-yellow-200"
                >
                  Resume Tournament
                </button>
                <button
                  type="button"
                  data-testid="tournament-retire"
                  onClick={handleRetire}
                  className="rounded-md border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-200 hover:border-red-300/60 hover:text-red-100"
                >
                  Retire Tournament
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section
          className="rounded-lg border border-white/10 bg-slate-950/70 p-4"
          aria-label="Variant Unlocks"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white">
              Variant Unlocks
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            {TOURNAMENT_VARIANTS.map((variant) => {
              const unlocked = unlockState.unlockedVariants.includes(variant.id);
              const unlock = getUnlockForVariant(variant.id);
              return (
                <div
                  key={variant.id}
                  data-testid={`variant-unlock-${variant.id}`}
                  className={`rounded-md border p-3 ${
                    unlocked
                      ? "border-emerald-300/40 bg-emerald-300/10"
                      : "border-white/10 bg-slate-900/80"
                  }`}
                >
                  <p className="text-sm font-black text-white">{variant.label}</p>
                  <p
                    className={`mt-2 text-[10px] font-black uppercase tracking-[0.18em] ${
                      unlocked ? "text-emerald-200" : "text-slate-400"
                    }`}
                  >
                    {unlocked ? "PLAYABLE" : "LOCKED"}
                  </p>
                  {!unlocked && unlock ? (
                    <p className="mt-2 text-xs text-slate-400">
                      Win {formatUnlockRequirement(unlock).replace(/^Win /, "")}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
