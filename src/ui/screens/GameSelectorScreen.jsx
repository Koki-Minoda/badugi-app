import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GAME_VARIANT_CATEGORIES } from "../../games/config/variantCatalog.js";
import {
  VARIANT_CATEGORY_LABELS,
  listVariantProfiles,
  searchVariantProfiles,
  variantStatusBadge,
} from "../../games/config/variantProfiles.js";
import { usePlayerProgress } from "../hooks/usePlayerProgress.js";
import { computeUnlockState } from "../utils/playerProgress.js";
import { designTokens } from "../../styles/designTokens.js";
import { PRO_MIXED_PRESETS } from "../../config/mixed/proPresets.js";

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

function VariantCard({ profile, onLaunch }) {
  const badge = variantStatusBadge(profile);
  const canLaunch = profile.status === "live" && profile.engineKey;
  return (
    <div className="p-4 bg-slate-900/80 border border-white/10 rounded-2xl flex flex-col gap-3">
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
        <span>Betting: {profile.betting}</span>
        <span>Priority: Phase {profile.priorityPhase || "-"}</span>
      </div>
      <button
        type="button"
        onClick={() => canLaunch && onLaunch(profile)}
        disabled={!canLaunch}
        className={`mt-1 px-4 py-2 rounded-lg font-semibold transition ${
          canLaunch
            ? "bg-emerald-500 text-slate-900 hover:bg-emerald-400"
            : "bg-slate-800 text-slate-500 cursor-not-allowed"
        }`}
      >
        {canLaunch ? "Play in Dev Table" : "Coming Soon"}
      </button>
    </div>
  );
}

export default function GameSelectorScreen() {
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

const variants = useMemo(() => {
  if (search.trim()) {
    return searchVariantProfiles(search);
  }
  return listVariantProfiles({ category: activeCategory });
}, [activeCategory, search]);

const handleLaunch = (profile) => {
  if (profile.engineKey) {
    navigate(`/game?game=${profile.engineKey}`);
  }
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
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">Game Catalog</p>
          <h1 className="text-3xl font-extrabold">Select Your Variant</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/menu")}
            className="px-4 py-2 rounded-full border border-white/20 hover:bg-white/10 transition text-sm"
          >
            Main Menu
          </button>
          <button
            onClick={() => navigate("/mixed")}
            className="px-4 py-2 rounded-full border border-emerald-400/40 text-emerald-200 hover:bg-emerald-400/10 transition text-sm"
          >
            Mixed Builder
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-16 space-y-8">
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
                  Advanced Mode
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
                  {disabled ? "COMING SOON" : "Launch"}
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
                Mixed Builderで読み込む
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
              placeholder="Search variants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl bg-slate-950/60 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"
                onClick={() => setSearch("")}
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Showing {variants.length} variant{variants.length === 1 ? "" : "s"}
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {variants.map((profile) => (
            <VariantCard key={profile.id} profile={profile} onLaunch={handleLaunch} />
          ))}
        </section>
      </main>
    </div>
  );
}
