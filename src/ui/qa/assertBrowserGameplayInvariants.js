import { expectedBrowserActor } from "./expectedBrowserActor.js";

function issue(type, severity, message, details = {}) {
  return { type, severity, message, ...details };
}

function normalizePhase(value) {
  return value == null ? null : String(value).toUpperCase();
}

export function assertBrowserGameplayInvariants(row, previousRows = []) {
  const violations = [];
  const controller = row?.controller ?? {};
  const ui = row?.ui ?? {};
  const phase = normalizePhase(row?.phase);
  const terminal = ["HAND_RESULT", "SHOWDOWN", "WAITING_NEXT_HAND", "COMPLETE", "TERMINAL"].includes(phase);
  const expected = expectedBrowserActor({
    phase,
    drawRound: row?.drawRound,
    buttonSeat: row?.buttonSeat,
    bbSeat: row?.bbSeat,
    players: controller.players ?? [],
    currentBet: controller.currentBet ?? 0,
    actorSeat: controller.actorSeat,
  });
  const actorPlayer = typeof controller.actorSeat === "number" ? (controller.players ?? [])[controller.actorSeat] : null;
  const livePlayers = (controller.players ?? []).filter(
    (player) =>
      player &&
      !(player.folded || player.hasFolded) &&
      !player.seatOut &&
      !player.isBusted,
  );
  const isFoldToOneTerminalConvergence =
    phase === "BET" &&
    expected.shouldRoundClose &&
    livePlayers.length <= 1 &&
    !ui.heroControlsVisible &&
    (
      String(actorPlayer?.lastAction ?? "").toLowerCase().includes("collect") ||
      typeof controller.actorSeat !== "number"
    );
  if (
    phase === "BET" &&
    actorPlayer &&
    (actorPlayer.folded ||
      actorPlayer.hasFolded ||
      actorPlayer.seatOut ||
      actorPlayer.isBusted ||
      actorPlayer.allIn)
  ) {
    violations.push(
      issue("ACTOR", "P0", "controller selected ineligible betting actor", {
        actorSeat: controller.actorSeat,
        folded: Boolean(actorPlayer.folded || actorPlayer.hasFolded),
        allIn: Boolean(actorPlayer.allIn),
        seatOut: Boolean(actorPlayer.seatOut || actorPlayer.isBusted),
      }),
    );
  }

  if (phase === "BET" && expected.shouldRoundClose) {
    if (typeof controller.actorSeat === "number") {
      if (isFoldToOneTerminalConvergence) {
        violations.push(
          issue("TERMINAL", "P1", "fold-to-one terminal transition still exposes transient controller actor", {
            expectedActorSeat: null,
            actualActorSeat: controller.actorSeat,
            playersNeedingAction: expected.playersNeedingAction,
            livePlayerCount: livePlayers.length,
            actorLastAction: actorPlayer?.lastAction ?? null,
          }),
        );
      } else {
        violations.push(
          issue("BETTING_CLOSURE", "P0", "betting round should close but controller still has actor", {
            expectedActorSeat: null,
            actualActorSeat: controller.actorSeat,
            playersNeedingAction: expected.playersNeedingAction,
          }),
        );
      }
    }
    if (ui.heroControlsVisible) {
      violations.push(issue("ACTION_REOPEN", "P0", "hero controls visible after betting round should close"));
    }
  } else if (phase === "BET" && typeof expected.expectedActorSeat === "number") {
    if (controller.actorSeat !== expected.expectedActorSeat) {
      violations.push(
        issue("ACTOR", "P0", "controller actor differs from browser expected actor", {
          expectedActorSeat: expected.expectedActorSeat,
          actualActorSeat: controller.actorSeat,
          playersNeedingAction: expected.playersNeedingAction,
        }),
      );
    }
  }

  if (ui.heroControlsVisible && controller.actorSeat !== ui.heroSeat && !terminal) {
    violations.push(
      issue("UI_CONTROLLER_DIVERGENCE", "P0", "hero controls visible while hero is not controller actor", {
        heroSeat: ui.heroSeat,
        actorSeat: controller.actorSeat,
      }),
    );
  }

  if (typeof ui.displayedPot === "number" && Number(controller.pot ?? 0) !== ui.displayedPot) {
    violations.push(
      issue("POT", "P1", "displayed pot differs from controller pot", {
        controllerPot: controller.pot,
        displayedPot: ui.displayedPot,
      }),
    );
  }
  if (!terminal && Number(controller.pot ?? 0) === 0 && (controller.players ?? []).some((p) => Number(p?.betThisRound ?? p?.bet ?? 0) > 0)) {
    violations.push(issue("POT", "P0", "active hand has invested chips but controller pot is zero"));
  }

  const displayedPhase = normalizePhase(ui.displayedPhase);
  if (displayedPhase && phase && !String(displayedPhase).includes(phase) && !String(phase).includes(displayedPhase)) {
    violations.push(issue("PHASE", "P1", "displayed phase diverges from controller phase", { displayedPhase, phase }));
  }

  if (terminal) {
    if (typeof controller.actorSeat === "number") {
      violations.push(issue("TERMINAL", "P0", "terminal state still has controller actor", { actorSeat: controller.actorSeat }));
    }
    if (ui.heroControlsVisible) {
      violations.push(issue("TERMINAL", "P0", "terminal state still shows hero controls"));
    }
    if (!ui.resultVisible) {
      violations.push(issue("TERMINAL", "P1", "terminal state does not show result overlay"));
    }
  }

  const previousSameStreetHeroAction = [...previousRows].reverse().find(
    (prev) =>
      prev?.handId === row?.handId &&
      normalizePhase(prev?.phase) === "BET" &&
      prev?.drawRound === row?.drawRound &&
      prev?.betRound === row?.betRound &&
      prev?.action?.actorSeat === ui.heroSeat,
  );
  if (
    previousSameStreetHeroAction &&
    ui.heroControlsVisible &&
    controller.actorSeat === ui.heroSeat &&
    !expected.playersNeedingAction.includes(ui.heroSeat)
  ) {
    violations.push(issue("ACTION_REOPEN", "P0", "hero re-action detected without pending action requirement"));
  }

  return {
    status: violations.some((v) => v.severity === "P0") ? "FAIL" : violations.length ? "WARN" : "PASS",
    expected,
    violations,
  };
}
