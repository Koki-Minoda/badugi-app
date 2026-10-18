import { useLanguage } from '../preferences/language.js';
import LanguageSelect from '../preferences/LanguageSelect.jsx';
import StructureEditor from '../tournament/StructureEditor.jsx';
import { applyCustomStructure, readStructure } from '../tournament/customStructure.js';
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  canAffordEntry,
  getStageEligibility,
} from "../utils/tournamentState.js";
import {
  clearActiveMTTSnapshot,
  isResumeableMTTSnapshot,
  loadActiveMTTSnapshot,
} from "../tournament/tournamentManager.js";

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : "--";
}

function buildStageViewModel(stage, unlockState, progress) {
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
  const isCanonicalStage = TOURNAMENT_STAGES.some(({ id }) => id === stage.id);
  const eligibility = isCanonicalStage
    ? getStageEligibility(stage.id, progress)
    : { eligible: true, reason: stage.eligibility?.text ?? "" };
  const affordability = isCanonicalStage
    ? canAffordEntry(stage.id, progress)
    : {
        ok: (progress?.bankroll ?? 0) >= (stage.entryFee ?? 0),
        remaining: (progress?.bankroll ?? 0) - (stage.entryFee ?? 0),
        reason: "",
      };
  const hasPlayableConfig =
    Boolean(config) &&
    Array.isArray(config.levels) &&
    config.levels.length > 0;

  return {
    stage,
    config,
    blindSheet,
    aiTier,
    playable:
      hasPlayableConfig &&
      variantUnlocked &&
      eligibility.eligible &&
      affordability.ok,
    status:
      variantUnlocked && eligibility.eligible && affordability.ok
        ? "PLAYABLE"
        : "LOCKED",
    variantUnlocked,
    eligibility,
    affordability,
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
  const ja = useLanguage() === 'ja';
  const [custom, setCustom] = useState(false);
  const [structure, setStructure] = useState(() => readStructure(buildTournamentConfigFromStage('store').levels));
  const [structureMessage, setStructureMessage] = useState('');
  const [savedSnapshot, setSavedSnapshot] = useState(
    () => activeSnapshot ?? loadActiveMTTSnapshot(),
  );
  const startPendingRef = useRef(false);
  const [startError, setStartError] = useState(null);
  useEffect(() => {
    if (activeSnapshot) setSavedSnapshot(activeSnapshot);
  }, [activeSnapshot]);
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
    () => stages.map((stage) => buildStageViewModel(stage, unlockState, effectiveProgress)),
    [effectiveProgress, stages, unlockState],
  );
  const [selectedStageId, setSelectedStageId] = useState(
    stageViews[0]?.stage?.id ?? null,
  );
  const selectedStage =
    stageViews.find((view) => view.stage.id === selectedStageId) ??
    stageViews[0] ??
    null;
  const customBase = buildTournamentConfigFromStage('store');
  const selected = custom ? { ...stageViews.find(v => v.stage.id === 'store'), stage:TOURNAMENT_STAGES[0], config:customBase, stageLabel:ja?'練習大会':'Practice', title:structure.name, subtitle:ja?'CPUと対局。成績や参加条件には影響しません。':'Play against CPUs. Does not affect career progress or unlocks.', players:customBase.totalPlayers, tables:customBase.tables, startingStack:structure.startingStack, aiTierLabel:stageViews[0]?.aiTierLabel ?? 'Standard', blindSheetLabel:structure.name, variantUnlocked:true, playable:true, eligibility:{eligible:true}, affordability:{ok:true} } : selectedStage;
  const canStartSelected = Boolean((custom || selected?.playable) && !resumeableSnapshot);

  const handleStart = () => {
    if (!canStartSelected || !selected?.config || startPendingRef.current) return;
    startPendingRef.current = true;
    setStartError(null);
    try {
      const started = onStartTournament?.(custom ? applyCustomStructure(buildTournamentConfigFromStage('store'), structure) : selected.config, custom ? TOURNAMENT_STAGES[0] : selected.stage);
      if (started === false) {
        setStartError("大会を開始できませんでした。進行条件と残高を確認してください。");
        startPendingRef.current = false;
      }
    } catch {
      startPendingRef.current = false;
      setStartError(ja ? '大会を開始できませんでした。設定の名前と数値を確認してください。' : 'Could not start. Check the structure name and values.');
    }
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
              {ja ? '大会を選ぶ' : 'Tournament Hub'}
            </p>
            <h1 className="mt-2 text-3xl font-black text-white">BADUGI SERIES</h1>
          </div>
          {onBack ? (
            <button
              type="button"
              className="w-fit rounded-md border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-200 hover:border-emerald-300/70 hover:text-emerald-100"
              onClick={onBack}
            >
              {ja ? '戻る' : 'Back'}
            </button>
          ) : null}
        </header>

        <LanguageSelect />
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={custom} onChange={e => setCustom(e.target.checked)} />{ja ? '自分で設定した練習大会を開く（Badugi）' : 'Create a custom practice tournament (Badugi)'}</label>
        {custom && <StructureEditor draft={structure} onChange={setStructure} baseLevels={buildTournamentConfigFromStage('store').levels} ja={ja} onMessage={setStructureMessage} />}
        {structureMessage && <p role="status">{structureMessage}</p>}
        <main className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <section className="grid gap-3 md:grid-cols-2" aria-label="Badugi Series">
            {!custom && stageViews.map((view) => {
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
                        {ja ? '参加条件あり' : 'Locked'}
                      </span>
                    ) : !view.eligibility.eligible || !view.affordability.ok ? (
                      <span className="rounded-md border border-red-300/40 px-2 py-1 text-[10px] font-black uppercase text-red-200">
                        {ja ? '参加条件あり' : 'Locked'}
                      </span>
                    ) : !view.playable ? (
                      <span className="rounded-md border border-amber-300/40 px-2 py-1 text-[10px] font-black uppercase text-amber-200">
                        {ja ? '準備中' : 'Coming Soon'}
                      </span>
                    ) : null}
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <div>
                      <dt className="font-black uppercase tracking-wide text-slate-500">AI</dt>
                      <dd>AI: {view.aiTierLabel}</dd>
                    </div>
                    <div>
                      <dt className="font-black uppercase tracking-wide text-slate-500">{ja ? '参加人数' : 'Players'}</dt>
                      <dd>{formatNumber(view.players)}</dd>
                    </div>
                    <div>
                      <dt className="font-black uppercase tracking-wide text-slate-500">{ja ? '開始持ち点' : 'Stack'}</dt>
                      <dd>{formatNumber(view.startingStack)}</dd>
                    </div>
                    <div>
                      <dt className="font-black uppercase tracking-wide text-slate-500">{ja ? 'ストラクチャー' : 'Blinds'}</dt>
                      <dd className="truncate">{view.blindSheetLabel}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
                    {ja ? (view.status === 'PLAYABLE' ? '参加できます' : '参加条件あり') : view.status}
                  </p>
                  {!view.eligibility.eligible ? (
                    <p className="mt-2 text-xs font-semibold text-red-200">
                      {view.eligibility.reason}
                    </p>
                  ) : !view.affordability.ok ? (
                    <p className="mt-2 text-xs font-semibold text-red-200">
                      {view.affordability.reason}
                    </p>
                  ) : null}
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
                    <dt className="text-slate-400">{ja ? '参加人数' : 'Players'}</dt>
                    <dd className="font-black text-white">{formatNumber(selected.players)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                    <dt className="text-slate-400">{ja ? '卓数' : 'Tables'}</dt>
                    <dd className="font-black text-white">{formatNumber(selected.tables)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                    <dt className="text-slate-400">{ja ? '開始持ち点' : 'Starting Stack'}</dt>
                    <dd className="font-black text-white">
                      {formatNumber(selected.startingStack)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                    <dt className="text-slate-400">{ja ? 'CPUの強さ' : 'AI Tier'}</dt>
                    <dd className="font-black text-white">{selected.aiTierLabel}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                    <dt className="text-slate-400">{ja ? 'ストラクチャー' : 'Blind Sheet'}</dt>
                    <dd className="text-right font-black text-white">
                      {selected.blindSheetLabel}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                    <dt className="text-slate-400">{ja ? '参加費 / 持ち点' : 'Entry / Bankroll'}</dt>
                    <dd className="text-right font-black text-white">
                      {custom ? (ja ? '無料（持ち点の消費なし）' : 'Free — no bankroll deduction') : `${formatNumber(selected.stage.entryFee)} / ${formatNumber(effectiveProgress.bankroll)}`}
                    </dd>
                  </div>
                </dl>

                <details className="mt-4"><summary className="min-h-11 cursor-pointer py-2 text-emerald-200">{ja ? 'ストラクチャーを見る' : 'View structure'}</summary><p className="my-2 text-sm">{custom ? `${structure.levelMinutes}${ja ? '分ごと・ハンド終了後に上昇' : ' minutes per level; rises after the hand'}` : (ja ? '各卓で規定ハンド数を終えると次のレベルへ進みます。' : 'The next level starts after every table completes its required hands.')}</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>Lv</th><th>SB / BB</th><th>{ja ? 'ベット単位' : 'Bet sizes'}</th><th>Ante</th><th>{ja ? 'ハンド' : 'Hands'}</th></tr></thead><tbody>{(custom ? structure.levels : (selected.config?.levels ?? [])).map((level,i) => <tr key={i} className="border-t border-white/15"><td className="py-2">{i+1}</td><td>{level.sb}/{level.bb}</td><td>{level.bb}/{level.bb*2}</td><td>{level.ante}</td><td>{custom ? '—' : level.handsThisLevel ?? level.hands}</td></tr>)}</tbody></table></div><p className="mt-2 text-sm">{ja ? '再参加なし。種目はBadugi固定です。' : 'No re-entry. Badugi throughout.'}</p><p className="mt-2 text-sm">{(custom ? structure.breakEvery : selected.config?.breakEveryLevels) ? `${ja ? '休憩' : 'Break'}: ${custom ? structure.breakEvery : selected.config?.breakEveryLevels} Lv / ${custom ? structure.breakMinutes : selected.config?.breakDurationMinutes} ${ja ? '分' : 'min'}` : (ja ? '休憩なし' : 'No breaks')}</p></details>
                {!selected.eligibility.eligible || !selected.affordability.ok ? (
                  <p className="mt-4 text-sm font-semibold text-red-200" role="status">
                    {!selected.eligibility.eligible
                      ? selected.eligibility.reason
                      : selected.affordability.reason}
                  </p>
                ) : null}

                {startError ? (
                  <p className="mt-4 text-sm font-semibold text-red-200" role="alert">
                    {startError}
                  </p>
                ) : null}

                {resumeableSnapshot ? (
                  <p className="mt-4 text-sm font-semibold text-yellow-200" role="status">
                    {ja ? '進行中の大会を再開するかリタイアしてから、新しい大会を開始してください。' : 'Resume or retire the current tournament before starting another.'}
                  </p>
                ) : null}

                <button
                  type="button"
                  data-testid="tournament-start"
                  disabled={!canStartSelected}
                  onClick={handleStart}
                  className="mt-6 w-full rounded-md bg-emerald-400 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {custom ? (ja ? "練習大会を開始" : "Start practice tournament") : selected.variantUnlocked && selected.eligibility.eligible && selected.affordability.ok
                    ? selected.playable
                      ? (ja ? "大会を開始" : "Start Tournament")
                      : (ja ? "準備中" : "Coming Soon")
                    : (ja ? "参加条件あり" : "Locked")}
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
                  {ja ? '進行中の大会' : 'Active Save'}
                </p>
                <h2 className="mt-1 text-lg font-black text-white">
                  {ja ? '大会を再開' : 'Resume Tournament'}
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
                  {ja ? '大会を再開' : 'Resume Tournament'}
                </button>
                <button
                  type="button"
                  data-testid="tournament-retire"
                  onClick={handleRetire}
                  className="rounded-md border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-200 hover:border-red-300/60 hover:text-red-100"
                >
                  {ja ? 'リタイア' : 'Retire Tournament'}
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
              {ja ? '大会で遊べる種目' : 'Variant Unlocks'}
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
                    {unlocked ? (ja ? '遊べます' : 'Playable') : (ja ? '参加条件あり' : 'Locked')}
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
