import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GAME_VARIANT_CATEGORIES } from "../../games/config/variantCatalog.js";
import {
  VARIANT_CATEGORY_LABELS,
  listVariantProfiles,
  searchVariantProfiles,
  variantStatusBadge,
} from "../../games/config/variantProfiles.js";
import { isControllerBackedAppVariant } from "../game/appVariantRouting.js";
import { usePlayerProgress } from "../hooks/usePlayerProgress.js";
import { computeUnlockState } from "../utils/playerProgress.js";
import { designTokens } from "../../styles/designTokens.js";
import { PRO_MIXED_PRESETS } from "../../config/mixed/proPresets.js";
import { MGX_DEFAULT_LOCALE, MGX_LOCALES } from "../../config/mgxLocaleConfig.js";

const CATEGORY_ORDER = [
  GAME_VARIANT_CATEGORIES.BOARD,
  GAME_VARIANT_CATEGORIES.TRIPLE_DRAW,
  GAME_VARIANT_CATEGORIES.SINGLE_DRAW,
  GAME_VARIANT_CATEGORIES.DRAMAHA,
  GAME_VARIANT_CATEGORIES.STUD,
];

function RequirementChips({ requirements }) {
  if (!requirements) return null;
  const chips = [];
  if (requirements.needsBoardRenderer) chips.push("Board");
  if (requirements.needsDrawEngine) chips.push("Draw");
  if (requirements.needsStudEngine) chips.push("Stud");
  if (requirements.needsSplitPot) chips.push("Split Pot");
  if (requirements.needsBadugiEvaluator) chips.push("Badugi Eval");
  if (requirements.needsHiLoEvaluator) chips.push("Hi-Lo Eval");
  if (requirements.needsArchieEvaluator) chips.push("Archie Eval");
  if (requirements.needsZeroEvaluator) chips.push("Zero Eval");
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {chips.map((chip) => (
        <span
          key={chip}
          className="px-2 py-1 rounded-full bg-slate-800 text-slate-200 border border-white/10"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

function VariantCard({ profile, onLaunch, copy }) {
  const badge = variantStatusBadge(profile);
  const launchVariantId = profile.engineKey ?? profile.id;
  const canLaunch = Boolean(launchVariantId && isControllerBackedAppVariant(launchVariantId));
  return (
    <div
      className={`p-4 bg-slate-900/80 border rounded-2xl flex flex-col gap-3 ${
        canLaunch ? "border-emerald-400/30" : "border-white/10"
      }`}
      data-testid={`game-selector-card-${launchVariantId}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">{profile.id}</p>
          <h3 className="text-xl font-semibold">{profile.name}</h3>
        </div>
        <span
          className={`px-3 py-1 text-xs rounded-full ${
            badge.tone === "success"
              ? "bg-emerald-500/20 text-emerald-200"
              : badge.tone === "warning"
              ? "bg-amber-500/20 text-amber-200"
              : "bg-slate-700 text-slate-300"
          }`}
        >
          {badge.label}
        </span>
      </div>

      <p className="text-sm text-slate-300">{profile.description || profile.summary}</p>
      <RequirementChips requirements={profile.requirements} />
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{copy.betting}: {profile.betting}</span>
        <span>{copy.priority}: {profile.priorityPhase || "-"}</span>
      </div>
      <button
        type="button"
        onClick={() => canLaunch && onLaunch(profile)}
        disabled={!canLaunch}
        aria-label={`${copy.play}: ${profile.name}`}
        data-testid={`game-selector-play-${launchVariantId}`}
        className={`mt-1 px-4 py-2 rounded-lg font-semibold transition ${
          canLaunch
            ? "bg-emerald-500 text-slate-900 hover:bg-emerald-400"
            : "bg-slate-800 text-slate-500 cursor-not-allowed"
        }`}
      >
        {canLaunch ? copy.play : copy.comingSoon}
      </button>
    </div>
  );
}

export default function GameSelectorScreen({
  language = MGX_DEFAULT_LOCALE,
  onBack = null,
  onLaunchVariant = null,
}) {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState(CATEGORY_ORDER[0]);
  const [search, setSearch] = useState("");
  const playerProgress = usePlayerProgress();
  const unlockState = computeUnlockState(playerProgress);
  const pendingStep =
    unlockState.chain.find((step) => !step.complete) ?? null;
  const advancedModes = useMemo(
    () => [
      {
        id: "mixed",
        title: "Mixed Game",
        description: "Create up to 20-slot rotations with the Mixed builder.",
        locked: unlockState.mixedGameLocked,
        action: () => navigate("/mixed"),
        hint: unlockState.mixedGameLocked
          ? `Clear the world championship (remaining: ${pendingStep?.label ?? "world"})`
          : "Available now",
      },
      {
        id: "multigame",
        title: "Multi-Game Tournament",
        description: "Prototype lobby for multi-variant MTTs.",
        locked: unlockState.multiGameLocked,
        action: () => navigate("/multigame"),
        hint: unlockState.multiGameLocked ? "Unlock by winning the world finals" : "Open prototype",
      },
      {
        id: "dealers-choice",
        title: "Dealer's Choice",
        description: "Preview the roulette animation that picks the next variant each hand.",
        locked: unlockState.dealerChoiceLocked,
        action: () => navigate("/dealers-choice"),
        hint: unlockState.dealerChoiceLocked ? "Unlock by winning the world finals" : "Try the roulette UI",
      },
    ],
    [navigate, pendingStep, unlockState]
  );
  const isJapanese = language === "ja";
  const copy = isJapanese
    ? {
        eyebrow: "キャッシュゲーム",
        title: "ゲームを選択",
        description:
          "遊びたいゲームを選ぶと、そのままキャッシュゲームを開始します。現在プレイ可能なゲームは緑のボタンで表示されます。",
        mainMenu: "ゲーム選択へ戻る",
        mixedBuilder: "ミックスビルダー",
        advancedMode: "拡張モード",
        launch: "開く",
        mixedLoad: "Mixed Builderで読み込む",
        search: "ゲームを検索...",
        clear: "クリア",
        showing: (count) => `${count}件のゲームを表示中`,
        play: "このゲームで開始",
        comingSoon: "準備中",
        betting: "ベット",
        priority: "優先フェーズ",
      }
    : {
        eyebrow: "Cash Game",
        title: "Select Your Variant",
        description:
          "Choose a game to start a cash table. Playable variants are shown with green action buttons.",
        mainMenu: "Game Select",
        mixedBuilder: "Mixed Builder",
        advancedMode: "Advanced Mode",
        launch: "Launch",
        mixedLoad: "Load in Mixed Builder",
        search: "Search variants...",
        clear: "Clear",
        showing: (count) => `Showing ${count} variant${count === 1 ? "" : "s"}`,
        play: "Start This Game",
        comingSoon: "Coming Soon",
        betting: "Betting",
        priority: "Priority Phase",
      };

const variants = useMemo(() => {
  if (search.trim()) {
    return searchVariantProfiles(search);
  }
  return listVariantProfiles({ category: activeCategory });
}, [activeCategory, search]);

const playableProfiles = useMemo(
  () =>
    listVariantProfiles()
      .filter((profile) => isControllerBackedAppVariant(profile.engineKey ?? profile.id))
      .sort((a, b) => (a.priorityPhase ?? 99) - (b.priorityPhase ?? 99)),
  [],
);

const handleLaunch = (profile) => {
  const variantId = profile.engineKey ?? profile.id;
  if (!variantId || !isControllerBackedAppVariant(variantId)) return;
  if (typeof onLaunchVariant === "function") {
    onLaunchVariant(variantId);
    return;
  }
  navigate(`/game?variant=${variantId}`);
};

const quickLoadPreset = (presetId) => {
  navigate(`/mixed?preset=${presetId}`);
};

  return (
    <div
      className="min-h-screen"
      style={{
        background: `radial-gradient(115% 125% at 50% 0%, ${designTokens.colors.surface} 0%, ${designTokens.colors.background} 70%)`,
        color: designTokens.colors.textStrong,
      }}
    >
      <header className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">{copy.eyebrow}</p>
          <h1 className="text-3xl font-extrabold">{copy.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">{copy.description}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => (typeof onBack === "function" ? onBack() : navigate("/menu"))}
            className="px-4 py-2 rounded-full border border-white/20 hover:bg-white/10 transition text-sm"
          >
            {copy.mainMenu}
          </button>
          <button
            onClick={() => navigate("/mixed")}
            className="px-4 py-2 rounded-full border border-emerald-400/40 text-emerald-200 hover:bg-emerald-400/10 transition text-sm"
          >
            {copy.mixedBuilder}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-16 space-y-8">
        <section className="rounded-3xl border border-emerald-400/25 bg-emerald-500/5 p-6 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">
              {isJapanese ? "プレイ可能" : "Playable Now"}
            </p>
            <h2 className="text-2xl font-bold">
              {isJapanese ? "すぐに開始できるゲーム" : "Start a Cash Game"}
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {playableProfiles.map((profile) => (
              <VariantCard
                key={`playable-${profile.id}`}
                profile={profile}
                onLaunch={handleLaunch}
                copy={copy}
              />
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {advancedModes.map((mode) => {
            const disabled = mode.locked || !mode.action;
            return (
              <div
                key={mode.id}
                className={`p-5 rounded-3xl border ${
                  disabled
                    ? "border-white/5 bg-slate-900/50 opacity-70"
                    : "border-emerald-400/40 bg-slate-900/70"
                }`}
              >
                <p className="text-xs uppercase tracking-widest text-slate-400">
                  {copy.advancedMode}
                </p>
                <h3 className="text-2xl font-semibold mt-1">{mode.title}</h3>
                <p className="text-sm text-slate-300 mt-2">{mode.description}</p>
                <button
                  type="button"
                  onClick={() => mode.action && mode.action()}
                  disabled={disabled}
                  className={`mt-4 w-full px-4 py-2 rounded-xl font-semibold transition ${
                    disabled
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-emerald-500 text-slate-900 hover:bg-emerald-400"
                  }`}
                >
                  {disabled ? copy.comingSoon : copy.launch}
                </button>
                <p className="text-xs text-amber-300 mt-2">{mode.hint}</p>
              </div>
            );
          })}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {PRO_MIXED_PRESETS.map((preset) => (
            <div
              key={preset.id}
              className="p-5 rounded-3xl border border-white/10 bg-slate-900/70 flex flex-col gap-3"
            >
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-[0.3em]">
                  Mixed Pro
                </p>
                <h3 className="text-xl font-semibold text-white">{preset.name}</h3>
                <p className="text-sm text-slate-300">{preset.description}</p>
              </div>
              <div className="text-xs text-slate-400">
                Mode:{" "}
                {preset.selectionMode === "WEIGHTED"
                  ? "Weighted"
                  : preset.selectionMode === "CATEGORY"
                  ? "Category"
                  : "Fixed"}
              </div>
              <button
                type="button"
                onClick={() => quickLoadPreset(preset.id)}
                className="mt-1 px-4 py-2 rounded-xl bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400 transition text-sm"
              >
                {copy.mixedLoad}
              </button>
            </div>
          ))}
        </section>

        <section className="bg-slate-900/70 border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap gap-3">
            {CATEGORY_ORDER.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                  category === activeCategory
                    ? "bg-emerald-500 text-slate-900"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {VARIANT_CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              type="search"
              placeholder={copy.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl bg-slate-950/60 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"
                onClick={() => setSearch("")}
              >
                {copy.clear}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {copy.showing(variants.length)}
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {variants.map((profile) => (
            <VariantCard key={profile.id} profile={profile} onLaunch={handleLaunch} copy={copy} />
          ))}
        </section>
      </main>
    </div>
  );
}
