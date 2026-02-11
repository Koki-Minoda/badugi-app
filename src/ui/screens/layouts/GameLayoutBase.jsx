import React from "react";
import Player from "../../components/Player";
import Controls from "../../components/Controls";
import PlayerStatusBoard from "../../components/PlayerStatusBoard";
import Modal from "../../components/Modal";
import Notification from "../../components/Notification";
import TableSummaryPanel from "../../components/TableSummaryPanel";
import HandResultOverlay from "../../components/HandResultOverlay";
import HeroBustOverlay from "../../components/HeroBustOverlay.jsx";
import TournamentResultOverlay from "../../components/TournamentResultOverlay.jsx";

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
    onOpenSeatManager,
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
    heroTracker,
    heroTrackerTotal,
    heroWinRate,
    tierOptions,
    devTierOverride,
    onTierOverrideChange,
    onClearTierOverride,
    p2pCaptureEnabled,
    onToggleP2pCapture,
    onExportP2pMatches,
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
    players,
    heroSeatIndex,
    heroDrawSelection,
    heroCanDraw: tableHeroCanDraw,
    controllerTurn,
    controllerDealerIdx,
    positionNameFn,
    clonePlayerStateFn,
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
    <div className={`flex flex-col ${disableVh ? "h-auto" : "h-screen"} bg-gray-900 text-white`}>
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
          <h1 className={`font-bold ${isMobileLayout ? "text-xl" : "text-2xl"}`}>Badugi App</h1>
          <div
            className={`flex ${
              isMobileLayout
                ? "flex-col items-end text-[10px] text-slate-300 gap-1"
                : "items-center gap-4 text-xs text-slate-200"
            }`}
          >
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-slate-400">Global Rating</p>
              <strong className="text-lg text-white">
                {Math.round(ratingState.globalRating ?? 1500)}
              </strong>
            </div>
            <div className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold uppercase tracking-wider">
              {rankInfo.label}
            </div>
            {!isMobileLayout && (
              <div className="text-[11px] text-slate-300">
                Skill {Math.round(ratingState.skillRating ?? 1500)} | Mixed{" "}
                {Math.round(ratingState.mixedRating ?? 1500)}
              </div>
            )}
            <button
              onClick={onNavigateLeaderboard}
              className={`rounded-full border border-white/30 font-semibold uppercase tracking-wide transition ${
                isMobileLayout ? "px-2 py-1 text-[10px]" : "px-3 py-1 text-[11px]"
              }`}
            >
              Leaderboard
            </button>
          </div>
        </div>
        <nav
          className={`flex ${
            isMobileLayout ? "gap-2 text-[11px] overflow-x-auto" : "gap-4"
          }`}
        >
          <button type="button" onClick={onNavigateTitle} className="hover:text-yellow-400 transition">
            Title
          </button>
          <button onClick={onNavigateSettings} className="hover:text-yellow-400 transition">
            Settings
          </button>
          <button onClick={onNavigateProfile} className="hover:text-yellow-400 transition">
            Profile
          </button>
          <button onClick={onNavigateHistory} className="hover:text-yellow-400 transition">
            History
          </button>
        </nav>
      </header>

      <main
        className={`flex-1 ${isMobileLayout ? "mt-16 pb-36" : "mt-20"} relative ${tableOuterBg}`}
      >
        {showDesktopSidePanel && (
          <div className="absolute top-6 left-6 z-40 flex flex-col gap-4 w-[280px] pointer-events-none">
            <div className="pointer-events-auto bg-black/70 text-white text-xs rounded-lg p-3 shadow-lg space-y-3">
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
              <PlayerStatusBoard
                players={statusSeatViews}
                dealerIdx={statusDealerIdx}
                heroIndex={statusHeroIndex}
                currentTurn={statusTurn}
              />
            </div>
            <TableSummaryPanel {...tableSummaryProps} />
            <div className="pointer-events-auto bg-black/70 rounded-lg p-3 text-xs space-y-3 shadow-lg">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                <span>Total Pot</span>
                <strong className="text-yellow-300 text-lg">{totalPot}</strong>
              </div>
              <div className="space-y-1">
                {seatLabels.map((label) => (
                  <p key={label} className="text-slate-200">
                    {label}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        <section
          className={`flex h-full flex-col ${
            isMobileLayout ? "px-3 pt-20 pb-10 gap-6" : "pl-[320px] pr-6 pt-24 pb-10 gap-8"
          }`}
        >
          <div
            className={`flex flex-col ${
              isMobileLayout ? "gap-4" : "gap-6"
            } rounded-3xl border border-white/10 bg-black/40 p-4 shadow-2xl`}
          >
            <div
              className={`relative grid ${
                isMobileLayout ? "grid-cols-1 gap-4" : "grid-cols-[3fr_2fr] gap-8"
              }`}
            >
              <div
                className={`relative rounded-3xl border-2 ${tableBorderColor} ${
                  heroTableAnimating ? "ring-2 ring-yellow-300 animate-pulse" : ""
                } ${tableSurfaceBg} p-4 shadow-inner`}
              >
                {tournamentHud}
                <div
                  className={`relative ${
                    isMobileLayout
                      ? "grid grid-cols-2 gap-3"
                      : "grid grid-cols-3 gap-6"
                  }`}
                >
                  {seatLayouts.map((layout, idx) => {
                    const seat = tableSeatViews[idx];
                    if (!seat) return null;
                    const isHero = idx === heroSeatIndex;
                    const seatPosition = positionNameFn(idx, controllerDealerIdx, seatLayouts.length);
                    return (
                      <div
                        key={seat.seatIndex ?? idx}
                        className={`flex flex-col ${
                          layout.align === "center" ? "items-center" : layout.align === "left" ? "items-start" : "items-end"
                        } gap-3`}
                      >
                        <Player
                          player={seat}
                          index={idx}
                          selfIndex={heroSeatIndex}
                          dealerIdx={controllerDealerIdx}
                          turn={controllerTurn}
                          phase={phase}
                          positionLabel={seatPosition}
                          canSelectForDraw={tableHeroCanDraw && seat.seatIndex === heroSeatIndex}
                          isWinner={seat.winner}
                          onCardClick={(cardIdx) => handleCardClick(idx, cardIdx)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between rounded-2xl bg-slate-900/80 p-4 shadow-lg">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-400">
                      Phase
                    </p>
                    <p className="text-2xl font-bold text-white">{tablePhase}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wider text-slate-400">Draw</p>
                    <p className="text-lg text-white">{drawRoundValue + 1}</p>
                    <p className="text-xs uppercase tracking-wider text-slate-400 mt-2">Bet Round</p>
                    <p className="text-lg text-white">{betRoundValue + 1}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 rounded-2xl bg-slate-900/80 p-4 shadow-lg">
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
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
                  <div className="text-xs text-slate-400">
                    Draw allowed: {tableHeroCanDraw ? "Yes" : "No"}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-900/80 p-4 shadow-lg space-y-3">
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
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
        onNextHand={onNextHand}
        nextHandLabel={nextHandLabel}
      />
      <HeroBustOverlay visible={heroBustOverlayVisible} summary={heroBustSummary} />
      <TournamentResultOverlay
        visible={tournamentOverlayVisible}
        placements={tournamentPlacements}
        tournamentTitle={tournamentTitle}
        onBackToMenu={onTournamentBackToMenu}
        onPlayAgain={onTournamentPlayAgain}
      />
    </div>
  );
}
