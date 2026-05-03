import React, { useRef } from "react";
import Player from "../../components/Player";
import Controls from "../../components/Controls";
import PlayerStatusBoard from "../../components/PlayerStatusBoard";
import Modal from "../../components/Modal";
import Notification from "../../components/Notification";
import TableSummaryPanel from "../../components/TableSummaryPanel";
import HandResultOverlay from "../../components/HandResultOverlay";
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
  gridTemplateAreas: `
    "topLeft topCenter topRight"
    "leftMid . rightMid"
    ". hero ."
  `,
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
    tableBorderColor,
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
    playerFold,
    playerCall,
    playerCheck,
    playerRaise,
    drawSelected,
    showNextButton,
    heroCanDraw: controlsHeroCanDraw,
    nextHandLabel: controlsNextHandLabel,
    onNextHand: controlsOnNextHand,
  } = controlsProps;

  const { debugMode, onToggleDebugMode } = debugProps;
  const showDesktopSidePanel = showSidePanel && !isMobileLayout;
  const layoutRootRef = useRef(null);
  const cardScaleVars = useCardScaleVars(layoutRootRef);
  const rootStyle = disableVh
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
      className={`flex flex-col ${disableVh ? "h-auto" : "min-h-screen"} bg-gray-900 text-white`}
      style={rootStyle}
    >
      <header
        className={`flex flex-col gap-3 bg-gray-900/95 backdrop-blur-md shadow-md ${
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
        className={`flex-1 ${isMobileLayout ? "mt-16 pb-36" : "mt-20"} relative ${tableOuterBg}`}
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
            isMobileLayout ? "px-3 pt-20 pb-10 gap-6" : "pl-[290px] pr-5 pt-[5.5rem] pb-[4.5rem] gap-6"
          }`}
        >
          <div
            className={`flex flex-col ${
              isMobileLayout ? "gap-4" : "gap-5"
            } rounded-3xl border border-white/10 bg-black/40 p-3 shadow-2xl`}
          >
            <div
              className={`relative grid ${
                isMobileLayout
                  ? "grid-cols-1 gap-4"
                  : "grid-cols-[minmax(720px,1fr)_clamp(260px,22vw,340px)] gap-4"
              }`}
            >
              <div
                className={`relative rounded-3xl border-2 ${tableBorderColor} ${
                  heroTableAnimating ? "ring-2 ring-yellow-300 animate-pulse" : ""
                } ${tableSurfaceBg} p-3 shadow-inner`}
              >
                {tournamentHud}
                <div
                  className={`relative ${
                    isMobileLayout
                      ? "grid gap-3"
                      : "min-h-[600px]"
                  }`}
                  style={isMobileLayout ? MOBILE_TABLE_GRID_STYLE : undefined}
                >
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
                    return (
                      <div
                        key={seat.seatIndex ?? idx}
                        className={`flex flex-col ${seatAlignClass} gap-3 ${
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
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div data-testid="decision-panel" className="flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/85 p-3 shadow-lg">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">
                      Phase
                    </p>
                    <p className="text-xl font-bold text-white">{tablePhase}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Draw</p>
                    <p className="text-base font-semibold text-white">{drawRoundValue + 1}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">Bet Round</p>
                    <p className="text-base font-semibold text-white">{betRoundValue + 1}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-900/85 p-3 shadow-lg">
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
                <div className="rounded-2xl border border-emerald-300/15 bg-slate-900/88 p-3 shadow-lg space-y-3">
                  <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
                    Hero Controls
                  </h2>
                  <div>{renderControlsContent()}</div>
                  {nextHandButton}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer
        className={`${disableFixed ? "relative" : "fixed bottom-0 left-0 right-0"} bg-black/80 backdrop-blur border-t border-white/10 ${
          isMobileLayout ? "p-3" : "p-4"
        } flex items-center justify-between text-xs text-slate-300`}
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

      <Notification variant={notificationVariant} message={notificationMessage} />

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
