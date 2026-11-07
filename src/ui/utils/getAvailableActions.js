export function getAvailableActions({ currentBet = 0, player, canRaise = true, legalActions = null } = {}) {
  if (!player) return [];

  const playerBet = typeof player.betThisRound === "number" ? player.betThisRound : 0;
  const playerStack = typeof player.stack === "number" ? player.stack : 0;
  const toCall = Math.max(0, currentBet - playerBet);
  const isAllInCall = toCall > 0 && playerStack > 0 && playerStack <= toCall;

  if (player.folded || player.allIn || player.seatOut) {
    return [];
  }

  const actions = [];

  const restrictToController = (available) => {
    if (!Array.isArray(legalActions)) return available;
    const legal = new Set(legalActions.map((action) =>
      String(typeof action === "string" ? action : action?.type ?? "").toUpperCase(),
    ));
    return available.filter((action) => legal.has(action.key === "ALLIN_CALL" ? "CALL" : action.key));
  };

  if (toCall === 0) {
    actions.push({
      key: "CHECK",
      label: "Check",
      handler: "onCheck",
      variant: "check",
    });
    if (canRaise && playerStack > toCall) {
      actions.push({
        key: "RAISE",
        label: "Raise",
        handler: "onRaise",
        variant: "raise",
      });
    }
    actions.push({
      key: "FOLD",
      label: "Fold",
      handler: "onFold",
      variant: "fold",
    });
    return restrictToController(actions);
  }

  if (isAllInCall) {
    actions.push({
      key: "ALLIN_CALL",
      label: `All-in (Call ${playerStack})`,
      handler: "onCall",
      variant: "allin",
    });
  } else {
    actions.push({
      key: "CALL",
      label: `Call ${toCall}`,
      handler: "onCall",
      variant: "call",
    });
  }

  if (canRaise && playerStack > toCall) {
    actions.push({
      key: "RAISE",
      label: "Raise",
      handler: "onRaise",
      variant: "raise",
    });
  }

  actions.push({
    key: "FOLD",
    label: "Fold",
    handler: "onFold",
    variant: "fold",
  });

  return restrictToController(actions);
}

export default getAvailableActions;
