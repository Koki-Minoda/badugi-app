import { useLanguage } from '../preferences/language.js';
import LanguageSelect from '../preferences/LanguageSelect.jsx';
import ShareLink from '../sharing/ShareLink.jsx';
import { sharedMixUrl } from '../sharing/mixShare.js';
import { resolveInitialGame } from "../mixed/rotationUtils.js";
import { normalizeAppVariantId } from "../game/appVariantRouting.js";
import { LEARNING_PRESETS } from "../learning/learningCatalog.js";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { GAME_VARIANT_CATEGORIES } from "../../games/config/variantCatalog.js";
import {
  VARIANT_CATEGORY_LABELS,
  listVariantProfiles,
  getVariantProfile,
} from "../../games/config/variantProfiles.js";
import { useMixedGame } from "../mixed/useMixedGame.js";
import { usePlayerProgress } from "../hooks/usePlayerProgress.js";
import { computeUnlockState } from "../utils/playerProgress.js";
import { designTokens } from "../../styles/designTokens.js";
import { LANGUAGE_STORAGE_KEY, MGX_DEFAULT_LOCALE } from "../../config/mgxLocaleConfig.js";
import variantJa from "../../i18n/variants.ja.json";

const CATEGORY_ORDER = [
  GAME_VARIANT_CATEGORIES.TRIPLE_DRAW,
  GAME_VARIANT_CATEGORIES.SINGLE_DRAW,
  GAME_VARIANT_CATEGORIES.BOARD,
  GAME_VARIANT_CATEGORIES.DRAMAHA,
  GAME_VARIANT_CATEGORIES.STUD,
];

const MAX_SELECTED = 20;

const MIXED_PRESET_JA = Object.freeze({
  "mix-horse-pro": {
    description: "HORSE形式の5ゲームを固定順で回す、フィックスリミット中心のプロ向けローテーションです。",
  },
  "mix-8game-pro": {
    description: "NLH、PLO、Stud系、Draw系を含むWSOP形式に近い8ゲームローテーションです。",
  },
  "mix-10game-pro": {
    description: "8-GameにBadugiとNL 2-7 Single Drawを加えた上位ミックスです。",
  },
  "mix-pro-dealers-choice": {
    description: "出現しやすさと除外する種目を設定し、次の種目を抽選します。",
  },
  "mix-pro-category": {
    description: "カテゴリごとの出現しやすさと候補種目を決め、次の種目を抽選します。",
  },
});


function localizeVariantProfile(profile, language) {
  if (!profile) return profile;
  if (language !== "ja") return profile;
  const translation = variantJa[profile.id];
  return {
    ...profile,
    name: translation?.name ?? profile.name,
    description: translation?.description ?? profile.description,
    summary: translation?.description ?? profile.summary,
    searchText: `${profile.id} ${translation?.name ?? profile.name} ${
      translation?.description ?? profile.summary ?? ""
    } ${(profile.tags ?? []).join(" ")}`.toLowerCase(),
  };
}

function localizePreset(preset, language) {
  if (language !== "ja") return preset;
  const translation = MIXED_PRESET_JA[preset.id];
  return {
    ...preset,
    description: translation?.description ?? preset.description,
  };
}

const createDefaultCategoryRules = () => ({
  weights: CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = 0;
    return acc;
  }, {}),
  pools: {},
});

const hydrateCategoryRules = (rules = {}) => {
  const base = createDefaultCategoryRules();
  Object.entries(rules.weights || {}).forEach(([cat, weight]) => {
    if (base.weights[cat] === undefined) return;
    const numeric = Number(weight);
    base.weights[cat] = Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  });
  Object.entries(rules.pools || {}).forEach(([cat, ids]) => {
    if (base.pools[cat] === undefined) return;
    base.pools[cat] = Array.isArray(ids)
      ? ids.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim())
      : [];
  });
  return base;
};

const buildDraftFromProfile = (profile = {}) => ({
  id: profile.id ?? "",
  name: profile.name ?? "My Mixed Game",
  formatLabel: profile.formatLabel ?? profile.name ?? "Mixed Game",
  selectedGameIds: Array.isArray(profile.selectedGameIds)
    ? [...profile.selectedGameIds]
    : ["D03"],
  selectionMode: profile.selectionMode ?? "FIXED",
  handsPerGame: profile.handsPerGame ?? 4,
  allowDuplicates:
    profile.allowDuplicates === undefined ? true : Boolean(profile.allowDuplicates),
  weightedTable: { ...(profile.weightedTable || {}) },
  categoryRules: hydrateCategoryRules(profile.categoryRules),
  hardBans: Array.isArray(profile.hardBans) ? [...profile.hardBans] : [],
  softBans: Array.isArray(profile.softBans) ? [...profile.softBans] : [],
});

const parseIdList = (value = "") =>
  value
    .split(/[,\s]+/)
    .map((id) => id.trim().toUpperCase())
    .filter(Boolean);

function IdListInput({ ids, onCommit, ...props }) {
  const [text, setText] = useState(() => ids.join(", "));
  useEffect(() => { setText(ids.join(", ")); }, [ids]);
  return <input {...props} type="text" value={text}
    onChange={event => setText(event.target.value)}
    onBlur={() => onCommit(parseIdList(text))} />;
}

function SelectedList({ draft, setDraft, isVariantPlayable }) {
  const ja=useLanguage()==='ja';
  const selectionMode = draft.selectionMode;
  const weightedTable = draft.weightedTable || {};

  const updateWeight = (gameId, value) => {
    setDraft((prev) => {
      const table = { ...(prev.weightedTable || {}) };
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        delete table[gameId];
      } else {
        table[gameId] = numeric;
      }
      return { ...prev, weightedTable: table };
    });
  };

  const moveItem = (index, delta) => {
    setDraft((prev) => {
      const next = [...prev.selectedGameIds];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, selectedGameIds: next };
    });
  };

  const removeItem = (index) => {
    setDraft((prev) => {
      const next = [...prev.selectedGameIds];
      const [removed] = next.splice(index, 1);
      const updated = { ...prev, selectedGameIds: next };
      if (removed && updated.weightedTable?.[removed] != null) {
        const clone = { ...updated.weightedTable };
        delete clone[removed];
        updated.weightedTable = clone;
      }
      return updated;
    });
  };

  if (!draft.selectedGameIds.length) {
    return <p className="text-sm text-slate-400">{ja ? 'まだゲームが選択されていません。' : 'No games selected yet.'}</p>;
  }

  return (
    <div className="space-y-3">
      {draft.selectedGameIds.map((gameId, index) => {
        const variantInfo = getVariantProfile(gameId);
        const playable = isVariantPlayable(gameId);
        return (
          <div
            key={`${gameId}-${index}`}
            className="flex items-center gap-3 p-2 bg-slate-900/80 rounded-xl border border-white/10"
          >
            <div className="flex-1">
              <p className="text-sm font-semibold">{variantInfo?.name ?? gameId}</p>
              <p className="text-xs text-slate-500">{gameId}</p>
              {!playable && <p className="text-xs text-amber-300">{ja ? '現在は実行不可 (Planned)' : 'Unavailable in this mode'}</p>}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => moveItem(index, -1)}
                className="px-2 py-1 rounded bg-slate-800 text-xs"
                disabled={index === 0}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveItem(index, 1)}
                className="px-2 py-1 rounded bg-slate-800 text-xs"
                disabled={index === draft.selectedGameIds.length - 1}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="px-2 py-1 rounded bg-red-500/40 text-xs"
              >
                {ja ? '削除' : 'Delete'}
              </button>
              {selectionMode === "WEIGHTED" && (
                <label className="text-xs text-slate-300 flex flex-col items-start">
                  {ja ? '重み' : 'Weight'}
                  <input
                    type="number"
                    min={0.25}
                    step={0.25}
                    value={weightedTable[gameId] ?? 1}
                    onChange={(e) => updateWeight(gameId, e.target.value)}
                    className="mt-1 w-20 rounded bg-slate-950/60 border border-white/10 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </label>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MixedGameScreen({ language: languageProp }) {
  const sharedLanguage = useLanguage();
  const language = languageProp ?? sharedLanguage;
  const ja = language === 'ja';
  const navigate = useNavigate();
  const location = useLocation();
  const {
    profiles,
    saveProfile,
    deleteProfile,
    proPresets = [],
    activeProfileId,
    isVariantPlayable,
  } = useMixedGame();

  const playerProgress = usePlayerProgress();
  const unlockState = computeUnlockState(playerProgress);
  const mixedLocked = unlockState.mixedGameLocked;

  const [activeCategory, setActiveCategory] = useState(CATEGORY_ORDER[0]);
  const [search, setSearch] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState(profiles[0]?.id ?? "");
  const [draft, setDraft] = useState(() =>
    profiles[0]
      ? buildDraftFromProfile(profiles[0])
      : buildDraftFromProfile({
          id: "",
          name: "My Mixed Game",
          formatLabel: "Custom Mixed",
          selectedGameIds: ["D03"],
          selectionMode: "FIXED",
          handsPerGame: 4,
          allowDuplicates: true,
        })
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profiles.length) return;
    if (!selectedProfileId) {
      const first = profiles[0];
      setSelectedProfileId(first.id);
      setDraft(buildDraftFromProfile(first));
      return;
    }
    if (!profiles.some((p) => p.id === selectedProfileId)) {
      const fallback = profiles[0];
      setSelectedProfileId(fallback.id);
      setDraft(buildDraftFromProfile(fallback));
    }
  }, [profiles, selectedProfileId]);

  useEffect(() => {
    if (!location.search) return;
    const params = new URLSearchParams(location.search);
    const presetId = params.get("preset");
    if (!presetId) return;
    const existing = profiles.find((p) => p.id === presetId);
    if (existing) {
      setSelectedProfileId(existing.id);
      setDraft(buildDraftFromProfile(existing));
      setMessage((ja ? `${existing.name}を読み込みました。` : `${existing.name} loaded.`));
      setError("");
    } else {
      const presetDef = [...proPresets, ...LEARNING_PRESETS.map(p => ({ ...p, description: p.description[language === "ja" ? "ja" : "en"] }))].find((preset) => preset.id === presetId);
      if (presetDef) {
        const saved = saveProfile(presetDef);
        setSelectedProfileId(saved.id);
        setDraft(buildDraftFromProfile(saved));
        setMessage((ja ? `${saved.name}を追加しました。` : `${saved.name} added.`));
        setError("");
      }
    }
    navigate("/mixed", { replace: true });
  }, [location.search, proPresets, profiles, navigate, saveProfile, language, ja]);

  const variantOptions = useMemo(() => {
    const profiles = listVariantProfiles().map((profile) =>
      localizeVariantProfile(profile, language)
    );
    const query = search.trim().toLowerCase();
    const source = query
      ? profiles.filter((profile) =>
          (profile.searchText ?? `${profile.id} ${profile.name} ${profile.summary}`.toLowerCase()).includes(query)
        )
      : profiles.filter((profile) => profile.category === activeCategory);
    return source.slice(0, 40);
  }, [activeCategory, language, search]);

  const localizedProPresets = useMemo(
    () => proPresets.map((preset) => localizePreset(preset, language)),
    [language, proPresets],
  );

  const blockWhenLocked = () => {
    if (!mixedLocked) return false;
    setError(ja ? 'Mixed Game はロック中です。' : 'Win the World Championship to unlock MIX.');
    return true;
  };

  const handleSelectProfile = (profileId) => {
    setSelectedProfileId(profileId);
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;
    setDraft(buildDraftFromProfile(profile));
    setMessage((ja ? `${profile.name}を読み込みました。` : `${profile.name} loaded.`));
    setError("");
  };

  const handleApplyPreset = (presetId) => {
    if (blockWhenLocked()) return;
    const existing = profiles.find((p) => p.id === presetId);
    if (existing) {
      setSelectedProfileId(existing.id);
      setDraft(buildDraftFromProfile(existing));
      setMessage((ja ? `${existing.name}を読み込みました。` : `${existing.name} loaded.`));
      setError("");
      return;
    }
    const presetDef = [...proPresets, ...LEARNING_PRESETS.map(p => ({ ...p, description: p.description[language === "ja" ? "ja" : "en"] }))].find((preset) => preset.id === presetId);
    if (!presetDef) {
      setError(ja ? '指定されたプリセットが見つかりません。' : 'This preset could not be found.');
      return;
    }
    const saved = saveProfile(presetDef);
    setSelectedProfileId(saved.id);
    setDraft(buildDraftFromProfile(saved));
    setMessage((ja ? `${saved.name}を追加しました。` : `${saved.name} added.`));
    setError("");
  };

  const addGameToDraft = (gameId) => {
    if (blockWhenLocked()) return;
    if (!gameId) return;
    setDraft((prev) => {
      if (prev.selectedGameIds.length >= MAX_SELECTED) {
        setError(ja ? `選択できるゲームは最大 ${MAX_SELECTED} 件です。` : `Choose up to ${MAX_SELECTED} games.`);
        return prev;
      }
      if (!prev.allowDuplicates && prev.selectedGameIds.includes(gameId)) {
        setError(ja ? '重複追加は無効です。' : 'Repeated games are disabled.');
        return prev;
      }
      setError("");
      const nextIds = [...prev.selectedGameIds, gameId];
      const nextDraft = { ...prev, selectedGameIds: nextIds };
      if (prev.selectionMode === "WEIGHTED") {
        const currentWeights = { ...(prev.weightedTable || {}) };
        if (currentWeights[gameId] == null) {
          currentWeights[gameId] = 1;
        }
        nextDraft.weightedTable = currentWeights;
      }
      return nextDraft;
    });
  };

  const handleSave = () => {
    if (blockWhenLocked()) return;
    if (!draft.name.trim()) {
      setError(ja ? 'プロフィール名を入力してください。' : 'Enter a MIX name.');
      return;
    }
    if (draft.selectedGameIds.length === 0) {
      setError(ja ? '少なくとも1つゲームを選択してください。' : 'Choose at least one game.');
      return;
    }
    const saved = saveProfile(draft);
    setSelectedProfileId(saved.id);
    setDraft(buildDraftFromProfile(saved));
    setMessage(ja ? 'プロフィールを保存しました。' : 'MIX saved.');
    setError("");
  };

  const handleDelete = () => {
    if (!selectedProfileId) return;
    deleteProfile(selectedProfileId);
    const remaining = profiles.filter((p) => p.id !== selectedProfileId);
    const next = remaining[0];
    if (next) {
      setSelectedProfileId(next.id);
      setDraft(buildDraftFromProfile(next));
    } else {
      setSelectedProfileId("");
      setDraft(
        buildDraftFromProfile({
          id: "",
          name: "My Mixed Game",
          formatLabel: "Custom Mixed",
          selectedGameIds: ["D03"],
          selectionMode: "FIXED",
          handsPerGame: 4,
          allowDuplicates: true,
        })
      );
    }
    setMessage(ja ? '削除しました。' : 'Deleted.');
  };

  const handleStart = () => {
    if (blockWhenLocked()) return;
    const resolved = resolveInitialGame(draft, null, isVariantPlayable);
    if (!resolved) {
      setError(ja ? 'プレイ可能なゲームが含まれていません。Badugi などを追加してください。' : 'Add a playable game, such as Badugi.');
      return;
    }
    const saved = saveProfile(draft);
    setMessage((ja ? `${saved.name} を開始します。` : `Starting ${saved.name}.`));
    const initialId = resolved.gameId;
    navigate(`/game?variant=${normalizeAppVariantId(initialId)}`, { state: { mixedProfileId: saved.id } });
  };

  const builderDisabled = mixedLocked;
  const categoryLabels =
    language === "ja"
      ? {
          [GAME_VARIANT_CATEGORIES.BOARD]: "ボード / ホールデム / オマハ",
          [GAME_VARIANT_CATEGORIES.TRIPLE_DRAW]: "トリプルドロー",
          [GAME_VARIANT_CATEGORIES.SINGLE_DRAW]: "シングルドロー",
          [GAME_VARIANT_CATEGORIES.DRAMAHA]: "ドラマハ",
          [GAME_VARIANT_CATEGORIES.STUD]: "スタッド",
        }
      : VARIANT_CATEGORY_LABELS;
  const searchPlaceholder =
    language === "ja" ? "ゲーム名・形式・説明で検索..." : "Search by game, format, or description...";
  const variantSearchSection = (
    <section className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 space-y-4">
      <div>
        <p className="text-xs text-emerald-300 uppercase tracking-[0.3em]">
          {language === "ja" ? "ゲーム検索" : "Game Search"}
        </p>
        <h2 className="text-xl font-semibold text-white">
          {language === "ja" ? "ローテーションに入れるゲームを探す" : "Find Games for the Rotation"}
        </h2>
      </div>
      <div className="relative">
        <input
          type="search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-2xl bg-slate-950/60 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {search && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"
            onClick={() => setSearch("")}
          >
            {language === "ja" ? "クリア" : "Clear"}
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
            {categoryLabels[category]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {variantOptions.map((profile) => {
          const playable = isVariantPlayable(profile.id);
          const selectedCount = draft.selectedGameIds.filter(
            (id) => id === profile.id
          ).length;
          return (
            <div
              key={profile.id}
              className="p-4 bg-slate-950/60 border border-white/10 rounded-2xl space-y-2"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">{profile.id}</p>
                  <h3 className="text-lg font-semibold">{profile.name}</h3>
                </div>
                <span
                  className={`text-xs px-3 py-1 rounded-full ${
                    playable
                      ? "bg-emerald-500/20 text-emerald-200"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {playable
                    ? language === "ja"
                      ? "プレイ可能"
                      : "Playable"
                    : language === "ja"
                    ? "準備中"
                    : "Planned"}
                </span>
              </div>
              <p className="text-sm text-slate-300">{profile.summary}</p>
              <p className="text-xs text-slate-400">
                {profile.betting} / {profile.status}
              </p>
              <button
                type="button"
                onClick={() => addGameToDraft(profile.id)}
                className="w-full px-3 py-2 rounded-xl bg-emerald-500/80 text-slate-900 font-semibold disabled:bg-slate-800 disabled:text-slate-500 disabled:border disabled:border-white/10"
                disabled={
                  builderDisabled ||
                  (!draft.allowDuplicates &&
                    draft.selectedGameIds.includes(profile.id)) ||
                  draft.selectedGameIds.length >= MAX_SELECTED
                }
              >
                {language === "ja" ? "追加する" : "Add"}
                {selectedCount > 0 ? `（${selectedCount}）` : ""}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <div
      className="min-h-screen"
      style={{
        background: `linear-gradient(150deg, ${designTokens.colors.background}, #020b18 60%)`,
        color: designTokens.colors.textStrong,
      }}
    >
      <header className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">
            Mixed Game Builder
          </p>
          <h1 className="text-3xl font-extrabold">{ja ? 'ミックスローテーションを作成' : 'Build a MIX'}</h1><LanguageSelect />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/menu")}
            className="px-4 py-2 rounded-full border border-white/20 hover:bg-white/10 transition text-sm"
          >
            Main Menu
          </button>
          <button
            onClick={() => navigate("/games")}
            className="px-4 py-2 rounded-full border border-cyan-400/40 text-cyan-200 hover:bg-cyan-400/10 transition text-sm"
          >
            Catalog
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6"><ShareLink url={sharedMixUrl(draft)} /></div>

      <main className="max-w-6xl mx-auto px-6 pb-16 space-y-8">
        {mixedLocked && (
          <div className="rounded-3xl border border-amber-400/40 bg-amber-500/10 text-amber-100 text-sm p-4">
            {ja ? '世界大会を優勝すると Mixed Game が解放されます。まずはトーナメントで実績を積みましょう。' : 'Win the World Championship to unlock MIX.'}
          </div>
        )}

        {variantSearchSection}

        <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs text-emerald-300 uppercase tracking-[0.3em]">
                Pro Presets
              </p>
              <h2 className="text-xl font-semibold text-white">{ja ? 'プロ仕様プリセット' : 'Standard presets'}</h2>
              <p className="text-sm text-slate-300">
                {ja ? "HORSE / 8-Game / 10-Game / ランダムMIXを選べます。" : 'Choose HORSE, 8-Game, 10-Game or a random MIX.'}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {localizedProPresets.map((preset) => (
              <div
                key={preset.id}
                className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-400">{preset.formatLabel ?? preset.name}</p>
                    <h3 className="text-lg font-semibold text-white">{preset.name}</h3>
                  </div>
                  <span className="text-[11px] text-slate-300">
                    {preset.selectionMode === "WEIGHTED"
                      ? "Weighted"
                      : preset.selectionMode === "CATEGORY"
                      ? "Category"
                      : "Fixed"}
                  </span>
                </div>
                <p className="text-sm text-slate-300">
                  {preset.description ?? "プロツアー向けの既定ローテーション。"}
                </p>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(preset.id)}
                  className="mt-2 px-4 py-2 rounded-xl bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400 transition text-sm"
                >
                  {ja ? '読み込む' : 'Load'}
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-4 space-y-3">
            <h2 className="text-lg font-semibold">{ja ? 'プロフィール一覧' : 'Saved MIXes'}</h2>
            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => handleSelectProfile(profile.id)}
                  className={`w-full text-left px-3 py-2 rounded-2xl border text-sm transition ${
                    profile.id === selectedProfileId
                      ? "border-emerald-400 bg-emerald-400/10"
                      : "border-white/10 hover:border-emerald-400/40"
                  }`}
                >
                  <p className="font-semibold">{profile.name}</p>
                  <p className="text-xs text-slate-400">
                    {profile.selectionMode === "RANDOM"
                      ? "Dealer's Choice"
                      : (ja ? "固定順" : "Fixed") }
                     · {profile.handsPerGame}{ja?'ハンド':' hands'}
                  </p>
                  {profile.id === activeProfileId && (
                    <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/30 text-emerald-200">
                      {ja ? '使用中' : 'Active'}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSelectProfile(selectedProfileId)}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-800 text-sm"
              >
                {ja ? '再読込' : 'Reload'}
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-3 py-2 rounded-xl bg-red-500/40 text-sm"
                disabled={!selectedProfileId}
              >
                {ja ? '削除' : 'Delete'}
              </button>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm text-slate-300">{ja ? 'プロフィール名' : 'MIX name'}</span>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm text-slate-300">{ja ? '1ゲームあたりのハンド数' : 'Hands per game'}</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={draft.handsPerGame}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      handsPerGame: Number(e.target.value),
                    }))
                  }
                  className="rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                {ja ? '選択モード' : 'Selection mode'}
                <select
                  value={draft.selectionMode}
                  onChange={(e) => {
                    const nextMode = e.target.value;
                    setDraft((prev) => ({
                      ...prev,
                      selectionMode: nextMode,
                      categoryRules:
                        nextMode === "CATEGORY"
                          ? hydrateCategoryRules(prev.categoryRules)
                          : prev.categoryRules,
                    }));
                  }}
                  className="rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="FIXED">{ja ? '固定順 (Classic)' : 'Fixed order'}</option>
                  <option value="RANDOM">Dealer's Choice</option>
                  <option value="WEIGHTED">Weighted Random</option>
                  <option value="CATEGORY">Category Random</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={draft.allowDuplicates}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      allowDuplicates: e.target.checked,
                    }))
                  }
                  className="accent-emerald-500"
                />
                {ja ? '重複を許可' : 'Allow repeated games'}
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                {ja ? 'フォーマット名' : 'Format name'}
                <input
                  type="text"
                  value={draft.formatLabel ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      formatLabel: e.target.value,
                    }))
                  }
                  className="rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder={ja ? '例: HORSE / 8-Game' : 'e.g. HORSE / 8-Game'}
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                {ja ? '必ず除外する種目' : 'Exclude games'}
                <IdListInput
                  ids={draft.hardBans}
                  onCommit={(ids) => setDraft(prev => ({ ...prev, hardBans: ids }))}
                  className="rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder={ja ? '例: B09, ST4' : 'e.g. B09, ST4'}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                {ja ? '出現しにくくする種目' : 'Reduce selection weight'}
                <IdListInput
                  ids={draft.softBans}
                  onCommit={(ids) => setDraft(prev => ({ ...prev, softBans: ids }))}
                  className="rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder={ja ? '例: B09' : 'e.g. B09'}
                />
              </label>
            </div>
            {draft.selectionMode === "CATEGORY" && (
              <div className="rounded-3xl border border-white/10 p-4 space-y-3 bg-slate-900/40">
                <p className="text-sm text-slate-200 font-semibold">カテゴリ設定</p>
                <p className="text-xs text-slate-400">
                  重みづけと候補IDを指定できます（空の場合はカテゴリ全体から抽選）。
                </p>
                {CATEGORY_ORDER.map((category) => {
                  const label = VARIANT_CATEGORY_LABELS[category] ?? category;
                  const weightValue = draft.categoryRules.weights?.[category] ?? 0;
                  const poolValue = (draft.categoryRules.pools?.[category] ?? []).join(", ");
                  return (
                    <div
                      key={category}
                      className="rounded-2xl border border-white/10 p-3 space-y-2 bg-slate-950/40"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-200">{label}</span>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={weightValue}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              categoryRules: {
                                ...prev.categoryRules,
                                weights: {
                                  ...prev.categoryRules.weights,
                                  [category]: Math.max(0, Number(e.target.value) || 0),
                                },
                                pools: prev.categoryRules.pools,
                              },
                            }))
                          }
                          className="w-24 rounded bg-slate-900 border border-white/10 px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <textarea
                        value={poolValue}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            categoryRules: {
                              ...prev.categoryRules,
                              weights: prev.categoryRules.weights,
                              pools: {
                                ...prev.categoryRules.pools,
                                [category]: parseIdList(e.target.value),
                              },
                            },
                          }))
                        }
                        className="w-full rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="ID をカンマ/スペース区切りで入力"
                        rows={2}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">選択中のゲーム</h3>
                <span className="text-xs text-slate-400">
                  {draft.selectedGameIds.length}/{MAX_SELECTED}
                </span>
              </div>
              <div className="rounded-3xl border border-white/10 p-4 max-h-[280px] overflow-y-auto bg-slate-950/40">
                <SelectedList
                  draft={draft}
                  setDraft={setDraft}
                  isVariantPlayable={isVariantPlayable}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-wrap gap-4">
          <button
            onClick={handleSave}
            className="px-6 py-3 rounded-2xl bg-slate-800 border border-white/20 hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={builderDisabled}
          >
            {ja ? 'プロフィール保存' : 'Save MIX'}
          </button>
          <button
            onClick={handleStart}
            className="px-6 py-3 rounded-2xl bg-emerald-500 text-slate-900 font-bold shadow-lg hover:bg-emerald-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={builderDisabled}
          >
            {ja ? 'Mixed Game 開始' : 'Start MIX'}
          </button>
        </section>

        {message && (
          <p className="text-emerald-300 text-sm border border-emerald-500/40 rounded-2xl px-4 py-3 bg-emerald-500/10">
            {message}
          </p>
        )}
        {error && (
          <p className="text-red-300 text-sm border border-red-500/40 rounded-2xl px-4 py-3 bg-red-500/10">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
