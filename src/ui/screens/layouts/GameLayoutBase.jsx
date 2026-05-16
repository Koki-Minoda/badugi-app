import React, { useRef } from "react";
import Player from "../../components/Player";
import Card from "../../components/Card";
import Controls from "../../components/Controls";
import PlayerStatusBoard from "../../components/PlayerStatusBoard";
import Modal from "../../components/Modal";
import Notification from "../../components/Notification";
import TableSummaryPanel from "../../components/TableSummaryPanel";
import HandResultOverlay from "../../components/HandResultOverlay";
import ShowdownResultToast from "../../components/ShowdownResultToast.jsx";
import HeroBustOverlay from "../../components/HeroBustOverlay.jsx";
import TournamentResultOverlay from "../../components/TournamentResultOverlay.jsx";
import useCardScaleVars from "../../hooks/useCardScaleVars.js";

const MOBILE_SEAT_GRID_AREA = {
  0: "hero",
  1: "leftMid",
  2: "topLeft",
  3: "topCenter",
  4: "topRight",
  5: "rightMid",
};

const MOBILE_SEAT_ALIGN_CLASS = {
  0: "items-center",
  1: "items-start",
  2: "items-start",
  3: "items-center",
  4: "items-end",
  5: "items-end",
};

const MOBILE_TABLE_GRID_STYLE = {
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gridTemplateRows: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.92fr)",
  gridTemplateAreas: `
    "topLeft topCenter topRight"
    "leftMid pot rightMid"
    ". hero ."
  `,
};

const MOBILE_CARD_VARS = {
  "--card-w": "clamp(24px, 4.4dvw, 38px)",
  "--card-h": "clamp(34px, 6.2dvw, 54px)",
  "--card-font-size": "clamp(10px, 1.8dvw, 16px)",
  "--card-dot-size": "clamp(5px, 0.9dvw, 8px)",
  "--card-center-size": "clamp(24px, 3.8dvw, 40px)",
  "--card-center-inner-size": "clamp(10px, 1.6dvw, 16px)",
  "--player-pad": "clamp(5px, 0.9dvw, 8px)",
  "--player-gap": "clamp(4px, 0.7dvw, 7px)",
  "--player-avatar-size": "clamp(22px, 3.4dvw, 32px)",
  "--player-avatar-font-size": "clamp(10px, 1.5dvw, 13px)",
  "--player-name-size": "clamp(11px, 1.55dvw, 14px)",
  "--player-meta-size": "clamp(7px, 1.05dvw, 9px)",
  "--player-stack-size": "clamp(8px, 1.1dvw, 10px)",
  "--player-action-size": "clamp(8px, 1.15dvw, 10px)",
  "--player-card-gap": "clamp(4px, 0.7dvw, 7px)",
  "--player-card-strip-maxw": "clamp(124px, 28dvw, 180px)",
  "--player-name-maxw": "clamp(72px, 12dvw, 130px)",
  "--player-action-min-h": "clamp(10px, 1.8dvw, 16px)",
};

export default function GameLayoutBase({
  headerProps,
  sidePanelProps,
  tableProps,
  overlaysProps,
  controlsProps,
  debugProps,
  debugFlags,
  layoutMode = "desktop",
}) {
  const isMobileLayout = layoutMode === "mobile";
  const disableFixed = Boolean(debugFlags?.nofixed);
  const disableVh = Boolean(debugFlags?.novh);
  const {
    ratingState,
    rankInfo,
    gameTitle = "Badugi App",
    labels = {},
    onNavigateTitle,
    onNavigateLeaderboard,
    onNavigateSettings,
    onNavigateProfile,
    onNavigateHistory,
  } = headerProps;

  const {
    show: showSidePanel,
    statusBoardOpen,
    onToggleStatusBoard,
    seatViews: statusSeatViews,
    dealerIdx: statusDealerIdx,
    heroIndex: statusHeroIndex,
    turn: statusTurn,
    totalPot,
    seatLabels,
    notificationVariant,
    notificationMessage,
    seatManagerOpen,
    onCloseSeatManager,
    autoRotateSeats,
    onToggleAutoRotateSeats,
    seatConfig,
    seatTypeOptions,
    onSeatTypeChange,
    startingStack,
    onStartingStackChange,
    onRotateSeatConfig,
    onResetSeatConfig,
    onRedeal,
    p2pCaptureEnabled,
    onToggleP2pCapture,
    onExportP2pMatches,
    aiDecisionSummary,
  } = sidePanelProps;

  const {
    tableOuterBg,
    tournamentHud,
    tableSurfaceBg,
    heroTableAnimating,
    isTournament,
    tableSummaryProps,
    seatViews: tableSeatViews,
    seatLayouts,
    heroSeatIndex,
    heroDrawSelection,
    heroCanDraw: tableHeroCanDraw,
    controllerTurn,
    controllerDealerIdx,
    positionNameFn,
    handleCardClick,
    tablePhase,
    phase,
    drawRoundValue,
    betRoundValue,
    boardCards = [],
    streetLabel = "",
    gameVariant = "badugi",
  } = tableProps;

  const {
    handResultVisible,
    handResultSummary,
    onNextHand,
    nextHandLabel,
    onReplayTarget,
    mode,
    heroBustOverlayVisible,
    heroBustSummary,
    tournamentTitle,
    tournamentOverlayVisible,
    tournamentPlacements,
    onTournamentBackToMenu,
    onTournamentPlayAgain,
  } = overlaysProps;

  const {
    heroCanAct,
    heroPlayerForControls,
    controlsPhase,
    controlsCurrentBet,
    actionPanelInfo,
    playerFold,
    playerCall,
    playerCheck,
    playerRaise,
    drawSelected,
    showNextButton,
    heroCanDraw: controlsHeroCanDraw,
    nextHandLabel: controlsNextHandLabel,
    onNextHand: controlsOnNextHand,
    isCashGame,
    onCashOut,
  } = controlsProps;

  const { debugMode, onToggleDebugMode } = debugProps;
  const isShowdownPhase = phase === "SHOWDOWN" || tablePhase === "SHOWDOWN";
  const showDesktopSidePanel = showSidePanel && !isMobileLayout;
  const desktopSectionClass = showDesktopSidePanel
    ? "pl-[290px] pr-5 pt-[5.5rem] pb-[4.5rem] gap-6"
    : isTournament
      ? "px-4 pt-[5.25rem] pb-[3.5rem] gap-4"
      : "px-5 pt-[5.5rem] pb-[4.5rem] gap-6";
  const desktopGridClass = isTournament
    ? "grid-cols-[minmax(820px,1fr)_clamp(280px,20vw,340px)] gap-3"
    : "grid-cols-[minmax(720px,1fr)_clamp(260px,22vw,340px)] gap-4";
  const desktopTableMinHeight = isTournament ? "min-h-[540px]" : "min-h-[600px]";
  const mobileLandscapeClass = isMobileLayout
    ? "mgx-mobile-landscape fixed inset-0 h-screen w-screen overflow-hidden"
    : "";
  const mainLayoutClass = isMobileLayout
    ? "h-full overflow-hidden"
    : isTournament
      ? "h-screen overflow-hidden"
      : "mt-20";
  const rootSizingClass = !isMobileLayout && isTournament && !disableVh
    ? "h-screen overflow-hidden"
    : isMobileLayout
      ? "h-screen overflow-hidden"
    : disableVh
      ? "h-auto"
      : "min-h-screen";
  const layoutRootRef = useRef(null);
  const cardScaleVars = useCardScaleVars(layoutRootRef);
  const feltOvalClass = isMobileLayout
    ? "inset-x-[10%] inset-y-[35%] border-[8px]"
    : "inset-x-[3%] inset-y-[26%] border-[10px]";
  const feltInnerRingClass = isMobileLayout
    ? "inset-x-[12%] inset-y-[38%]"
    : "inset-x-[8%] inset-y-[30%]";
  const feltInnerRingSoftClass = isMobileLayout
    ? "inset-x-[18%] inset-y-[42%]"
    : "inset-x-[14%] inset-y-[34%]";
  const rootStyle = isMobileLayout
    ? { ...cardScaleVars, ...MOBILE_CARD_VARS, height: disableVh ? "100vh" : "100dvh" }
    : disableVh
      ? cardScaleVars
      : { ...cardScaleVars, minHeight: "100dvh" };

  const renderControlsContent = () => {
    if (heroCanAct && heroPlayerForControls) {
      if (controlsPhase === "BET") {
        return (
          <Controls
            phase="BET"
            currentBet={controlsCurrentBet}
            player={heroPlayerForControls}
            onFold={playerFold}
            onCall={playerCall}
            onCheck={playerCheck}
            onRaise={playerRaise}
            canRaise={!actionPanelInfo?.capReached}
            layoutMode={layoutMode}
            className={isMobileLayout ? "w-full" : undefined}
          />
        );
      }
      if (controlsPhase === "DRAW") {
        return (
          <Controls
            phase="DRAW"
            player={heroPlayerForControls}
            onDraw={drawSelected}
            canDraw={controlsHeroCanDraw}
            layoutMode={layoutMode}
            className={isMobileLayout ? "w-full" : undefined}
          />
        );
      }
    }
    return (
      <p className="text-sm text-slate-400 text-center w-full">
        Waiting for other players…
      </p>
    );
  };

  const nextHandButton =
    showNextButton && !handResultVisible ? (
      <button
        onClick={controlsOnNextHand}
        className={
          isMobileLayout
            ? "w-full py-3 rounded-2xl bg-yellow-500 text-black font-semibold shadow-lg"
            : "px-6 py-3 bg-yellow-500 text-black font-bold rounded shadow-lg"
        }
      >
        {controlsNextHandLabel}
      </button>
    ) : null;

  return (
    <div
      ref={layoutRootRef}
      className={`flex flex-col ${rootSizingClass} ${mobileLandscapeClass} bg-gray-900 text-white`}
      style={rootStyle}
    >
      <header
        className={`${
          isMobileLayout ? "hidden" : "flex"
        } flex-col gap-3 bg-gray-900/95 backdrop-blur-md shadow-md ${
          disableFixed ? "relative" : "fixed top-0 left-0 right-0"
        } z-50 ${
          isMobileLayout ? "px-4 py-2" : "px-6 py-3"
        }`}
      >
        <div
          className={`flex items-center ${
            isMobileLayout ? "justify-between" : "justify-between gap-6"
          }`}
        >
          <h1 className={`font-bold ${isMobileLayout ? "text-xl" : "text-2xl"}`}>{gameTitle}</h1>
          <div
            className={`flex ${
              isMobileLayout
                ? "flex-col items-end text-[10px] text-slate-300 gap-1"
                : "items-center gap-4 text-xs text-slate-200"
            }`}
          >
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-slate-400">
                {labels.globalRating ?? "Global Rating"}
              </p>
              <strong className="text-lg text-white">
                {Math.round(ratingState.globalRating ?? 1500)}
              </strong>
            </div>
            <div className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold uppercase tracking-wider">
              {rankInfo.label}
            </div>
            {!isMobileLayout && (
              <div className="text-[11px] text-slate-300">
                {labels.skill ?? "Skill"} {Math.round(ratingState.skillRating ?? 1500)} |{" "}
                {labels.mixed ?? "Mixed"}{" "}
                {Math.round(ratingState.mixedRating ?? 1500)}
              </div>
            )}
            <button
              onClick={onNavigateLeaderboard}
              className={`rounded-full border border-white/30 font-semibold uppercase tracking-wide transition ${
                isMobileLayout ? "px-2 py-1 text-[10px]" : "px-3 py-1 text-[11px]"
              }`}
            >
              {labels.leaderboard ?? "Leaderboard"}
            </button>
          </div>
        </div>
        <nav
          className={`flex ${
            isMobileLayout ? "gap-2 text-[11px] overflow-x-auto" : "gap-4"
          }`}
        >
          <button type="button" onClick={onNavigateTitle} className="hover:text-yellow-400 transition">
            {labels.mainMenu ?? "Title"}
          </button>
          <button onClick={onNavigateSettings} className="hover:text-yellow-400 transition">
            {labels.settings ?? "Settings"}
          </button>
          <button onClick={onNavigateProfile} className="hover:text-yellow-400 transition">
            {labels.profile ?? "Profile"}
          </button>
          <button onClick={onNavigateHistory} className="hover:text-yellow-400 transition">
            {labels.history ?? "History"}
          </button>
        </nav>
      </header>

      <main
        className={`flex-1 ${mainLayoutClass} relative ${tableOuterBg}`}
      >
        {showDesktopSidePanel && (
          <div className="absolute top-5 left-5 z-40 flex w-[250px] flex-col gap-3 pointer-events-none">
            <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/70 p-3 text-xs text-white shadow-xl backdrop-blur space-y-3">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Table Status</span>
                <button
                  type="button"
                  onClick={onToggleStatusBoard}
                  className="text-[11px] font-semibold text-yellow-300 hover:text-yellow-200 transition"
                >
                  {statusBoardOpen ? "Hide" : "Show"}
                </button>
              </div>
              {statusBoardOpen && (
                <PlayerStatusBoard
                  players={statusSeatViews}
                  dealerIdx={statusDealerIdx}
                  heroIndex={statusHeroIndex}
                  turn={statusTurn}
                  totalPot={totalPot}
                  positionLabels={seatLabels}
                />
              )}
            </div>
            <TableSummaryPanel {...tableSummaryProps} />
            {aiDecisionSummary?.total > 0 && (
              <div className="pointer-events-auto bg-black/70 rounded-lg p-3 text-xs space-y-3 shadow-lg">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                  <span>CPU Decisions</span>
                  <strong className="text-emerald-300">{aiDecisionSummary.total}</strong>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                  {Object.entries(aiDecisionSummary.byTier ?? {}).map(([tier, count]) => (
                    <span key={tier} className="rounded bg-slate-800/80 px-2 py-1">
                      {tier}: {count}
                    </span>
                  ))}
                </div>
                <div className="space-y-1">
                  {(aiDecisionSummary.recent ?? []).map((entry, index) => (
                    <div
                      key={`${entry.handId ?? "hand"}-${entry.seat ?? "seat"}-${entry.ts}-${index}`}
                      className="rounded border border-white/10 bg-slate-950/70 px-2 py-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-100 truncate">
                          {entry.seatName}
                        </span>
                        <span className="text-[10px] uppercase text-slate-400">
                          {entry.tierId ?? "tier?"}
                        </span>
                      </div>
                      <div className="text-slate-300">
                        {entry.phase} {entry.action}
                        {entry.reason ? ` (${entry.reason})` : ""}
                      </div>
                      {entry.discardIndexes?.length > 0 && (
                        <div className="text-[10px] text-slate-400">
                          discard: {entry.discardIndexes.join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <section
          className={`flex h-full flex-col ${
            isMobileLayout ? "gap-0 p-2" : desktopSectionClass
          }`}
          style={
            isMobileLayout
              ? {
                  paddingLeft: "max(8px, env(safe-area-inset-left))",
                  paddingRight: "max(8px, env(safe-area-inset-right))",
                  paddingTop: "max(6px, env(safe-area-inset-top))",
                  paddingBottom: "max(6px, env(safe-area-inset-bottom))",
                }
              : undefined
          }
        >
          <div
            className={`flex flex-col ${
              isMobileLayout ? "h-full min-h-0 gap-0 rounded-none border-0 bg-transparent p-0 shadow-none" : "gap-5 rounded-3xl border border-white/10 bg-black/40 p-3 shadow-2xl"
            }`}
          >
            <div
              className={`relative grid ${
                isMobileLayout
                  ? "h-full min-h-0 grid-cols-1 grid-rows-[minmax(0,1fr)_auto] gap-2 min-[641px]:grid-cols-[minmax(0,1fr)_clamp(190px,29dvw,286px)] min-[641px]:grid-rows-1"
                  : desktopGridClass
              }`}
            >
              <div
                className={`relative min-w-0 overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/28 ${
                  heroTableAnimating ? "ring-2 ring-yellow-300 animate-pulse" : ""
                } ${isMobileLayout ? "min-h-0 p-2" : "overflow-visible p-4"} shadow-[inset_0_0_45px_rgba(0,0,0,0.38),0_18px_42px_rgba(0,0,0,0.35)]`}
              >
                <div
                  data-testid="table-felt-oval"
                  className={`pointer-events-none absolute ${feltOvalClass} rounded-[50%] border-slate-950/80 ${tableSurfaceBg} shadow-[inset_0_0_65px_rgba(0,0,0,0.42)]`}
                />
                <div className={`pointer-events-none absolute ${feltInnerRingClass} rounded-[50%] border border-white/10`} />
                <div className={`pointer-events-none absolute ${feltInnerRingSoftClass} rounded-[50%] border border-white/5`} />
                {!isTournament && tournamentHud}
                <div
                  className={`relative ${
                    isMobileLayout
                      ? "grid h-full min-h-0 gap-1"
                      : desktopTableMinHeight
                  }`}
                  style={isMobileLayout ? MOBILE_TABLE_GRID_STYLE : undefined}
                >
                  <div
                    className={`pointer-events-none ${
                      isMobileLayout
                        ? "z-10 flex items-center justify-center"
                        : `absolute left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 ${
                            boardCards.length > 0 ? "top-[58%]" : "top-[48%]"
                          }`
                    }`}
                    style={isMobileLayout ? { gridArea: "pot" } : undefined}
                  >
                      <div
                        data-testid="table-total-pot"
                        className={`rounded-full border border-yellow-200/45 bg-black/55 text-center shadow-lg backdrop-blur ${
                          isMobileLayout ? "px-3 py-1.5" : "px-5 py-2"
                        }`}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-yellow-100/80">
                          Total Pot
                        </p>
                        <p className="text-lg font-black text-yellow-200">{totalPot}</p>
                      </div>
                      <div
                        data-testid="table-phase-badge"
                        className={`${isMobileLayout ? "ml-1 px-2" : "px-3"} rounded-full bg-black/45 py-1 text-[11px] font-semibold text-slate-200`}
                      >
                        {boardCards.length > 0 || streetLabel
                          ? `${tablePhase} · ${streetLabel || "Board"}`
                          : `${tablePhase} · Draw ${drawRoundValue + 1}`}
                      </div>
                  </div>
                  {boardCards.length > 0 && (
                    <div
                      className={`absolute left-1/2 z-20 flex -translate-x-1/2 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-3 py-2 shadow-xl backdrop-blur ${
                        isMobileLayout ? "top-[44%]" : "top-[38%]"
                      }`}
                    >
                      {boardCards.map((card, idx) => (
                        <Card key={`${card}-${idx}`} value={card} data-testid={`board-card-${idx}`} />
                      ))}
                    </div>
                  )}
                  {seatLayouts.map((_, idx) => {
                    const seat = tableSeatViews[idx];
                    if (!seat) return null;
                    const seatPosition = positionNameFn(idx, controllerDealerIdx, seatLayouts.length);
                    const renderedSeat =
                      seat.seatIndex === heroSeatIndex
                        ? { ...seat, selected: heroDrawSelection }
                        : seat;
                    const seatAlignClass = isMobileLayout
                      ? MOBILE_SEAT_ALIGN_CLASS[idx] ?? "items-center"
                      : "items-center";
                    const mobileSeatLiftClass =
                      isMobileLayout && seat.seatIndex === heroSeatIndex
                        ? "-translate-y-7"
                        : "";
                    return (
                      <div
                        key={seat.seatIndex ?? idx}
                        className={`flex flex-col ${seatAlignClass} ${mobileSeatLiftClass} ${isMobileLayout ? "gap-1" : "gap-3"} overflow-visible hover:z-[180] focus-within:z-[180] ${
                          isMobileLayout ? "" : seatLayouts[idx] ?? ""
                        }`}
                        style={
                          isMobileLayout
                            ? { gridArea: MOBILE_SEAT_GRID_AREA[idx] ?? "topCenter" }
                            : undefined
                        }
                      >
                        <Player
                          player={renderedSeat}
                          index={idx}
                          selfIndex={heroSeatIndex}
                          dealerIdx={controllerDealerIdx}
                          turn={controllerTurn}
                          phase={phase}
                          positionLabel={seatPosition}
                          canSelectForDraw={tableHeroCanDraw && seat.seatIndex === heroSeatIndex}
                          isWinner={seat.winner}
                          onCardClick={(cardIdx) => handleCardClick(cardIdx)}
                          compact={isMobileLayout}
                          revealMode={isShowdownPhase}
                          displayVariant={gameVariant}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div
                data-testid="decision-panel"
                className={`flex min-h-0 min-w-0 flex-col ${
                  isMobileLayout
                    ? "mgx-mobile-action-sheet gap-2 overflow-hidden pb-[max(0px,env(safe-area-inset-bottom))]"
                    : "gap-3"
                }`}
              >
                {isTournament && tournamentHud}
                <div className={`${isMobileLayout ? "p-2" : "p-3"} flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/85 shadow-lg`}>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">
                      Phase
                    </p>
                    <p className={`${isMobileLayout ? "text-base" : "text-xl"} font-bold text-white`}>{tablePhase}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Draw</p>
                    <p className="text-base font-semibold text-white">{drawRoundValue + 1}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">Bet Round</p>
                    <p className="text-base font-semibold text-white">{betRoundValue + 1}</p>
                  </div>
                </div>
                <div className={`${isMobileLayout ? "hidden" : "flex"} flex-col gap-2 rounded-2xl border border-white/10 bg-slate-900/85 p-3 shadow-lg`}>
                  <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
                    Hero Hand
                  </h2>
                  <div className="flex flex-wrap gap-2 text-slate-200 text-sm">
                    {heroDrawSelection.map((card, idx) => (
                      <span
                        key={`${card}-${idx}`}
                        className="rounded-full bg-slate-800/70 px-2 py-1 text-xs font-semibold"
                      >
                        {card}
                      </span>
                    ))}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Draw allowed: {tableHeroCanDraw ? "Yes" : "No"}
                  </div>
                </div>
                <div className={`${isMobileLayout ? "min-h-0 min-w-0 overflow-hidden p-2" : "p-3"} rounded-2xl border border-emerald-300/15 bg-slate-900/88 shadow-lg space-y-3`}>
                  <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
                    Hero Controls
                  </h2>
                  <div
                    data-testid="action-context-panel"
                    className="grid grid-cols-2 gap-2 text-[11px] text-slate-200"
                  >
                    <div className="rounded-xl border border-white/10 bg-black/30 px-2 py-1.5">
                      <p className="uppercase tracking-wide text-slate-500">Current Bet</p>
                      <p className="font-black text-white">{actionPanelInfo?.currentBet ?? 0}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/30 px-2 py-1.5">
                      <p className="uppercase tracking-wide text-slate-500">To Call</p>
                      <p className="font-black text-yellow-200">{actionPanelInfo?.toCall ?? 0}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/30 px-2 py-1.5">
                      <p className="uppercase tracking-wide text-slate-500">Raise Unit</p>
                      <p className="font-black text-white">{actionPanelInfo?.raiseUnit ?? 0}</p>
                    </div>
                    <div
                      className={`rounded-xl border px-2 py-1.5 ${
                        actionPanelInfo?.capReached
                          ? "border-red-300/40 bg-red-500/15"
                          : "border-white/10 bg-black/30"
                      }`}
                    >
                      <p className="uppercase tracking-wide text-slate-500">Raise Cap</p>
                      <p className="font-black text-white">
                        {actionPanelInfo?.raiseCount ?? 0}/{actionPanelInfo?.raiseCap ?? 4}
                      </p>
                    </div>
                  </div>
                  <div>{renderControlsContent()}</div>
                  {isCashGame && (
                    <button
                      type="button"
                      onClick={onCashOut}
                      className="w-full rounded-xl border border-yellow-300/30 bg-yellow-400/10 px-3 py-2 text-sm font-black text-yellow-100 transition hover:bg-yellow-400 hover:text-slate-950"
                    >
                      Cash Out
                    </button>
                  )}
                  {nextHandButton}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {!isMobileLayout && debugMode && (
        <footer
          className={`${disableFixed ? "relative" : "fixed bottom-0 left-0 right-0"} flex items-center justify-between border-t border-white/10 bg-black/80 p-4 text-xs text-slate-300 backdrop-blur`}
        >
          <div className="flex items-center gap-2">
            <span>Debug</span>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <span>Mode</span>
              <input type="checkbox" checked={debugMode} onChange={onToggleDebugMode} />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-[11px] uppercase tracking-wider">Mode: {mode}</p>
            <p className="text-[11px] uppercase tracking-wider">Tournament: {isTournament ? "Yes" : "No"}</p>
          </div>
        </footer>
      )}

      {!isMobileLayout && <Notification variant={notificationVariant} message={notificationMessage} />}

      <Modal
        title="Seat Manager"
        open={seatManagerOpen}
        onClose={onCloseSeatManager}
        primaryActionLabel="Save"
        secondaryActionLabel="Close"
        onPrimaryAction={onCloseSeatManager}
        onSecondaryAction={onCloseSeatManager}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Auto Rotate Seats</span>
            <input
              type="checkbox"
              checked={autoRotateSeats}
              onChange={(event) => onToggleAutoRotateSeats(event.target.checked)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-slate-400">Seat Layout</label>
            <select
              className="w-full rounded border border-white/20 bg-slate-900/80 px-3 py-2 text-sm"
              value={seatConfig}
              onChange={(event) => onSeatTypeChange(event.target.value)}
            >
              {seatTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-slate-400">Starting Stack</label>
            <input
              type="number"
              className="w-full rounded border border-white/20 bg-slate-900/80 px-3 py-2 text-sm"
              value={startingStack}
              onChange={(event) => onStartingStackChange(Number(event.target.value))}
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onRotateSeatConfig}
              className="flex-1 rounded border border-white/20 py-2 text-sm font-semibold"
            >
              Rotate
            </button>
            <button
              type="button"
              onClick={onResetSeatConfig}
              className="flex-1 rounded border border-white/20 py-2 text-sm font-semibold"
            >
              Reset
            </button>
          </div>
          <button
            type="button"
            onClick={onRedeal}
            className="w-full rounded bg-yellow-500 py-2 text-sm font-semibold text-black"
          >
            Redeal
          </button>
        </div>
      </Modal>

      <Modal
        title="Capture Settings"
        open={Boolean(p2pCaptureEnabled)}
        onClose={() => onToggleP2pCapture(false)}
        primaryActionLabel="Export"
        secondaryActionLabel="Close"
        onPrimaryAction={onExportP2pMatches}
        onSecondaryAction={() => onToggleP2pCapture(false)}
      >
        <p className="text-sm text-slate-300">
          Export your head-to-head match data for analysis. Coming soon.
        </p>
      </Modal>

      <HandResultOverlay
        visible={handResultVisible}
        summary={handResultSummary}
        onNext={onNextHand}
        buttonLabel={nextHandLabel}
        onReplayTarget={onReplayTarget}
      />
      <ShowdownResultToast visible={handResultVisible} summary={handResultSummary} />
      <HeroBustOverlay
        visible={heroBustOverlayVisible}
        title={heroBustSummary?.title}
        heroSummary={heroBustSummary?.hero}
        inMoneyPlacements={heroBustSummary?.inMoney ?? []}
        onBackToMenu={onTournamentBackToMenu}
      />
      <TournamentResultOverlay
        visible={tournamentOverlayVisible}
        placements={tournamentPlacements}
        title={tournamentTitle}
        onBackToMenu={onTournamentBackToMenu}
        onPlayAgain={onTournamentPlayAgain}
      />
    </div>
  );
}
