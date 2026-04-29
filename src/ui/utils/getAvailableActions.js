export function getAvailableActions({ currentBet = 0, player } = {}) {
  if (!player) return [];

  const playerBet = typeof player.betThisRound === "number" ? player.betThisRound : 0;
  const playerStack = typeof player.stack === "number" ? player.stack : 0;
  const toCall = Math.max(0, currentBet - playerBet);
  const isAllInCall = toCall > 0 && playerStack > 0 && playerStack <= toCall;

  if (player.folded || player.allIn || player.seatOut) {
    return [];
  }

  const actions = [];

  if (toCall === 0) {
    actions.push({
      key: "CHECK",
      label: "Check",
      handler: "onCheck",
      variant: "check",
    });
    actions.push({
      key: "RAISE",
      label: "Raise",
      handler: "onRaise",
      variant: "raise",
    });
    actions.push({
      key: "FOLD",
      label: "Fold",
      handler: "onFold",
      variant: "fold",
    });
    return actions;
  }

  if (isAllInCall) {
    actions.push({
      key: "ALLIN_CALL",
      label: `All-in (Call ${toCall})`,
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

  actions.push({
    key: "RAISE",
    label: "Raise",
    handler: "onRaise",
    variant: "raise",
  });

  actions.push({
    key: "FOLD",
    label: "Fold",
    handler: "onFold",
    variant: "fold",
  });

  return actions;
}

export default getAvailableActions;
