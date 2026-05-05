import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GAME_VARIANT_CATEGORIES } from "../../games/config/variantCatalog.js";
import { listVariantProfiles } from "../../games/config/variantProfiles.js";
import { isControllerBackedAppVariant } from "../game/appVariantRouting.js";
import { usePlayerProgress } from "../hooks/usePlayerProgress.js";
import { computeUnlockState } from "../utils/playerProgress.js";
import { designTokens } from "../../styles/designTokens.js";
import { PRO_MIXED_PRESETS } from "../../config/mixed/proPresets.js";
import { LANGUAGE_STORAGE_KEY, MGX_DEFAULT_LOCALE } from "../../config/mgxLocaleConfig.js";
import variantJa from "../../i18n/variants.ja.json";

const CATEGORY_ORDER = [
  GAME_VARIANT_CATEGORIES.BOARD,
  GAME_VARIANT_CATEGORIES.TRIPLE_DRAW,
  GAME_VARIANT_CATEGORIES.SINGLE_DRAW,
  GAME_VARIANT_CATEGORIES.DRAMAHA,
  GAME_VARIANT_CATEGORIES.STUD,
  GAME_VARIANT_CATEGORIES.CHINESE,
];

const DEFAULT_CATEGORY = GAME_VARIANT_CATEGORIES.TRIPLE_DRAW;

const EN_CATEGORY_LABELS = Object.freeze({
  [GAME_VARIANT_CATEGORIES.BOARD]: "Board / Hold'em / Omaha",
  [GAME_VARIANT_CATEGORIES.TRIPLE_DRAW]: "Triple Draw",
  [GAME_VARIANT_CATEGORIES.SINGLE_DRAW]: "Single Draw",
  [GAME_VARIANT_CATEGORIES.DRAMAHA]: "Dramaha",
  [GAME_VARIANT_CATEGORIES.STUD]: "Stud",
  [GAME_VARIANT_CATEGORIES.CHINESE]: "Chinese / OFC",
});

const JA_CATEGORY_LABELS = Object.freeze({
  [GAME_VARIANT_CATEGORIES.BOARD]: "ボード / ホールデム / オマハ",
  [GAME_VARIANT_CATEGORIES.TRIPLE_DRAW]: "トリプルドロー",
  [GAME_VARIANT_CATEGORIES.SINGLE_DRAW]: "シングルドロー",
  [GAME_VARIANT_CATEGORIES.DRAMAHA]: "ドラマハ",
  [GAME_VARIANT_CATEGORIES.STUD]: "スタッド",
  [GAME_VARIANT_CATEGORIES.CHINESE]: "チャイニーズ / OFC",
});

const BETTING_LABELS = Object.freeze({
  en: {
    "no-limit": "No-limit",
    "fixed-limit": "Fixed-limit",
    "pot-limit": "Pot-limit",
  },
  ja: {
    "no-limit": "ノーリミット",
    "fixed-limit": "フィックスリミット",
    "pot-limit": "ポットリミット",
  },
});

const MIXED_PRESET_JA = Object.freeze({
  "mix-horse-pro": {
    name: "HORSE Pro",
    description: "プロシリーズで使われる5ゲームのフィックスリミットローテーションです。",
  },
  "mix-8game-pro": {
    name: "8-Game Pro",
    description: "WSOP形式に近い8ゲームのミックスローテーションです。",
  },
  "mix-10game-pro": {
    name: "10-Game Pro",
    description: "BadugiとNL 2-7 SDを加えた上位ミックスです。",
  },
  "mix-pro-dealers-choice": {
    name: "Dealer's Choice Pro",
    description: "禁止ゲーム設定を含む重み付きディーラーズチョイスです。",
  },
  "mix-pro-category": {
    name: "Category Rotation",
    description: "カテゴリ単位でゲームプールを切り替えるディーラーズチョイスです。",
  },
});

function localizeBettingLabel(value, language) {
  return BETTING_LABELS[language]?.[value] ?? value;
}

function readStoredLanguage() {
  if (typeof window === "undefined") return MGX_DEFAULT_LOCALE;
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? MGX_DEFAULT_LOCALE;
}

function localizeVariantProfile(profile, language) {
  if (!profile) return profile;
  const translation = language === "ja" ? variantJa[profile.id] : null;
  const name = translation?.name || profile.name;
  const description = translation?.description || profile.description || profile.summary;
  return {
    ...profile,
    name,
    description,
    bettingLabel: localizeBettingLabel(profile.betting, language),
    searchText: `${profile.id} ${name} ${description} ${(profile.tags ?? []).join(" ")}`.toLowerCase(),
  };
}

function localizeMixedPreset(preset, language) {
  if (language !== "ja") return preset;
  const translation = MIXED_PRESET_JA[preset.id];
  return {
    ...preset,
    name: translation?.name ?? preset.name,
    description: translation?.description ?? preset.description,
  };
}

function RequirementChips({ requirements, labels }) {
  if (!requirements) return null;
  const chips = [];
  if (requirements.needsBoardRenderer) chips.push(labels.board);
  if (requirements.needsDrawEngine) chips.push(labels.draw);
  if (requirements.needsStudEngine) chips.push(labels.stud);
  if (requirements.needsSplitPot) chips.push(labels.splitPot);
  if (requirements.needsBadugiEvaluator) chips.push(labels.badugiEval);
  if (requirements.needsHiLoEvaluator) chips.push(labels.hiLoEval);
  if (requirements.needsArchieEvaluator) chips.push(labels.archieEval);
  if (requirements.needsZeroEvaluator) chips.push(labels.zeroEval);
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

function getStatusBadge(profile, labels) {
  if (!profile) return { label: labels.statusUnknown, tone: "neutral" };
  if (profile.status === "live") {
    return { label: labels.statusLive, tone: "success" };
  }
  if (profile.status === "wip") {
    return { label: labels.statusWip, tone: "warning" };
  }
  return { label: labels.statusPlanned, tone: "muted" };
}

function VariantCard({ profile, onLaunch, copy }) {
  const badge = getStatusBadge(profile, copy);
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
      <RequirementChips requirements={profile.requirements} labels={copy.requirements} />
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{copy.betting}: {profile.bettingLabel ?? profile.betting}</span>
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
  language = readStoredLanguage(),
  onBack = null,
  onLaunchVariant = null,
}) {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState(DEFAULT_CATEGORY);
  const [search, setSearch] = useState("");
  const playerProgress = usePlayerProgress();
  const unlockState = computeUnlockState(playerProgress);
  const pendingStep =
    unlockState.chain.find((step) => !step.complete) ?? null;
  const isJapanese = language === "ja";
  const copy = useMemo(
    () =>
      isJapanese
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
        availableNow: "利用可能",
        lockedWorld: (label) => `世界大会クリアで解放（残り: ${label ?? "World"}）`,
        unlockWorld: "世界大会優勝で解放",
        openPrototype: "プロトタイプを開く",
        rouletteUi: "ルーレットUIを試す",
        advancedModes: {
          mixed: {
            title: "Mixed Game",
            description: "最大20枠のゲームローテーションをミックスビルダーで作成します。",
          },
          multigame: {
            title: "Multi-Game Tournament",
            description: "複数ゲーム対応MTTのプロトタイプロビーです。",
          },
          dealersChoice: {
            title: "Dealer's Choice",
            description: "次のゲームをルーレットで選ぶディーラーズチョイスを確認できます。",
          },
        },
        categoryLabels: JA_CATEGORY_LABELS,
        requirements: {
          board: "ボード",
          draw: "ドロー",
          stud: "スタッド",
          splitPot: "スプリット",
          badugiEval: "Badugi評価",
          hiLoEval: "ハイロー評価",
          archieEval: "Archie評価",
          zeroEval: "Zero評価",
        },
        statusLive: "プレイ可能",
        statusWip: "開発中",
        statusPlanned: "予定",
        statusUnknown: "不明",
        mixedPro: "ミックスPro",
        mode: "方式",
        selectionModes: {
          WEIGHTED: "重み付き",
          CATEGORY: "カテゴリ",
          FIXED: "固定",
        },
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
        availableNow: "Available now",
        lockedWorld: (label) => `Clear the world championship (remaining: ${label ?? "world"})`,
        unlockWorld: "Unlock by winning the world finals",
        openPrototype: "Open prototype",
        rouletteUi: "Try the roulette UI",
        advancedModes: {
          mixed: {
            title: "Mixed Game",
            description: "Create up to 20-slot rotations with the Mixed builder.",
          },
          multigame: {
            title: "Multi-Game Tournament",
            description: "Prototype lobby for multi-variant MTTs.",
          },
          dealersChoice: {
            title: "Dealer's Choice",
            description: "Preview the roulette animation that picks the next variant each hand.",
          },
        },
        categoryLabels: EN_CATEGORY_LABELS,
        requirements: {
          board: "Board",
          draw: "Draw",
          stud: "Stud",
          splitPot: "Split Pot",
          badugiEval: "Badugi Eval",
          hiLoEval: "Hi-Lo Eval",
          archieEval: "Archie Eval",
          zeroEval: "Zero Eval",
        },
        statusLive: "Live",
        statusWip: "In Progress",
        statusPlanned: "Planned",
        statusUnknown: "Unknown",
        mixedPro: "Mixed Pro",
        mode: "Mode",
        selectionModes: {
          WEIGHTED: "Weighted",
          CATEGORY: "Category",
          FIXED: "Fixed",
            },
          },
    [isJapanese],
  );

  const allProfiles = useMemo(
    () => listVariantProfiles().map((profile) => localizeVariantProfile(profile, language)),
    [language],
  );

  const variants = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query) {
      return allProfiles.filter((profile) => profile.searchText.includes(query));
    }
    return allProfiles.filter((profile) => profile.category === activeCategory);
  }, [activeCategory, allProfiles, search]);

  const advancedModes = useMemo(
    () => [
      {
        id: "mixed",
        title: copy.advancedModes.mixed.title,
        description: copy.advancedModes.mixed.description,
        locked: unlockState.mixedGameLocked,
        action: () => navigate("/mixed"),
        hint: unlockState.mixedGameLocked
          ? copy.lockedWorld(pendingStep?.label)
          : copy.availableNow,
      },
      {
        id: "multigame",
        title: copy.advancedModes.multigame.title,
        description: copy.advancedModes.multigame.description,
        locked: unlockState.multiGameLocked,
        action: () => navigate("/multigame"),
        hint: unlockState.multiGameLocked ? copy.unlockWorld : copy.openPrototype,
      },
      {
        id: "dealers-choice",
        title: copy.advancedModes.dealersChoice.title,
        description: copy.advancedModes.dealersChoice.description,
        locked: unlockState.dealerChoiceLocked,
        action: () => navigate("/dealers-choice"),
        hint: unlockState.dealerChoiceLocked ? copy.unlockWorld : copy.rouletteUi,
      },
    ],
    [copy, navigate, pendingStep, unlockState],
  );

  const mixedPresets = useMemo(
    () => PRO_MIXED_PRESETS.map((preset) => localizeMixedPreset(preset, language)),
    [language],
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
        <section className="bg-slate-900/70 border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
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
                {copy.categoryLabels[category]}
              </button>
            ))}
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
          {mixedPresets.map((preset) => (
            <div
              key={preset.id}
              className="p-5 rounded-3xl border border-white/10 bg-slate-900/70 flex flex-col gap-3"
            >
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-[0.3em]">
                  {copy.mixedPro}
                </p>
                <h3 className="text-xl font-semibold text-white">{preset.name}</h3>
                <p className="text-sm text-slate-300">{preset.description}</p>
              </div>
              <div className="text-xs text-slate-400">
                {copy.mode}: {copy.selectionModes[preset.selectionMode] ?? preset.selectionMode}
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

      </main>
    </div>
  );
}
