// Read-only F03 inputs from the active controller. This is deliberately not an
// ONNX payload: missing hand-equity and Stud features must not be guessed.
const BOARD_STREETS = ["PREFLOP", "FLOP", "TURN", "RIVER"];
const STUD_STREETS = ["THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH"];
const BOARD_VARIANTS = new Set(["B01", "B02", "B05", "B06"]);
const STUD_VARIANTS = new Set(["ST1", "ST2", "ST3"]);
// Midpoints of the board trainer's _position_bucket intervals. This preserves
// its categorical teacher semantics; it is not a claim of positional equity.
const BOARD_POSITION_MIDPOINTS = { UTG: 0.07, MP: 0.23, CO: 0.42, BTN: 0.63, SB: 0.81, BB: 0.94 };
const validChips = value => typeof value === "number" && Number.isFinite(value) && value >= 0;

function boardActionLimits(controller, variantId, seatIndex, toCall) {
  const actor = controller.state.players[seatIndex];
  const stack = actor.stack;
  const currentBet = controller.state.currentBet;
  const fixedLimit = variantId === "B02";
  const potLimit = variantId === "B05" || variantId === "B06";
  const unit = fixedLimit
    ? controller.getLimitUnit()
    : currentBet === 0
      ? Math.max(1, controller.blinds.bb)
      : Math.max(1, controller.state.lastFullRaiseSize ?? controller.blinds.bb);
  const maximumCommit = fixedLimit
    ? Math.min(stack, toCall + unit)
    : potLimit
      ? Math.min(stack, controller.getPotLimitMaxCommit(seatIndex))
      : stack;
  const capped = fixedLimit && controller.raiseCountThisStreet >= controller.raiseCap;
  const restricted = (controller.state.raiseRestrictedSeatIndexes ?? []).includes(seatIndex);
  const canIncrease = stack > toCall && !capped && !restricted && (
    maximumCommit >= toCall + unit || maximumCommit === stack
  );
  const aggressiveAction = currentBet > 0 ? "raise" : "bet";
  const legalActions = toCall > 0 ? ["fold", "call"] : ["check"];
  if (canIncrease) legalActions.push(aggressiveAction);
  // An all-in shorter than the call is a valid call. An aggressive all-in is
  // available only when the entire stack fits the variant's betting limit.
  if (stack <= toCall || (canIncrease && stack <= maximumCommit)) {
    legalActions.push("all-in");
  }
  return {
    legalActions,
    amountBounds: {
      callCommit: Math.min(stack, toCall),
      aggressiveAction: canIncrease ? aggressiveAction : null,
      minimumFullCommit: canIncrease ? toCall + unit : null,
      maximumCommit: canIncrease ? maximumCommit : null,
      shortAllInCommit: canIncrease && stack < toCall + unit ? stack : null,
    },
  };
}

export function buildTenGameLiveBettingContext({ variantId, controller, seatIndex } = {}) {
  const isBoard = BOARD_VARIANTS.has(variantId);
  const isStud = STUD_VARIANTS.has(variantId);
  const state = controller?.state;
  const actorIndex = seatIndex ?? state?.currentActor;
  const actor = state?.players?.[actorIndex];
  const streets = isBoard ? BOARD_STREETS : STUD_STREETS;
  const streetIndex = streets.indexOf(state?.street);
  if ((!isBoard && !isStud) || streetIndex < 0 || actorIndex !== state.currentActor ||
      !actor || actor.folded || actor.seatOut || actor.allIn || !validChips(actor.stack) || !(actor.stack > 0) ||
      !validChips(actor.totalInvested) || !validChips(actor.betThisStreet) || !validChips(state.currentBet) ||
      typeof controller.calculatePot !== "function") return null;

  const currentBet = state.currentBet;
  const toCall = Math.max(0, currentBet - actor.betThisStreet);
  const chipUnit = actor.stack + actor.totalInvested;
  const potSize = controller.calculatePot();
  if (!(chipUnit > 0) || !validChips(potSize)) return null;
  const observation = {
    variantId,
    seatIndex: actorIndex,
    street: state.street,
    toCall,
    betSize: isStud || variantId === "B02"
      ? controller.getLimitUnit()
      : currentBet === 0
        ? Math.max(1, controller.blinds.bb)
        : Math.max(1, state.lastFullRaiseSize ?? controller.blinds.bb),
    potSize,
    chipUnit,
    activeOpponents: state.players.filter((player, index) =>
      index !== actorIndex && player && !player.folded && !player.seatOut && !player.allIn,
    ).length,
    stackRatio: actor.stack / chipUnit,
    streetProgress: streetIndex / (streets.length - 1),
    raiseCount: isStud || variantId === "B02"
      ? controller.raiseCountThisStreet
      : Number.isInteger(controller.fullRaiseCountThisStreet) && controller.fullRaiseCountThisStreet >= 0
        ? controller.fullRaiseCountThisStreet
        : null,
  };
  if (isBoard && typeof controller.getPositionLabel === "function") {
    observation.positionLabel = controller.getPositionLabel(actorIndex, state.players);
    if (Object.hasOwn(BOARD_POSITION_MIDPOINTS, observation.positionLabel)) {
      observation.position = BOARD_POSITION_MIDPOINTS[observation.positionLabel];
    }
  }
  const limits = isBoard ? boardActionLimits(controller, variantId, actorIndex, toCall) : {
    legalActions: null,
    amountBounds: null,
  };
  if (!validChips(observation.betSize) ||
      (limits.amountBounds && !validChips(limits.amountBounds.callCommit))) return null;
  const missingModelInputs = isBoard
    ? ["strength", "equity", "drawPotential", ...(observation.position == null ? ["position"] : []), ...(observation.raiseCount == null ? ["raiseCount"] : [])]
    : ["strength", "drawPotential", "visiblePressure", "position", "lowPotential", "highPotential", "legalActions", "amountBounds"];
  return {
    observation,
    ...limits,
    missingModelInputs,
    readyForModel: false,
  };
}
