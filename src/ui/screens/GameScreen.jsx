import React from "react";
import Player from "../components/Player";
import Controls from "../components/Controls";
import PlayerStatusBoard from "../components/PlayerStatusBoard";
import Modal from "../components/Modal";
import Notification from "../components/Notification";
import TableSummaryPanel from "../components/TableSummaryPanel";
import HandResultOverlay from "../components/HandResultOverlay";
import HeroBustOverlay from "../components/HeroBustOverlay.jsx";
import TournamentResultOverlay from "../components/TournamentResultOverlay.jsx";

export default function GameScreen({
  headerProps,
  sidePanelProps,
  tableProps,
  overlaysProps,
  controlsProps,
  debugProps,
  layoutMode = "desktop",
}) {
  const isMobileLayout = layoutMode === "mobile";
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
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <header
        className={`flex flex-col gap-3 bg-gray-900/95 backdrop-blur-md shadow-md fixed top-0 left-0 right-0 z-50 ${
          isMobileLayout ? "px-4 py-2" : "px-6 py-3"
        }`}
      >
        <div
          className={`flex items-center ${
            isMobileLayout
              ? "justify-between"
              : "justify-between gap-6"
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
                Skill {Math.round(ratingState.skillRating ?? 1500)} | Mixed {Math.round(ratingState.mixedRating ?? 1500)}
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
        className={`flex-1 ${isMobileLayout ? "mt-16 pb-36" : "mt-20"} relative ${
          tableOuterBg
        }`}
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
              {statusBoardOpen && (
                <div className="overflow-hidden rounded-xl shadow-inner border border-yellow-500/30">
                  <PlayerStatusBoard
                    players={statusSeatViews}
                    dealerIdx={statusDealerIdx}
                    heroIndex={statusHeroIndex}
                    turn={statusTurn}
                    totalPot={totalPot}
                    positionLabels={seatLabels}
                  />
                </div>
              )}
            </div>

            <Notification variant={notificationVariant} message={notificationMessage} />

            <div className="pointer-events-auto bg-black/70 text-white text-xs rounded-lg p-3 shadow-lg">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Seat Manager</span>
                <button
                  type="button"
                  onClick={onOpenSeatManager}
                  className="text-[11px] font-semibold text-yellow-300 hover:text-yellow-200 transition"
                >
                  Open
                </button>
              </div>
            </div>

            <Modal title="Seat Manager" open={seatManagerOpen} onClose={onCloseSeatManager}>
              <label className="flex items-center space-x-1 text-[11px] font-normal">
                <input
                  type="checkbox"
                  className="accent-yellow-400"
                  checked={autoRotateSeats}
                  onChange={(event) => onToggleAutoRotateSeats(event.target.checked)}
                />
                <span>Auto rotate</span>
              </label>
              <p className="text-[11px] text-gray-300 leading-snug">
                Seat / stack changes apply to the next hand. Use the reset button to redeal immediately when testing layouts.
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-1">
                {seatConfig.map((type, idx) => (
                  <label key={`seat-config-${idx}`} className="flex flex-col space-y-1">
                    <span className="text-[11px] font-semibold">
                      Seat {idx + 1}
                      {idx === 0 ? " (You)" : ""}
                    </span>
                    <select
                      value={type}
                      disabled={idx === 0}
                      onChange={(event) => onSeatTypeChange(idx, event.target.value)}
                      className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400 disabled:opacity-50"
                    >
                      {seatTypeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <label className="flex flex-col space-y-1">
                <span className="text-[11px] font-semibold">Starting stack</span>
                <input
                  type="number"
                  min="0"
                  step="25"
                  value={startingStack}
                  onChange={(event) => onStartingStackChange(event.target.value)}
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onRotateSeatConfig}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-semibold"
                >
                  Rotate once
                </button>
                <button
                  type="button"
                  onClick={onResetSeatConfig}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-semibold"
                >
                  Default seats
                </button>
                <button
                  type="button"
                  onClick={onRedeal}
                  className="px-3 py-1 bg-yellow-500 hover:bg-yellow-400 text-black rounded text-xs font-semibold"
                >
                  Reset & Redeal
                </button>
              </div>
            </Modal>

            <div className="pointer-events-auto bg-black/70 text-white text-xs rounded-lg p-3 shadow-lg space-y-3">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Hero Tracker</span>
                <span className="text-[11px] text-slate-400">
                  {heroTracker.lastOutcome ?? "-"}
                  {heroTracker.streak ? ` - ${heroTracker.streak > 0 ? "+" : ""}${heroTracker.streak}` : ""}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400">
                <div className="text-center">
                  <p className="text-[9px] uppercase tracking-[0.35em] text-slate-500">Wins</p>
                  <strong className="text-emerald-400 text-base">{heroTracker.wins}</strong>
                </div>
                <div className="text-center">
                  <p className="text-[9px] uppercase tracking-[0.35em] text-slate-500">Draws</p>
                  <strong className="text-yellow-300 text-base">{heroTracker.draws}</strong>
                </div>
                <div className="text-center">
                  <p className="text-[9px] uppercase tracking-[0.35em] text-slate-500">Losses</p>
                  <strong className="text-red-400 text-base">{heroTracker.losses}</strong>
                </div>
              </div>
              <div className="text-[11px] text-slate-400">Win rate: {heroTrackerTotal ? `${heroWinRate}%` : "-"}</div>
              {heroTracker.history.length ? (
                <div className="space-y-1">
                  {heroTracker.history.map((entry) => (
                    <div key={entry.id ?? entry.ts} className="flex items-center justify-between text-[11px] text-slate-200">
                      <span>{entry.outcome}</span>
                      <span>Pot {entry.pot}</span>
                      <span className="text-[10px] text-emerald-300">
                        {entry.ratingDelta >= 0 ? `+${entry.ratingDelta}` : entry.ratingDelta}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">No hero history yet</p>
              )}
            </div>

            <div className="pointer-events-auto bg-black/70 text-white text-xs rounded-lg p-3 shadow-lg space-y-3">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Developer Panel</span>
                <span className="text-[11px] text-slate-400">AI / P2P</span>
              </div>
              <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.35em] text-slate-400">
                Tier Override
                <select
                  value={devTierOverride ?? ""}
                  onChange={onTierOverrideChange}
                  className="rounded-full bg-slate-900/70 border border-white/20 px-2 py-1 text-[12px]"
                >
                  <option value="">Auto (game decides)</option>
                  {tierOptions.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={onClearTierOverride}
                  className="flex-1 rounded-full border border-red-400/60 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/10 transition"
                >
                  Clear Override
                </button>
                <button
                  type="button"
                  onClick={onToggleP2pCapture}
                  className={`flex-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                    p2pCaptureEnabled ? "bg-emerald-500 text-slate-900" : "border border-white/20 text-white"
                  }`}
                >
                  P2P Capture {p2pCaptureEnabled ? "Enabled" : "Disabled"}
                </button>
              </div>
              <button
                type="button"
                onClick={onExportP2pMatches}
                className="w-full rounded-full border border-white/30 px-3 py-1 text-[11px] font-semibold hover:bg-white/10 transition"
              >
                Export P2P JSONL
              </button>
            </div>
          </div>
        )}

        <div className="flex h-full w-full">
          <div className="flex-1 flex flex-col items-center">
            {tournamentHud}

            <div className="flex-1 flex w-full items-center justify-center overflow-auto pb-6">
              <div
                className={`relative ${
                  isMobileLayout
                    ? "w-full max-w-full aspect-[16/9]"
                    : "w-[92%] max-w-[1400px] aspect-[16/9]"
                } ${tableSurfaceBg} border-4 ${tableBorderColor} rounded-3xl shadow-inner transition-colors duration-300 ${
                  heroTableAnimating ? "table-switch-anim" : ""
                } mx-auto`}
              >
                {isTournament ? (
                  <div className="absolute top-4 left-4 z-20 px-4 py-2 bg-black/40 rounded-xl text-xs shadow-lg backdrop-blur">
                    <TableSummaryPanel {...tableSummaryProps} className="text-left space-y-1" />
                  </div>
                ) : (
                  <>
                    {isMobileLayout ? (
                      <TableSummaryPanel
                        {...tableSummaryProps}
                        className="absolute top-2 right-2 left-2 mx-auto text-center bg-black/70 rounded-lg px-3 py-2 shadow-lg text-[11px]"
                      />
                    ) : (
                      <>
                        <TableSummaryPanel
                          {...tableSummaryProps}
                          className="lg:hidden absolute top-4 right-4 text-right bg-black/70 rounded-lg px-3 py-2 shadow-lg"
                        />
                        <TableSummaryPanel
                          {...tableSummaryProps}
                          className="hidden lg:block fixed top-28 right-8 text-right bg-black/70 rounded-lg px-4 py-3 shadow-lg z-40 w-64"
                        />
                      </>
                    )}
                  </>
                )}

                <div
                  className={`players-grid ${
                    isMobileLayout
                      ? "grid grid-cols-2 gap-3 px-4 pt-6"
                      : "grid grid-cols-1 gap-4 px-6 sm:grid-cols-2 lg:block lg:px-0"
                  }`}
                >
                  {tableSeatViews.map((seat) => {
                    const seatIndex = typeof seat?.seatIndex === "number" ? seat.seatIndex : 0;
                    const basePlayer = players[seatIndex] ? clonePlayerStateFn(players[seatIndex]) : {};
                    const seatLabel = seat?.label ?? positionNameFn(seatIndex);
                    const seatTestId = seatLabel === "SB" ? "seat-sb" : undefined;
                    const composedPlayer = {
                      ...basePlayer,
                      ...seat,
                      name: `${seat?.name ?? basePlayer.name ?? `Seat ${seatIndex + 1}`} (${seatLabel})`,
                    };
                    const selectedForSeat =
                      seatIndex === heroSeatIndex
                        ? heroDrawSelection
                        : Array.isArray(composedPlayer.selected)
                        ? composedPlayer.selected
                        : Array.isArray(basePlayer.selected)
                        ? basePlayer.selected
                        : [];
                    const normalizedPlayer = {
                      ...composedPlayer,
                      selected: selectedForSeat,
                    };
                    return (
                      <div
                        key={`seat-${seatIndex}`}
                        className={`mb-4 lg:mb-0 ${seatLayouts[seatIndex] ?? ""}`}
                        data-testid={seatTestId}
                      >
                        <Player
                          player={normalizedPlayer}
                          index={seatIndex}
                          selfIndex={0}
                          phase={tablePhase}
                          turn={controllerTurn}
                          dealerIdx={controllerDealerIdx}
                          onCardClick={handleCardClick}
                          positionLabel={seatLabel}
                          canSelectForDraw={tableHeroCanDraw && seatIndex === heroSeatIndex}
                        />
                      </div>
                    );
                  })}
                </div>

                {phase === "TOURNAMENT_END" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 z-50">
                    <h2 className="text-4xl font-bold text-yellow-400 mb-4">TOURNAMENT FINISHED</h2>
                    <p className="text-lg mb-6 text-white">Congratulations to the Champion!</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="px-6 py-3 bg-yellow-500 text-black font-bold rounded shadow-lg hover:bg-yellow-400"
                    >
                      Return to Home
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <HandResultOverlay visible={handResultVisible} summary={handResultSummary} onNext={onNextHand} buttonLabel={nextHandLabel} />

      {mode === "tournament-mtt" && (
        <HeroBustOverlay
          visible={heroBustOverlayVisible}
          title={heroBustSummary?.title ?? tournamentTitle}
          heroSummary={heroBustSummary?.hero}
          inMoneyPlacements={heroBustSummary?.inMoney ?? []}
          onBackToMenu={onTournamentBackToMenu}
        />
      )}

      {mode === "tournament-mtt" && (
        <TournamentResultOverlay
          visible={tournamentOverlayVisible}
          title={tournamentTitle}
          placements={tournamentPlacements}
          onBackToMenu={onTournamentBackToMenu}
          onPlayAgain={onTournamentPlayAgain}
        />
      )}

      {isMobileLayout ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,12px)+18px)] bg-gradient-to-t from-black via-black/80 to-transparent space-y-3">
          {renderControlsContent()}
          {nextHandButton}
        </div>
      ) : (
        <div className="w-full flex justify-center mt-6">
          <div className="w-[92%] max-w-[1400px] flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <button
                onClick={onToggleDebugMode}
                className={`px-4 py-2 rounded font-bold ${debugMode ? "bg-red-500" : "bg-gray-600"}`}
              >
                {debugMode ? "DEBUG ON" : "DEBUG OFF"}
              </button>
            </div>

            <div className="flex justify-end items-center gap-4 h-20">
              {heroCanAct && heroPlayerForControls ? (
                <div className="absolute bottom-6 right-6 z-40">
                  {renderControlsContent()}
                </div>
              ) : null}

              {nextHandButton}
            </div>
          </div>
        </div>
      )}

      {debugMode && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 text-[11px] text-slate-100">
          {/* NOTE (G-10): Emergency reset is debug-only to recover from inconsistent tables. */}
          <button
            type="button"
            onClick={onEmergencyReset}
            className="rounded-full bg-red-500/80 px-4 py-2 font-semibold uppercase tracking-[0.3em] hover:bg-red-500 transition"
          >
            Reset Table
          </button>
          <button
            type="button"
            onClick={onToggleDebugMode}
            className="rounded-full border border-white/40 px-4 py-1 font-semibold uppercase tracking-[0.3em] hover:bg-white/10 transition"
          >
            Hide Debug UI
          </button>
        </div>
      )}
    </div>
  );
}
