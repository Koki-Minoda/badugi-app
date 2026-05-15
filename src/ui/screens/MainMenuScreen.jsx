import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import VariantSelectModal from "../components/VariantSelectModal.jsx";
import mgxKitsune from "../../assets/mgx_kitsune_transparent.png";
import { MGX_LOCALES, MGX_DEFAULT_LOCALE } from "../../config/mgxLocaleConfig.js";
import { listVariantProfiles, VARIANT_CATEGORY_LABELS } from "../../games/config/variantProfiles.js";
import { isCoachingPreviewEnabled } from "../coaching/previewFeatureFlags.js";

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

function SimpleModal({ title, children, onClose, closeLabel = "Close", size = "md" }) {
  const sizeClass = size === "wide" ? "max-w-5xl" : "max-w-md";
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className={`max-h-[88vh] w-full ${sizeClass} space-y-4 overflow-y-auto rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl`}>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 px-3 py-1 text-sm text-white hover:bg-white/10"
          >
            {closeLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const CATEGORY_GUIDES = {
  ja: {
    board: {
      rule: "コミュニティカードを使うゲームです。NLH/FLHは手札2枚、PLO系は手札から必ず2枚とボード3枚を使います。",
      tip: "ポジション、スタック深度、ナッツ候補を重視します。PLO系は強そうに見えても非ナッツのワンペアや弱いドローを過信しないことが重要です。",
    },
    "triple-draw": {
      rule: "3回のドローと4回のベットラウンドでローまたはBadugi系の完成度を競います。",
      tip: "初手の形、残りドロー回数、相手の交換枚数で価値が大きく変わります。最終ラウンドでは弱い完成手のバリューベットを控え、強い1枚ドローは早いラウンドで圧力をかけます。",
    },
    "single-draw": {
      rule: "1回だけカード交換できるドローゲームです。交換前の参加レンジとポジションが特に重要です。",
      tip: "1ドローで強い形に進展する手だけを広く続け、完成していても弱いローや弱いBadugiは大きなアクションに慎重になります。",
    },
    dramaha: {
      rule: "5枚ドローとオマハ系ボードゲームを組み合わせたスプリット系ミックスゲームです。",
      tip: "片側だけ強い手より、両方のポットを狙える手を優先します。ドロー側とボード側のどちらで勝っているかを分けて考えます。",
    },
    stud: {
      rule: "一部のカードが表向きに配られるスタッド系ゲームです。Stud/Razz/Stud8などで勝ち条件が変わります。",
      tip: "相手の表カードをよく見ます。自分のアウトが相手の表カードで消えているか、低いカードが生きているかを確認して参加判断を絞ります。",
    },
  },
  en: {
    board: {
      rule: "Community-card games. NLH/FLH use two hole cards; Omaha variants must use exactly two hole cards and three board cards.",
      tip: "Prioritize position, stack depth, and nut potential. In Omaha, avoid overvaluing non-nut one-pair hands and weak draws.",
    },
    "triple-draw": {
      rule: "Three draws and four betting rounds. The winner is decided by the variant's lowball or Badugi-style evaluator.",
      tip: "Hand value changes with starting shape, draws remaining, and opponent draw counts. Avoid thin value with weak made hands on the final round.",
    },
    "single-draw": {
      rule: "One draw only. Pre-draw selection and position matter more than in triple-draw games.",
      tip: "Continue wider with hands that can improve to strong lows or Badugis, but respect heavy action with weak made hands.",
    },
    dramaha: {
      rule: "Split-pot mixed games combining a five-card draw hand with an Omaha-style board component.",
      tip: "Prefer hands that can compete for both halves. Evaluate the draw side and board side separately before committing chips.",
    },
    stud: {
      rule: "Stud-family games deal some cards face-up. Stud, Razz, and Stud8 use different winning conditions.",
      tip: "Read exposed cards carefully. Discount outs that are already visible and tighten up when your live low or high cards are blocked.",
    },
  },
};

const EVALUATOR_GUIDES = {
  ja: {
    high: "通常の高い役で勝負します。トップペアだけでなくキッカー、ドロー、ナッツ完成可能性を見ます。",
    "low-27": "2-7ローはAが高く、ストレートとフラッシュが悪い役です。最高形は7-5-4-3-2です。",
    "low-a5": "A-5ローはAが低く、ストレートとフラッシュは無視します。A-2-3-4-5が強い形です。",
    "hi-lo-8-split": "8以下のローが成立すればハイとローでポットを分けます。ロー不成立ならハイ側が総取りします。",
    "badugi-low": "4枚すべて違うスート/ランクの低いBadugiが強いです。4枚Badugiは3枚以下の手より上です。",
    "badugi-high": "高いBadugiを作る特殊系です。通常Badugiと逆方向の価値になります。",
    "split-badugi-27": "Badugi側と2-7ロー側でポットを分けます。片側だけでなく両取り可能性を重視します。",
    "split-badugi-a5": "Badugi側とA-5ロー側でポットを分けます。Aの価値が2-7と違う点に注意します。",
    archie: "Archie系の独自評価です。完成条件とドロー後の両面価値を確認します。",
    zero: "Dramaha 0系の特殊評価です。合計値を低くする方向で考えます。",
  },
  en: {
    high: "Standard high-hand ranking. Consider kickers, draws, and nut potential rather than top pair alone.",
    "low-27": "In 2-7 lowball, aces are high and straights/flushes count against you. The best hand is 7-5-4-3-2.",
    "low-a5": "In A-5 lowball, aces are low and straights/flushes are ignored. A-2-3-4-5 is a premium low.",
    "hi-lo-8-split": "The pot splits between high and qualifying 8-or-better low. If no low qualifies, high scoops.",
    "badugi-low": "A four-card hand with unique suits/ranks is strongest; lower four-card Badugis beat three-card hands.",
    "badugi-high": "A high-Badugi variant where normal Badugi low values are reversed.",
    "split-badugi-27": "The pot splits between Badugi and 2-7 low. Prefer hands that can contest both halves.",
    "split-badugi-a5": "The pot splits between Badugi and A-5 low. Remember that ace value differs from 2-7.",
    archie: "Custom Archie-style scoring. Track made-hand requirements and two-way draw value.",
    zero: "Dramaha Zero-style scoring. Aim to lower the target total while preserving board equity.",
  },
};

function getVariantStrategyTip(profile, language) {
  const ja = language === "ja";
  const name = profile?.name ?? "";
  const id = profile?.id ?? "";
  if (id === "badugi" || /badugi/i.test(name)) {
    return ja
      ? "序盤は完成Badugiと強い1枚ドローを中心に参加します。最終ドロー後はK/QローBadugiの薄いベットを避け、相手の交換枚数が多い時だけ攻めます。"
      : "Open strong made Badugis and strong one-card draws. On the final street, avoid thin value with K/Q-low Badugis unless opponents drew multiple cards.";
  }
  if (/PLO8|Omaha 8|Hi-Lo/i.test(name) || profile?.evaluators?.includes("hi-lo-8-split")) {
    return ja
      ? "A-2系のナッツロー候補とナッツハイ候補を同時に持つ手を重視します。片側だけの弱いドローは大きなポットで危険です。"
      : "Prefer A-2 nut-low potential combined with nut-high potential. One-way weak draws are dangerous in big pots.";
  }
  if (/PLO|Omaha|Big O/i.test(name)) {
    return ja
      ? "手札4枚/5枚の連携、ナッツフラッシュ/ストレートの可能性、ポジションを重視します。裸のAや小さいセットだけで突っ込みすぎないこと。"
      : "Value connected hole cards, nut flush/straight potential, and position. Do not overcommit with bare aces or weak sets.";
  }
  if (/Hold.?em|NLH|FLH/i.test(name)) {
    return ja
      ? "ポジション別の参加レンジ、3betへの対応、ボードテクスチャに応じたCB頻度を意識します。固定リミットでは薄いコールの積み重ねに注意します。"
      : "Use position-aware ranges, disciplined 3-bet responses, and board-texture-aware c-bets. In fixed limit, avoid leaking through too many thin calls.";
  }
  if (/Razz/i.test(name)) {
    return ja
      ? "表カードの低さとライブカードが最重要です。相手の表カードに自分のアウトが多く見えている時は早めに撤退します。"
      : "Exposed low cards and live cards drive decisions. Fold earlier when your key outs are visible in opponents' boards.";
  }
  if (/Stud/i.test(name)) {
    return ja
      ? "表カードから相手のレンジを推定します。強いペアやライブな高カード、Stud8ではローとの両面性を重視します。"
      : "Infer ranges from exposed cards. Prioritize strong pairs/live high cards, and in Stud8 hands that can compete both ways.";
  }
  if (/2-7/i.test(name)) {
    return ja
      ? "7ローへ向かう形とペア/ストレート/フラッシュリスクを見ます。Aは高いカードなので、Aを含むローは弱くなります。"
      : "Build toward seven-low while avoiding pairs, straights, and flushes. Aces are high, so ace-low-looking hands are weak here.";
  }
  if (/A-5/i.test(name)) {
    return ja
      ? "Aは最強の低いカードです。ストレート/フラッシュを気にせず、A-2-3-4-5方向の進展性を重視します。"
      : "Aces are premium low cards. Ignore straights/flushes and value progress toward A-2-3-4-5.";
  }
  return ja
    ? "まずはナッツ候補、ポジション、相手のアクション量を確認します。片側だけ弱く勝っている手より、複数の勝ち筋を持つ手を優先します。"
    : "Start by checking nut potential, position, and opponent pressure. Prefer hands with multiple paths to win over fragile one-way holdings.";
}

function buildVariantGuide(profile, language) {
  const categoryGuide =
    CATEGORY_GUIDES[language]?.[profile.category] ?? CATEGORY_GUIDES.en[profile.category] ?? {};
  const evaluatorTips = (profile.evaluators ?? [])
    .map((tag) => EVALUATOR_GUIDES[language]?.[tag] ?? EVALUATOR_GUIDES.en[tag])
    .filter(Boolean);
  return {
    rule: categoryGuide.rule ?? profile.description,
    evaluator: evaluatorTips.join(" "),
    tip: getVariantStrategyTip(profile, language),
  };
}

function RulesGuide({ language }) {
  const profiles = listVariantProfiles();
  const ja = language === "ja";
  return (
    <div className="space-y-5 text-sm text-slate-300">
      <p>
        {ja
          ? "MGXで選べる各ゲームの勝敗条件と、強くなるための基本方針です。実戦ではポジション、スタック、相手のアクション、ショーダウン情報を合わせて判断してください。"
          : "Rules and practical improvement notes for MGX variants. In play, combine these with position, stacks, opponent actions, and showdown information."}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {profiles.map((profile) => {
          const guide = buildVariantGuide(profile, language);
          return (
            <article
              key={profile.id}
              className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
            >
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-emerald-300">
                    {profile.id}
                  </div>
                  <h3 className="text-base font-bold text-white">{profile.name}</h3>
                </div>
                <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-slate-300">
                  {VARIANT_CATEGORY_LABELS[profile.category] ?? profile.category}
                </span>
              </div>
              <dl className="space-y-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {ja ? "ルール" : "Rules"}
                  </dt>
                  <dd>{guide.rule}</dd>
                </div>
                {guide.evaluator && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {ja ? "勝敗判定" : "Evaluator"}
                    </dt>
                    <dd>{guide.evaluator}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {ja ? "強くなるコツ" : "How to improve"}
                  </dt>
                  <dd>{guide.tip}</dd>
                </div>
              </dl>
            </article>
          );
        })}
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
  onSelectHandHistory,
  onSelectLearningDashboardPreview,
  coachingPreviewEnabled = isCoachingPreviewEnabled(),
}) {
  const navigate = useNavigate();
  const [isVariantModalOpen, setVariantModalOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [activeMode, setActiveMode] = useState("default");
  const locale = MGX_LOCALES[language] ?? MGX_LOCALES[MGX_DEFAULT_LOCALE];
  const modalCopy = locale.modal ?? MGX_LOCALES[MGX_DEFAULT_LOCALE].modal;

  const handleVariantSelected = (variantId) => {
    setVariantModalOpen(false);
    if (!variantId) return;
    const search = variantId ? `?variant=${variantId}` : "";
    navigate(`/game${search}`);
  };

  const resetInfoPanel = () => setActiveMode("default");
  const previewDashboardPath =
    typeof window !== "undefined" && window.location?.pathname?.startsWith("/dev")
      ? "/dev/learning-dashboard-preview?mgxPreview=coaching"
      : "/learning-dashboard-preview?mgxPreview=coaching";

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
    history: {
      title: locale?.info?.historyTitle ?? "Hand History",
      body:
        locale?.info?.historyBody ??
        "Review your latest hands, inspect blinds, and jump into replays.",
    },
    learningDashboard: {
      title: language === "ja" ? "学習ダッシュボード Preview" : "Learning Dashboard Preview",
      body:
        language === "ja"
          ? "ローカルのpreviewデータだけで、学習グラフとリプレイ見直し候補を確認します。"
          : "Inspect local preview-only learning graphs and replay revisit candidates.",
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
                <p className="uppercase tracking-wide text-slate-400">
                  {language === "ja" ? "ゲーム形式" : "Game Modes"}
                </p>
                <p className="font-semibold text-white">
                  {language === "ja" ? "キャッシュ・トナメ" : "Cash · MTT"}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-wide text-slate-400">
                  {language === "ja" ? "学習ログ" : "RL Capture"}
                </p>
                <p className="font-semibold text-white">
                  {language === "ja" ? "保存対応" : "JSONL Ready"}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-wide text-slate-400">
                  {language === "ja" ? "トーナメント" : "Store Ladder"}
                </p>
                <p className="font-semibold text-white">
                  {language === "ja" ? "シーズン 02" : "Season 02"}
                </p>
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
                navigate("/games?mode=cash");
              }}
              onHover={() => setActiveMode("cash")}
              onBlur={resetInfoPanel}
            />
            <button
              type="button"
              data-testid="menu-variant-select"
              onClick={() => {
                if (onSelectRing) {
                  onSelectRing();
                  return;
                }
                navigate("/games?mode=cash");
              }}
              onMouseEnter={() => setActiveMode("cash")}
              onBlur={resetInfoPanel}
              className="rounded-2xl border border-emerald-300/35 bg-emerald-400/10 px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100 transition hover:border-emerald-200/70 hover:bg-emerald-300/15"
            >
              {locale.menu.variantSelect}
            </button>
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
              label={locale.menu.handHistory}
              isActive={activeMode === "history"}
              testId="menu-history"
              onClick={() => {
                if (onSelectHandHistory) {
                  onSelectHandHistory();
                  return;
                }
                navigate("/history");
              }}
              onHover={() => setActiveMode("history")}
              onBlur={resetInfoPanel}
            />
            {coachingPreviewEnabled && (
              <ModeButton
                label={language === "ja" ? "学習ダッシュボード Preview" : "Learning Dashboard Preview"}
                isActive={activeMode === "learningDashboard"}
                testId="menu-learning-dashboard-preview"
                onClick={() => {
                  if (onSelectLearningDashboardPreview) {
                    onSelectLearningDashboardPreview();
                    return;
                  }
                  navigate(previewDashboardPath);
                }}
                onHover={() => setActiveMode("learningDashboard")}
                onBlur={resetInfoPanel}
              />
            )}
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
        labels={modalCopy}
      />

      {showSettings && (
        <SimpleModal
          title={`${modalCopy.settingsTitle} · ${language === "ja" ? "日本語" : "English"}`}
          onClose={() => setShowSettings(false)}
          closeLabel={modalCopy.close}
        >
          <div className="space-y-4 text-sm text-slate-300">
            <p>
              {modalCopy.settingsBody}
            </p>
            <label className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200">
              <span>{modalCopy.language}</span>
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
        <SimpleModal
          title={modalCopy.rulesTitle}
          onClose={() => setShowRules(false)}
          closeLabel={modalCopy.close}
          size="wide"
        >
          <RulesGuide language={language} />
        </SimpleModal>
      )}
    </div>
  );
}
