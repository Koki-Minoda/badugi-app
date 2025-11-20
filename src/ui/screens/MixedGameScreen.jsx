import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { GAME_VARIANT_CATEGORIES } from "../../games/config/variantCatalog.js";
import {
  VARIANT_CATEGORY_LABELS,
  listVariantProfiles,
  getVariantProfile,
} from "../../games/config/variantProfiles.js";
import { useMixedGame } from "../mixed/MixedGameContext.jsx";
import { usePlayerProgress } from "../hooks/usePlayerProgress.js";
import { computeUnlockState } from "../utils/playerProgress.js";
import { designTokens } from "../../styles/designTokens.js";

const CATEGORY_ORDER = [
  GAME_VARIANT_CATEGORIES.TRIPLE_DRAW,
  GAME_VARIANT_CATEGORIES.SINGLE_DRAW,
  GAME_VARIANT_CATEGORIES.BOARD,
  GAME_VARIANT_CATEGORIES.DRAMAHA,
  GAME_VARIANT_CATEGORIES.STUD,
];

const MAX_SELECTED = 20;

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
    .split(/[,\\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);

function SelectedList({ draft, setDraft, isVariantPlayable }) {
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
    return <p className="text-sm text-slate-400">まだゲームが選択されていません。</p>;
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
              {!playable && <p className="text-xs text-amber-300">現在は実行不可 (Planned)</p>}
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
                削除
              </button>
              {selectionMode === "WEIGHTED" && (
                <label className="text-xs text-slate-300 flex flex-col items-start">
                  重み
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

export default function MixedGameScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    profiles,
    saveProfile,
    deleteProfile,
    activateProfile,
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
      setMessage(`${existing.name}を読み込みました。`);
      setError("");
    } else {
      const presetDef = proPresets.find((preset) => preset.id === presetId);
      if (presetDef) {
        const saved = saveProfile(presetDef);
        setSelectedProfileId(saved.id);
        setDraft(buildDraftFromProfile(saved));
        setMessage(`${saved.name}を追加しました。`);
        setError("");
      }
    }
    navigate("/mixed", { replace: true });
  }, [location.search, proPresets, profiles, navigate, saveProfile]);

  const variantOptions = useMemo(() => {
    const source = search.trim()
      ? listVariantProfiles().filter((profile) =>
          profile.name.toLowerCase().includes(search.trim().toLowerCase())
        )
      : listVariantProfiles({ category: activeCategory });
    return source.slice(0, 40);
  }, [activeCategory, search]);

  const blockWhenLocked = () => {
    if (!mixedLocked) return false;
    setError("Mixed Game はロック中です。");
    return true;
  };

  const handleSelectProfile = (profileId) => {
    setSelectedProfileId(profileId);
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;
    setDraft(buildDraftFromProfile(profile));
    setMessage(`${profile.name}を読み込みました。`);
    setError("");
  };

  const handleApplyPreset = (presetId) => {
    if (blockWhenLocked()) return;
    const existing = profiles.find((p) => p.id === presetId);
    if (existing) {
      setSelectedProfileId(existing.id);
      setDraft(buildDraftFromProfile(existing));
      setMessage(`${existing.name}を読み込みました。`);
      setError("");
      return;
    }
    const presetDef = proPresets.find((preset) => preset.id === presetId);
    if (!presetDef) {
      setError("指定されたプリセットが見つかりません。");
      return;
    }
    const saved = saveProfile(presetDef);
    setSelectedProfileId(saved.id);
    setDraft(buildDraftFromProfile(saved));
    setMessage(`${saved.name}を追加しました。`);
    setError("");
  };

  const addGameToDraft = (gameId) => {
    if (blockWhenLocked()) return;
    if (!gameId) return;
    setDraft((prev) => {
      if (prev.selectedGameIds.length >= MAX_SELECTED) {
        setError(`選択できるゲームは最大 ${MAX_SELECTED} 件です。`);
        return prev;
      }
      if (!prev.allowDuplicates && prev.selectedGameIds.includes(gameId)) {
        setError("重複追加は無効です。");
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
      setError("プロフィール名を入力してください。");
      return;
    }
    if (draft.selectedGameIds.length === 0) {
      setError("少なくとも1つゲームを選択してください。");
      return;
    }
    const saved = saveProfile(draft);
    setSelectedProfileId(saved.id);
    setDraft(buildDraftFromProfile(saved));
    setMessage("プロフィールを保存しました。");
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
    setMessage("削除しました。");
  };

  const handleStart = () => {
    if (blockWhenLocked()) return;
    if (!draft.selectedGameIds.some((id) => isVariantPlayable(id))) {
      setError("プレイ可能なゲームが含まれていません。Badugi などを追加してください。");
      return;
    }
    const saved = saveProfile(draft);
    const result = activateProfile(saved.id);
    if (!result) {
      setError("Mixed Game の開始に失敗しました。");
      return;
    }
    setMessage(`${saved.name} を開始します。`);
    setTimeout(() => navigate("/game"), 200);
  };

  const builderDisabled = mixedLocked;

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
          <h1 className="text-3xl font-extrabold">ミックスローテーションを作成</h1>
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

      <main className="max-w-6xl mx-auto px-6 pb-16 space-y-8">
        {mixedLocked && (
          <div className="rounded-3xl border border-amber-400/40 bg-amber-500/10 text-amber-100 text-sm p-4">
            世界大会を優勝すると Mixed Game が解放されます。まずはトーナメントで実績を積みましょう。
          </div>
        )}

        <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs text-emerald-300 uppercase tracking-[0.3em]">
                Pro Presets
              </p>
              <h2 className="text-xl font-semibold text-white">プロ仕様プリセット</h2>
              <p className="text-sm text-slate-300">
                HORSE / 8-Game / 10-Game / Dealer's Choice をワンクリックで読み込めます。
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {proPresets.map((preset) => (
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
                  読み込む
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-4 space-y-3">
            <h2 className="text-lg font-semibold">プロフィール一覧</h2>
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
                      : "固定順"}
                    ・{profile.handsPerGame}ハンド
                  </p>
                  {profile.id === activeProfileId && (
                    <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/30 text-emerald-200">
                      使用中
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
                再読込
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-3 py-2 rounded-xl bg-red-500/40 text-sm"
                disabled={!selectedProfileId}
              >
                削除
              </button>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm text-slate-300">プロフィール名</span>
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
                <span className="text-sm text-slate-300">1ゲームあたりのハンド数</span>
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
                選択モード
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
                  <option value="FIXED">固定順 (Classic)</option>
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
                重複を許可
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                フォーマット名
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
                  placeholder="例: HORSE / 8-Game"
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Hard Ban（必ず除外）
                <input
                  type="text"
                  value={(draft.hardBans || []).join(", ")}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      hardBans: parseIdList(e.target.value),
                    }))
                  }
                  className="rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="例: B09, ST4"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Soft Ban（優先度を下げる）
                <input
                  type="text"
                  value={(draft.softBans || []).join(", ")}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      softBans: parseIdList(e.target.value),
                    }))
                  }
                  className="rounded-xl bg-slate-950/60 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="例: B09"
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

        <section className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 space-y-4">
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
              placeholder="ゲーム名で検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl bg-slate-950/60 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"
                onClick={() => setSearch("")}
              >
                クリア
              </button>
            )}
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
                      {playable ? "Playable" : "Planned"}
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
                    追加する
                    {selectedCount > 0 ? `（${selectedCount}）` : ""}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex flex-wrap gap-4">
          <button
            onClick={handleSave}
            className="px-6 py-3 rounded-2xl bg-slate-800 border border-white/20 hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={builderDisabled}
          >
            プロフィール保存
          </button>
          <button
            onClick={handleStart}
            className="px-6 py-3 rounded-2xl bg-emerald-500 text-slate-900 font-bold shadow-lg hover:bg-emerald-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={builderDisabled}
          >
            Mixed Game 開始
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