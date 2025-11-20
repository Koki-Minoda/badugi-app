export class EngineError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = this.constructor.name;
    this.meta = meta;
  }
}

export class IllegalActionError extends EngineError {
  constructor(message, meta = {}) {
    super(message ?? "Illegal action", meta);
  }
}

export class EngineInvariantError extends EngineError {
  constructor(message, meta = {}) {
    super(message ?? "Engine invariant violated", meta);
  }
}

export function assertSeatIsActive(player, { seatIndex, actionType } = {}) {
  if (!player) {
    throw new IllegalActionError("Seat is empty", { seatIndex, actionType });
  }
  if (player.seatOut || player.isBusted) {
    throw new IllegalActionError("Seat is sitting out", { seatIndex, actionType });
  }
  if (player.folded && actionType !== "DRAW") {
    throw new IllegalActionError("Folded seats cannot act", { seatIndex, actionType });
  }
  if (player.allIn && actionType !== "DRAW") {
    throw new IllegalActionError("All-in seats cannot bet further", { seatIndex, actionType });
  }
}
