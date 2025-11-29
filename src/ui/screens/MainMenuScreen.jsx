import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import VariantSelectModal from "../components/VariantSelectModal.jsx";
import mgxKitsune from "../../assets/mgx_kitsune_transparent.png";
import { MGX_LOCALES, MGX_DEFAULT_LOCALE } from "../../config/mgxLocaleConfig.js";

function ModeButton({
  label,
  isActive = false,
  onClick,
  onHover,
  onBlur,
  testId,
}) {
  const base =
    "w-full rounded-2xl border px-7 py-4 lg:py-5 text-left transition-all cursor-pointer relative overflow-hidden group bg-black/70 backdrop-blur-sm";
  const goldIdleClasses =
    "border-yellow-400/35 shadow-[0_0_15px_rgba(245,211,107,0.18)]";
  const emeraldActiveClasses =
    "border-emerald-400/80 shadow-[0_0_32px_rgba(42,255,179,0.45)] bg-emerald-500/5";
  const accentClasses = isActive ? emeraldActiveClasses : goldIdleClasses;

  const handleHover = () => {
    if (onHover) onHover();
  };
  const handleBlur = () => {
    if (onBlur) onBlur();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={handleHover}
      onFocus={handleHover}
      onMouseLeave={handleBlur}
      onBlur={handleBlur}
      data-testid={testId}
      className={`${base} ${accentClasses} hover:-translate-y-1 hover:scale-[1.03]`}
    >
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-white/12 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="text-[0.7rem] lg:text-xs font-semibold uppercase tracking-[0.35em] text-slate-200/90">
        {label}
      </div>
    </button>
  );
}

function SimpleModal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-slate-950/90 p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 px-3 py-1 text-sm text-white hover:bg-white/10"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function MainMenuScreen({
  language = MGX_DEFAULT_LOCALE,
  onChangeLanguage = () => {},
  onSelectRing,
  onSelectTournament,
  onSelectSettings,
  onSelectFriendMatch,
}) {
  const navigate = useNavigate();
  const [isVariantModalOpen, setVariantModalOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [activeMode, setActiveMode] = useState("default");
  const locale = MGX_LOCALES[language] ?? MGX_LOCALES[MGX_DEFAULT_LOCALE];

  const handleVariantSelected = (variantId) => {
    setVariantModalOpen(false);
    if (!variantId) return;
    if (onSelectRing) {
      onSelectRing(variantId);
      return;
    }
    const search = variantId ? `?variant=${variantId}` : "";
    navigate(`/game${search}`);
  };

  const resetInfoPanel = () => setActiveMode("default");

  const infoMap = {
    cash: {
      title: locale.info.cashTitle,
      body: locale.info.cashBody,
    },
    tournament: {
      title: locale.info.tournamentTitle,
      body: locale.info.tournamentBody,
    },
    friend: {
      title: locale.info.friendTitle,
      body: locale.info.friendBody,
    },
    settings: {
      title: locale.info.settingsTitle,
      body: locale.info.settingsBody,
    },
  };
  const infoContent =
    infoMap[activeMode] ?? {
      title: locale.info.defaultTitle,
      body: locale.info.defaultBody,
    };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#050507] text-slate-100">
      <div className="absolute inset-0 bg-gradient-to-b from-black via-[#050713] to-[#020308]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle,_rgba(255,255,255,0.04)_1px,_transparent_1px)] [background-size:4px_4px]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-emerald-500/15 via-transparent to-transparent" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-8 py-10 lg:flex-row lg:gap-16 lg:py-16">
        <div className="relative flex flex-[0.45] flex-col justify-center">
          <div className="pointer-events-none absolute -left-20 top-24 h-64 w-64 rounded-full bg-emerald-500/20 blur-[120px]" />
          <div className="relative">
            <img
              src={mgxKitsune}
              alt="MGX Kitsune"
              className="mx-auto w-[260px] drop-shadow-[0_0_35px_rgba(234,179,8,0.45)] lg:w-[320px] xl:w-[360px]"
            />
          </div>
          <div className="relative z-10 mt-6 space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300">
              {locale.title.modeSelect}
            </div>
            <h1 className="text-2xl font-semibold tracking-wide text-yellow-100 lg:text-3xl">
              {locale.title.heading}
            </h1>
            <p className="max-w-md text-xs text-slate-300/85 lg:text-sm">
              {locale.title.description}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                aria-label="Open Rules"
                onClick={() => setShowRules(true)}
                className="h-10 w-10 rounded-full border border-white/20 text-base text-white transition hover:border-emerald-300/60 hover:text-emerald-200"
              >
                ?
              </button>
              <button
                type="button"
                aria-label="Open Settings"
                onClick={() => setShowSettings(true)}
                className="h-10 w-10 rounded-full border border-white/20 text-lg text-white transition hover:border-emerald-300/60 hover:text-emerald-200"
              >
                ⚙
              </button>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-700/80 bg-black/60 px-5 py-3 text-[0.7rem] text-slate-200 lg:flex lg:items-center lg:justify-between lg:gap-4 lg:text-xs">
              <div>
                <p className="uppercase tracking-wide text-slate-400">Mixed Formats</p>
                <p className="font-semibold text-white">Ring · MTT</p>
              </div>
              <div>
                <p className="uppercase tracking-wide text-slate-400">RL Capture</p>
                <p className="font-semibold text-white">JSONL Ready</p>
              </div>
              <div>
                <p className="uppercase tracking-wide text-slate-400">Store Ladder</p>
                <p className="font-semibold text-white">Season 02</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative flex flex-[0.55] flex-col justify-center">
          <div className="ml-auto flex w-full max-w-md flex-col gap-4">
            <ModeButton
              label={locale.menu.cash}
              isActive={activeMode === "cash"}
              testId="menu-ring"
              onClick={() => {
                if (onSelectRing) {
                  onSelectRing();
                  return;
                }
                setVariantModalOpen(true);
              }}
              onHover={() => setActiveMode("cash")}
              onBlur={resetInfoPanel}
            />
            <ModeButton
              label={locale.menu.tournament}
              isActive={activeMode === "tournament"}
              testId="menu-tournament"
              onClick={() => {
                if (onSelectTournament) {
                  onSelectTournament();
                  return;
                }
                navigate("/game?mode=store_tournament&variant=badugi", {
                  state: { startTournamentMTT: true },
                });
              }}
              onHover={() => setActiveMode("tournament")}
              onBlur={resetInfoPanel}
            />
            <ModeButton
              label={locale.menu.friend}
              isActive={activeMode === "friend"}
              testId="menu-friend"
              onClick={() => {
                if (onSelectFriendMatch) {
                  onSelectFriendMatch();
                  return;
                }
                navigate("/friend-match");
              }}
              onHover={() => setActiveMode("friend")}
              onBlur={resetInfoPanel}
            />
            <ModeButton
              label={locale.menu.settings}
              isActive={activeMode === "settings"}
              testId="menu-settings"
              onClick={() => {
                if (onSelectSettings) {
                  onSelectSettings();
                  return;
                }
                setShowSettings(true);
              }}
              onHover={() => setActiveMode("settings")}
              onBlur={resetInfoPanel}
            />
            <div className="mt-5 rounded-2xl border border-slate-700/70 bg-black/55 px-6 py-4 text-xs text-slate-300/85">
              <div className="mb-1 font-semibold text-slate-100">{infoContent.title}</div>
              <p>{infoContent.body}</p>
            </div>
          </div>
        </div>
      </div>

      <VariantSelectModal
        isOpen={isVariantModalOpen}
        onClose={() => setVariantModalOpen(false)}
        onSelectVariant={handleVariantSelected}
      />

      {showSettings && (
        <SimpleModal title={`Settings · ${language === "ja" ? "日本語" : "English"}`} onClose={() => setShowSettings(false)}>
          <div className="space-y-4 text-sm text-slate-300">
            <p>
              Settings will be added later. Use table overlays for quick toggles. Language switching is available
              below.
            </p>
            <label className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200">
              <span>Language / 言語</span>
              <select
                value={language}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (nextValue && nextValue !== language) {
                    onChangeLanguage?.(nextValue);
                  }
                }}
                className="rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-[11px] text-slate-100 focus:border-yellow-400 focus:outline-none"
                data-testid="language-select"
              >
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </select>
            </label>
          </div>
        </SimpleModal>
      )}
      {showRules && (
        <SimpleModal title="Game Rules" onClose={() => setShowRules(false)}>
          <p className="text-sm text-slate-300">
            Detailed rules for each variant will appear here in a future update.
          </p>
        </SimpleModal>
      )}
    </div>
  );
}
