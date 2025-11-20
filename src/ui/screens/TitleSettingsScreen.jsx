import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import TitleForm from "../components/TitleForm";
import { loadTitleSettings, resetTitleSettings, saveTitleSettings } from "../utils/titleSettings";
import { usePlayerProgress } from "../hooks/usePlayerProgress.js";
import { computeUnlockState } from "../utils/playerProgress.js";
import { listTierIds, getTierById } from "../../ai/tierManager.js";
import {
  loadAiTierOverride,
  persistAiTierOverride,
  loadLastAiKpiSnapshot,
  loadP2pCaptureFlag,
  persistP2pCaptureFlag,
  DEV_EVENTS,
} from "../utils/devOverrides.js";
import { exportP2PMatchesAsJSONL } from "../utils/ratingState.js";

const stageLabels = {
  store: "Store",
  local: "Local",
  national: "National",
  world: "World",
};

function formatPercent(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${(value * 100).toFixed(digits)}%`;
}

export default function TitleSettingsScreen() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(() => loadTitleSettings());
  const [devTierOverride, setDevTierOverride] = useState(() => loadAiTierOverride());
  const [kpiSnapshot, setKpiSnapshot] = useState(() => loadLastAiKpiSnapshot());
  const [p2pCaptureEnabled, setP2pCaptureEnabled] = useState(() => loadP2pCaptureFlag());
  const playerProgress = usePlayerProgress();
  const unlockState = computeUnlockState(playerProgress);
  const pendingStep = unlockState.chain.find((step) => !step.complete);
  const tierOptions = useMemo(
    () =>
      listTierIds().map((tierId) => ({
        id: tierId,
        label: getTierById(tierId)?.label ?? tierId,
      })),
    []
  );

  const preview = useMemo(
    () => ({
      name: settings.playerName || "You",
      title: settings.playerTitle || "Badugi Rookie",
      avatar: settings.avatar || "♦︎",
    }),
    [settings]
  );

  const handleSave = (next) => {
    const saved = saveTitleSettings(next);
    setSettings(saved);
  };

  const handleReset = () => {
    const defaults = resetTitleSettings();
    setSettings(defaults);
  };

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleOverride = (event) => {
      setDevTierOverride(event?.detail ?? loadAiTierOverride());
    };
    const handleKpi = (event) => {
      setKpiSnapshot(event?.detail ?? loadLastAiKpiSnapshot());
    };
    const handleP2p = (event) => {
      if (typeof event?.detail === "boolean") {
        setP2pCaptureEnabled(event.detail);
      } else {
        setP2pCaptureEnabled(loadP2pCaptureFlag());
      }
    };
    window.addEventListener(DEV_EVENTS.tierOverrideChanged, handleOverride);
    window.addEventListener(DEV_EVENTS.kpiSnapshot, handleKpi);
    window.addEventListener(DEV_EVENTS.p2pCaptureChanged, handleP2p);
    return () => {
      window.removeEventListener(DEV_EVENTS.tierOverrideChanged, handleOverride);
      window.removeEventListener(DEV_EVENTS.kpiSnapshot, handleKpi);
      window.removeEventListener(DEV_EVENTS.p2pCaptureChanged, handleP2p);
    };
  }, []);

  const handleTierOverrideChange = (event) => {
    const value = event.target.value || null;
    const stored = persistAiTierOverride(value);
    setDevTierOverride(stored);
  };

  const clearTierOverride = () => {
    persistAiTierOverride(null);
    setDevTierOverride(null);
  };

  const toggleP2pCapture = () => {
    const next = persistP2pCaptureFlag(!p2pCaptureEnabled);
    setP2pCaptureEnabled(next);
  };

  const handleExportP2pMatches = () => {
    exportP2PMatchesAsJSONL();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-emerald-300">Settings</p>
          <h1 className="text-3xl font-extrabold">Title & Avatar</h1>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="px-4 py-2 rounded-lg border border-white/30 hover:bg-white/10 transition"
          >
            Back to Title
          </button>
          <button
            type="button"
            onClick={() => navigate("/game")}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400 transition"
          >
            Jump into Game
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-16 grid gap-8 lg:grid-cols-2">
        <section className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="text-5xl">{preview.avatar}</div>
            <div>
              <p className="text-sm uppercase tracking-widest text-emerald-300">Preview</p>
              <h2 className="text-2xl font-bold">{preview.name}</h2>
              <span className="inline-flex mt-2 px-3 py-1 rounded-full bg-emerald-600/20 text-emerald-300 text-xs uppercase tracking-wide">
                {preview.title}
              </span>
            </div>
          </div>
          <div className="space-y-3 text-sm text-slate-200">
            <p>Your name and title appear on the in-table player card.</p>
            <p>The avatar will be used for chat/log animations in upcoming updates.</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4 space-y-3">
            <p className="text-xs uppercase tracking-widest text-emerald-300">
              World Championship Unlock
            </p>
            <ul className="space-y-2 text-sm">
              {unlockState.chain.map((step) => (
                <li
                  key={step.id}
                  className="flex items-center justify-between rounded-xl bg-slate-950/30 px-3 py-2"
                >
                  <span className="font-semibold">{stageLabels[step.id] ?? step.label}</span>
                  <span
                    className={`text-xs font-bold ${
                      step.complete ? "text-emerald-300" : "text-slate-400"
                    }`}
                  >
                    {step.current} / {step.required}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-amber-300">
              {unlockState.worldChampCleared
                ? `Advanced modes unlocked (clears: ${unlockState.clearCount}).`
                : `Next goal: ${stageLabels[pendingStep?.id] ?? "World"} victory needed for unlock.`}
            </p>
          </div>
        </section>

        <section className="bg-white text-slate-900 rounded-3xl p-6 shadow-xl">
          <h3 className="text-xl font-semibold mb-4">Customize Player Profile</h3>
          <TitleForm initialValues={settings} onSave={handleSave} onReset={handleReset} />
        </section>
      </main>

      <section className="max-w-6xl mx-auto px-6 pb-16" data-testid="dev-tier-panel">
        <div className="rounded-3xl border border-red-400/30 bg-slate-950/80 p-6 text-white space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-red-300">Developer</p>
              <h2 className="text-2xl font-bold">AI Tier Tuning Panel</h2>
              <p className="text-sm text-slate-300">
                KPIを確認しながらCPUティアを一時的に上書きできます（テスト用途）。
              </p>
            </div>
            <div className="text-xs text-slate-400">
              {kpiSnapshot?.updatedAt
                ? `最終更新: ${new Date(kpiSnapshot.updatedAt).toLocaleTimeString()}`
                : "まだハンドデータがありません"}
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <label className="text-xs uppercase tracking-widest text-slate-400">
                Tier Override
              </label>
              <div className="flex gap-2">
                <select
                  value={devTierOverride ?? ""}
                  onChange={handleTierOverrideChange}
                  className="flex-1 rounded-2xl bg-slate-900/60 border border-white/20 px-3 py-2 text-sm"
                >
                  <option value="">自動 (コンテキスト依存)</option>
                  {tierOptions.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={clearTierOverride}
                  className="rounded-2xl border border-red-400/60 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10 transition"
                >
                  Override解除
                </button>
              </div>
              <p className="text-xs text-slate-400">
                現在:{" "}
                {devTierOverride
                  ? getTierById(devTierOverride)?.label ?? devTierOverride
                  : "自動 (ゲーム状況で決定)"}
              </p>
            </div>
            <div className="space-y-3">
              <label className="text-xs uppercase tracking-widest text-slate-400">
                最新KPIスナップショット
              </label>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-2xl bg-white/5 px-3 py-2">
                  <dt className="text-slate-400">VPIP</dt>
                  <dd className="text-white font-semibold">{formatPercent(kpiSnapshot?.vpipRate)}</dd>
                </div>
                <div className="rounded-2xl bg-white/5 px-3 py-2">
                  <dt className="text-slate-400">PFR</dt>
                  <dd className="text-white font-semibold">{formatPercent(kpiSnapshot?.pfrRate)}</dd>
                </div>
                <div className="rounded-2xl bg-white/5 px-3 py-2">
                  <dt className="text-slate-400">3Bet</dt>
                  <dd className="text-white font-semibold">
                    {formatPercent(kpiSnapshot?.threeBetRate)}
                  </dd>
                </div>
                <div className="rounded-2xl bg-white/5 px-3 py-2">
                  <dt className="text-slate-400">Draw Avg</dt>
                  <dd className="text-white font-semibold">
                    {kpiSnapshot?.drawCountAvg != null ? kpiSnapshot.drawCountAvg.toFixed(2) : "-"}
                  </dd>
                </div>
              </dl>
              <p className="text-[11px] text-slate-400">
                サンプル: {(kpiSnapshot?.samples?.actions ?? 0).toLocaleString()} actions /{" "}
                {(kpiSnapshot?.samples?.showdowns ?? 0).toLocaleString()} showdowns
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-2xl bg-white/5 p-4 border border-white/10">
              <label className="text-xs uppercase tracking-widest text-slate-400">
                P2P RL Capture
              </label>
              <p className="text-sm text-slate-200">
                開発中の P2P / 対人戦ハンドを JSONL バッファへ蓄積します（テスト用途）。
              </p>
              <button
                type="button"
                onClick={toggleP2pCapture}
                className={`w-full rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  p2pCaptureEnabled ? "bg-emerald-500 text-slate-900" : "border border-white/20 text-white"
                }`}
              >
                {p2pCaptureEnabled ? "Capture Enabled" : "Capture Disabled"}
              </button>
            </div>
            <div className="space-y-3 rounded-2xl bg-white/5 p-4 border border-white/10">
              <label className="text-xs uppercase tracking-widest text-slate-400">
                Export P2P Match Buffer
              </label>
              <p className="text-sm text-slate-200">
                蓄積済みの P2P マッチ履歴を JSONL として書き出し、RL パイプラインに渡せます。
              </p>
              <button
                type="button"
                onClick={handleExportP2pMatches}
                className="w-full rounded-2xl border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10 transition"
              >
                JSONL Export
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
