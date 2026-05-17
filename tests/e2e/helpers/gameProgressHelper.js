import { expect } from "@playwright/test";

const BET_PHASES = new Set(["BET", "PREFLOP", "FLOP", "TURN", "RIVER"]);
const DRAW_PHASES = new Set(["DRAW"]);

function collectBrowserSignals() {
  const isVisible = (element) => {
    if (!element) return false;
    const box = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  };
  const isInteractable = (element) => {
    if (!isVisible(element) || element.disabled || element.getAttribute("aria-disabled") === "true") return false;
    const box = element.getBoundingClientRect();
    if (box.bottom <= 0 || box.right <= 0 || box.left >= window.innerWidth || box.top >= window.innerHeight) return false;
    const x = Math.min(Math.max(box.left + box.width / 2, 0), window.innerWidth - 1);
    const y = Math.min(Math.max(box.top + box.height / 2, 0), window.innerHeight - 1);
    const topElement = document.elementFromPoint(x, y);
    return Boolean(topElement && (element === topElement || element.contains(topElement)));
  };
  const actionIds = [
    "action-check",
    "action-call",
    "action-raise",
    "action-fold",
    "action-draw-selected",
  ];
  const actions = actionIds.filter((id) => isInteractable(document.querySelector(`[data-testid="${id}"]`)));
  const displayedPhase = document.querySelector('[data-testid="table-phase-badge"]')?.textContent?.trim() ?? "";
  const resultVisible =
    isVisible(document.querySelector('[data-testid="hand-result-pot"]')) ||
    isVisible(document.querySelector('[data-testid="hand-result-follow-up"]')) ||
    /\bHAND_RESULT\b|Hand Result/i.test(displayedPhase);
  const nextHandButton = [...document.querySelectorAll("button")].find((button) => /next hand/i.test(button.textContent ?? ""));
  return {
    actions,
    displayedPhase,
    resultVisible,
    nextHandVisible: isVisible(nextHandButton),
    nextHandInteractable: isInteractable(nextHandButton),
  };
}

export async function waitForE2EDriver(page) {
  await page.waitForFunction(
    () => {
      const api = window.__BADUGI_E2E__;
      return Boolean(
        api &&
          typeof api.getStateSnapshot === "function" &&
          typeof api.getPhaseState === "function" &&
          typeof api.forceControllerAction === "function",
      );
    },
    undefined,
    { timeout: 60000 },
  );
}

export async function invokeE2E(page, method, ...args) {
  return page.evaluate(
    async ({ methodName, params }) => {
      const api = window.__BADUGI_E2E__;
      if (!api || typeof api[methodName] !== "function") {
        throw new Error(`E2E helper ${methodName} is not available`);
      }
      return await api[methodName](...params);
    },
    { methodName: method, params: args },
  );
}

export async function getProgressState(page) {
  return page.evaluate((browserSignalSource) => {
    const collectBrowserSignals = new Function(`return (${browserSignalSource})`)();
    const api = window.__BADUGI_E2E__;
    const state = api?.getStateSnapshot?.() ?? null;
    const phaseState = api?.getPhaseState?.() ?? null;
    const snapshot = state?.controllerSnapshot ?? null;
    const ui = collectBrowserSignals();
    const variantId = state?.gameVariant ?? snapshot?.variantId ?? null;
    const rawPhase =
      phaseState?.phase ??
      snapshot?.phase ??
      snapshot?.street ??
      state?.phase ??
      null;
    const uiTerminal =
      ui.resultVisible ||
      ui.nextHandVisible ||
      ["HAND_RESULT", "SHOWDOWN", "WAITING_NEXT_HAND", "COMPLETE", "TERMINAL"].some((marker) =>
        String(ui.displayedPhase ?? "").toUpperCase().includes(marker),
      );
    const phase = uiTerminal ? "HAND_RESULT" : rawPhase;
    const actor =
      uiTerminal
        ? null
        : typeof phaseState?.turn === "number"
        ? phaseState.turn
        : typeof snapshot?.currentActor === "number"
          ? snapshot.currentActor
          : typeof snapshot?.turn === "number"
            ? snapshot.turn
            : typeof state?.turn === "number"
              ? state.turn
              : null;
    const players = snapshot?.players ?? phaseState?.players ?? state?.players ?? [];
    const pot = Number(snapshot?.pot ?? state?.potTotal ?? 0);
    const handId = phaseState?.handId ?? state?.handId ?? null;
    const maxExplicitStreetBet = Math.max(
      0,
      ...(players ?? []).map((player) => Number(player?.betThisStreet ?? player?.committedThisStreet ?? 0) || 0),
    );
    const maxFallbackBet = Math.max(
      0,
      ...(players ?? []).map((player) => Number(player?.betThisRound ?? player?.bet ?? 0) || 0),
    );
    const useFallbackBet = String(variantId ?? "").toLowerCase() !== "badugi";
    const maxPlayerStreetBet = maxExplicitStreetBet > 0 ? maxExplicitStreetBet : useFallbackBet ? maxFallbackBet : 0;
    const currentBet = Math.max(Number(snapshot?.currentBet ?? phaseState?.currentBet ?? state?.currentBet ?? 0) || 0, maxPlayerStreetBet);
    return {
      state,
      phaseState,
      snapshot,
      phase,
      actor,
      players,
      currentBet,
      pot,
      handId,
      ui,
      drawRoundIndex:
        snapshot?.drawRoundIndex ??
        snapshot?.drawRound ??
        phaseState?.drawRound ??
        state?.drawRound ??
        null,
      isTerminal: Boolean(
        uiTerminal ||
        ["SHOWDOWN", "HAND_RESULT", "WAITING_NEXT_HAND", "COMPLETE", "TERMINAL"].includes(String(phase)) ||
          snapshot?.lastHandResult ||
          state?.lastHandResult,
      ),
    };
  }, collectBrowserSignals.toString());
}

export async function getCurrentActor(page) {
  return (await getProgressState(page)).actor;
}

export async function getCurrentPhase(page) {
  return (await getProgressState(page)).phase;
}

export async function getLegalActions(page) {
  return page.evaluate((browserSignalSource) => {
    const collectBrowserSignals = new Function(`return (${browserSignalSource})`)();
    return collectBrowserSignals().actions;
  }, collectBrowserSignals.toString());
}

export async function getProgressDecisionSnapshot(page) {
  const progress = await getProgressState(page);
  return {
    handId: progress?.handId ?? null,
    phase: progress?.phase ?? null,
    actor: progress?.actor ?? null,
    currentBet: progress?.currentBet ?? null,
    pot: progress?.pot ?? null,
    drawRoundIndex: progress?.drawRoundIndex ?? null,
    isTerminal: Boolean(progress?.isTerminal),
    ui: progress?.ui ?? null,
    summary: summarizeProgressState(progress),
  };
}

export function summarizeProgressState(progress) {
  const players = (progress?.players ?? []).map((player, seat) => ({
    seat,
    name: player?.name ?? player?.playerId ?? player?.id ?? null,
    stack: Number(player?.stack ?? 0),
    bet: Number(player?.betThisStreet ?? player?.betThisRound ?? player?.bet ?? 0),
    folded: Boolean(player?.folded || player?.hasFolded),
    allIn: Boolean(player?.allIn),
    seatOut: Boolean(player?.seatOut || player?.isBusted),
    lastAction: player?.lastAction ?? null,
  }));
  return {
    handId: progress?.handId ?? null,
    phase: progress?.phase ?? null,
    actor: progress?.actor ?? null,
    currentBet: progress?.currentBet ?? null,
    pot: progress?.pot ?? null,
    drawRoundIndex: progress?.drawRoundIndex ?? null,
    players,
  };
}

export function progressKey(progress) {
  const summary = summarizeProgressState(progress);
  return JSON.stringify(summary);
}

export function assertProgressState(progress, context = {}) {
  expect(progress?.phase, `phase should exist: ${JSON.stringify(context)}`).toBeTruthy();
  expect(Number.isFinite(Number(progress?.pot ?? 0)), `pot finite: ${JSON.stringify(context)}`).toBe(true);
  expect(Number(progress?.pot ?? 0), `pot non-negative: ${JSON.stringify(context)}`).toBeGreaterThanOrEqual(0);

  for (const player of progress?.players ?? []) {
    expect(Number.isFinite(Number(player?.stack ?? 0)), `stack finite: ${JSON.stringify(context)}`).toBe(true);
    expect(Number(player?.stack ?? 0), `stack non-negative: ${JSON.stringify(context)}`).toBeGreaterThanOrEqual(0);
  }

  if (progress?.isTerminal) return;
  if (typeof progress?.actor !== "number") return;

  const actor = progress.players?.[progress.actor];
  expect(actor, `actor exists: ${JSON.stringify({ ...context, progress: summarizeProgressState(progress) })}`).toBeTruthy();
  expect(Boolean(actor?.folded || actor?.hasFolded), `folded actor: ${JSON.stringify({ ...context, progress: summarizeProgressState(progress) })}`).toBe(false);
  expect(Boolean(actor?.seatOut || actor?.isBusted), `seat-out actor: ${JSON.stringify({ ...context, progress: summarizeProgressState(progress) })}`).toBe(false);
  if (String(progress.phase) === "BET") {
    expect(Boolean(actor?.allIn), `all-in actor in BET: ${JSON.stringify({ ...context, progress: summarizeProgressState(progress) })}`).toBe(false);
  }
}

function hasInvalidActor(progress) {
  if (progress?.isTerminal || typeof progress?.actor !== "number") return false;
  const actor = progress.players?.[progress.actor];
  if (!actor) return true;
  if (actor?.folded || actor?.hasFolded || actor?.seatOut || actor?.isBusted) return true;
  if (String(progress.phase) === "BET" && actor?.allIn) return true;
  return false;
}

async function firstClickableAction(page, ids) {
  for (const id of ids) {
    const locator = page.getByTestId(id).first();
    if (!(await locator.count())) continue;
    if (!(await locator.isVisible().catch(() => false))) continue;
    if (!(await locator.isEnabled().catch(() => false))) continue;
    return { id, locator };
  }
  return null;
}

function controllerActionFor(progress, { policy = "safe" } = {}) {
  const phase = String(progress?.phase ?? progress?.snapshot?.street ?? "");
  const actor = progress?.actor;
  const player = typeof actor === "number" ? progress?.players?.[actor] : null;
  if (DRAW_PHASES.has(phase) || progress?.snapshot?.street === "DRAW") {
    return { type: "draw", discardIndexes: [] };
  }
  if (policy === "foldNonHero" && actor !== 0 && BET_PHASES.has(phase)) {
    return { type: "fold" };
  }
  const actorBet = Number(player?.betThisStreet ?? player?.betThisRound ?? player?.bet ?? 0);
  const currentBet = Number(progress?.currentBet ?? progress?.snapshot?.currentBet ?? 0) || 0;
  const toCall = Math.max(0, currentBet - actorBet);
  return toCall > 0 ? { type: "call", amount: toCall } : { type: "check", amount: 0 };
}

export async function performSafeAction(page, options = {}) {
  const progress = await getProgressState(page);
  const beforeKey = progressKey(progress);
  const phase = String(progress?.phase ?? "");
  const actor = progress?.actor;
  if (progress?.isTerminal) {
    return { acted: false, reason: "terminal", before: summarizeProgressState(progress) };
  }
  if (typeof actor !== "number") {
    return { acted: false, reason: "no-actor", before: summarizeProgressState(progress) };
  }

  if (actor === 0) {
    const order =
      DRAW_PHASES.has(phase) || progress?.snapshot?.street === "DRAW"
        ? ["action-draw-selected"]
        : options.policy === "heroAggressive"
          ? ["action-raise", "action-call", "action-check", "action-fold"]
          : ["action-check", "action-call", "action-raise", "action-fold"];
    const action = await firstClickableAction(page, order);
    if (action) {
      await action.locator.click();
      return { acted: true, clickedAction: action.id, actor, before: summarizeProgressState(progress) };
    }
  }

  if (options.autoCpu && actor !== 0) {
    await waitForProgressChange(page, beforeKey, { timeout: options.autoCpuTimeout ?? 20000 });
    return {
      acted: true,
      clickedAction: "auto-cpu",
      actor,
      before: summarizeProgressState(progress),
    };
  }

  const payload = controllerActionFor(progress, options);
  let snapshot = await invokeE2E(page, "forceControllerAction", actor, payload);
  if (!snapshot) {
    snapshot = await invokeE2E(page, "forceSeatAction", actor, payload);
  }
  let changed = false;
  if (!snapshot) {
    await waitForProgressChange(page, beforeKey, { timeout: 3000 })
      .then(() => {
        changed = true;
      })
      .catch(() => {});
  }
  return {
    acted: Boolean(snapshot) || changed,
    clickedAction: `controller:${payload.type}`,
    actor,
    before: summarizeProgressState(progress),
  };
}

export async function waitForProgressChange(page, previousKey, { timeout = 8000 } = {}) {
  await page.waitForFunction(
    ({ key, browserSignalSource }) => {
      const collectBrowserSignals = new Function(`return (${browserSignalSource})`)();
      const api = window.__BADUGI_E2E__;
      const state = api?.getStateSnapshot?.() ?? null;
      const phaseState = api?.getPhaseState?.() ?? null;
      const snapshot = state?.controllerSnapshot ?? null;
      const ui = collectBrowserSignals();
      const variantId = state?.gameVariant ?? snapshot?.variantId ?? null;
      const rawPhase = phaseState?.phase ?? snapshot?.phase ?? snapshot?.street ?? state?.phase ?? null;
      const uiTerminal =
        ui.resultVisible ||
        ui.nextHandVisible ||
        ["HAND_RESULT", "SHOWDOWN", "WAITING_NEXT_HAND", "COMPLETE", "TERMINAL"].some((marker) =>
          String(ui.displayedPhase ?? "").toUpperCase().includes(marker),
        );
      const phase = uiTerminal ? "HAND_RESULT" : rawPhase;
      const actor =
        uiTerminal
          ? null
          : typeof phaseState?.turn === "number"
          ? phaseState.turn
          : typeof snapshot?.currentActor === "number"
            ? snapshot.currentActor
            : typeof snapshot?.turn === "number"
              ? snapshot.turn
              : typeof state?.turn === "number"
                ? state.turn
                : null;
      const players = snapshot?.players ?? phaseState?.players ?? state?.players ?? [];
      const pot = Number(snapshot?.pot ?? state?.potTotal ?? 0);
      const handId = phaseState?.handId ?? state?.handId ?? null;
      const maxExplicitStreetBet = Math.max(
        0,
        ...(players ?? []).map((player) => Number(player?.betThisStreet ?? player?.committedThisStreet ?? 0) || 0),
      );
      const maxFallbackBet = Math.max(
        0,
        ...(players ?? []).map((player) => Number(player?.betThisRound ?? player?.bet ?? 0) || 0),
      );
      const useFallbackBet = String(variantId ?? "").toLowerCase() !== "badugi";
      const maxPlayerStreetBet = maxExplicitStreetBet > 0 ? maxExplicitStreetBet : useFallbackBet ? maxFallbackBet : 0;
      const currentBet = Math.max(Number(snapshot?.currentBet ?? phaseState?.currentBet ?? state?.currentBet ?? 0) || 0, maxPlayerStreetBet);
      const drawRoundIndex = snapshot?.drawRoundIndex ?? snapshot?.drawRound ?? phaseState?.drawRound ?? state?.drawRound ?? null;
      const playerSummary = players.map((player, seat) => ({
        seat,
        stack: Number(player?.stack ?? 0),
        bet: Number(player?.betThisStreet ?? player?.betThisRound ?? player?.bet ?? 0),
        folded: Boolean(player?.folded || player?.hasFolded),
        allIn: Boolean(player?.allIn),
        seatOut: Boolean(player?.seatOut || player?.isBusted),
        lastAction: player?.lastAction ?? null,
        hasDrawn: Boolean(player?.hasDrawn),
      }));
      const nextKey = JSON.stringify({ handId, phase, actor, currentBet, pot, drawRoundIndex, players: playerSummary });
      return nextKey !== key || uiTerminal || phase === "HAND_RESULT" || phase === "SHOWDOWN" || snapshot?.lastHandResult;
    },
    { key: previousKey, browserSignalSource: collectBrowserSignals.toString() },
    { timeout },
  );
}

export async function waitForTurnChange(page, prevActor) {
  await page.waitForFunction(
    (actor) => {
      const api = window.__BADUGI_E2E__;
      const state = api?.getStateSnapshot?.() ?? null;
      const phaseState = api?.getPhaseState?.() ?? null;
      const snapshot = state?.controllerSnapshot ?? null;
      const current =
        typeof phaseState?.turn === "number"
          ? phaseState.turn
          : typeof snapshot?.currentActor === "number"
            ? snapshot.currentActor
            : typeof snapshot?.turn === "number"
              ? snapshot.turn
              : state?.turn;
      return current !== actor || phaseState?.phase === "HAND_RESULT" || snapshot?.lastHandResult;
    },
    prevActor,
    { timeout: 10000 },
  );
}

export async function waitForPhaseChange(page, prevPhase) {
  await page.waitForFunction(
    (phase) => {
      const api = window.__BADUGI_E2E__;
      const state = api?.getStateSnapshot?.() ?? null;
      const phaseState = api?.getPhaseState?.() ?? null;
      const snapshot = state?.controllerSnapshot ?? null;
      const current = phaseState?.phase ?? snapshot?.phase ?? snapshot?.street ?? state?.phase;
      return current !== phase || current === "HAND_RESULT" || current === "SHOWDOWN" || snapshot?.lastHandResult;
    },
    prevPhase,
    { timeout: 15000 },
  );
}

export async function waitForHandEnd(page) {
  await page.waitForFunction(
    () => {
      const api = window.__BADUGI_E2E__;
      const state = api?.getStateSnapshot?.() ?? null;
      const phaseState = api?.getPhaseState?.() ?? null;
      const snapshot = state?.controllerSnapshot ?? null;
      const phase = phaseState?.phase ?? snapshot?.phase ?? snapshot?.street ?? state?.phase;
      return phase === "HAND_RESULT" || phase === "SHOWDOWN" || Boolean(snapshot?.lastHandResult);
    },
    undefined,
    { timeout: 30000 },
  );
}

export async function playOneHandProgression(page, options = {}) {
  const {
    maxSteps = 80,
    policy = "safe",
    requireHeroButtonClick = false,
    requireDrawVisit = false,
  } = options;
  const trace = [];
  const visitedPhases = new Set();
  const visitedDrawRounds = new Set();
  let sameStateCount = 0;
  let lastKey = null;
  let heroButtonClicks = 0;

  for (let step = 0; step < maxSteps; step += 1) {
    let progress = await getProgressState(page);
    let key = progressKey(progress);
    if (options.settleInvalidActor !== false && hasInvalidActor(progress)) {
      await waitForProgressChange(page, key, { timeout: 2500 }).catch(() => {});
      progress = await getProgressState(page);
      key = progressKey(progress);
    }
    if (key === lastKey) {
      sameStateCount += 1;
    } else {
      sameStateCount = 0;
      lastKey = key;
    }
    trace.push({ step, ...summarizeProgressState(progress), legalActions: await getLegalActions(page) });
    assertProgressState(progress, { step, trace: trace.slice(-3) });
    if (typeof options.onStep === "function") {
      await options.onStep({ step, progress, trace });
    }
    visitedPhases.add(String(progress.phase));
    if (String(progress.phase) === "DRAW" || progress?.snapshot?.street === "DRAW") {
      visitedDrawRounds.add(Number(progress.drawRoundIndex ?? progress.snapshot?.drawRoundIndex ?? 0));
    }
    if (sameStateCount > 5) {
      throw new Error(`Freeze detected: ${JSON.stringify({ trace: trace.slice(-6) })}`);
    }
    if (progress.isTerminal) {
      if (requireHeroButtonClick) {
        expect(heroButtonClicks, "hero should exercise real UI buttons").toBeGreaterThan(0);
      }
      if (requireDrawVisit) {
        expect([...visitedPhases], "hand should visit DRAW").toContain("DRAW");
      }
      return {
        status: "PASS",
        steps: step,
        trace,
        visitedPhases: [...visitedPhases],
        visitedDrawRounds: [...visitedDrawRounds],
        heroButtonClicks,
      };
    }

    const effectivePolicy = policy === "heroThenFold" && heroButtonClicks > 0 ? "foldNonHero" : policy;
    const action = await performSafeAction(page, {
      policy: effectivePolicy,
      autoCpu: options.autoCpu,
      autoCpuTimeout: options.autoCpuTimeout,
    });
    if (!action.acted) {
      throw new Error(`No safe action available: ${JSON.stringify({ step, action, trace: trace.slice(-4) })}`);
    }
    if (action.actor === 0 && !String(action.clickedAction).startsWith("controller:")) {
      heroButtonClicks += 1;
    }
    await waitForProgressChange(page, key);
  }

  const finalProgress = await getProgressState(page);
  if (!finalProgress.isTerminal) {
    throw new Error(`Hand did not end: ${JSON.stringify({ trace: trace.slice(-8), final: summarizeProgressState(finalProgress) })}`);
  }
  expect(heroButtonClicks, "hero should exercise real UI buttons").toBeGreaterThan(requireHeroButtonClick ? 0 : -1);
  if (requireDrawVisit) {
    expect([...visitedPhases]).toContain("DRAW");
  }
  return {
    status: "PASS",
    steps: maxSteps,
    trace,
    visitedPhases: [...visitedPhases],
    visitedDrawRounds: [...visitedDrawRounds],
    heroButtonClicks,
  };
}

export async function expectMobileActionsInViewport(page) {
  const viewport = page.viewportSize();
  const action = page
    .locator("[data-testid='action-check'],[data-testid='action-call'],[data-testid='action-raise'],[data-testid='action-fold'],[data-testid='action-draw-selected']")
    .first();
  await expect(action).toBeVisible({ timeout: 30000 });
  const box = await action.boundingBox();
  expect(box, "action button should have a bounding box").toBeTruthy();
  expect(box.height).toBeGreaterThanOrEqual(44);
  if (viewport) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  }
}
