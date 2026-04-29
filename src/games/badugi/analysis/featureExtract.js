const STACK_BUCKETS = [
  { max: 0.5, label: "<=0.5" },
  { max: 1, label: "0.5-1" },
  { max: 2, label: "1-2" },
  { max: 4, label: "2-4" },
];

function pickFinite(...values) {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function bucketizeNumber(value, step = 25, clamp = 5000) {
  if (!Number.isFinite(value)) return null;
  const safeStep = Math.max(1, step);
  const rounded = Math.min(clamp, Math.round(value / safeStep) * safeStep);
  return `${rounded}`;
}

function bucketizeRatio(ratio) {
  if (!Number.isFinite(ratio)) return ">4";
  const abs = Math.max(0, ratio);
  if (abs <= STACK_BUCKETS[0].max) return STACK_BUCKETS[0].label;
  if (abs <= STACK_BUCKETS[1].max) return STACK_BUCKETS[1].label;
  if (abs <= STACK_BUCKETS[2].max) return STACK_BUCKETS[2].label;
  if (abs <= STACK_BUCKETS[3].max) return STACK_BUCKETS[3].label;
  return ">4";
}

function buildStackBuckets(seats = []) {
  const stacks = seats
    .map((seat) => Number(seat?.initialStack ?? seat?.startStack ?? seat?.stack))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!stacks.length) return [];
  const baseline = stacks.reduce((sum, value) => sum + value, 0) / stacks.length || 1;
  return stacks.map((value) => bucketizeRatio(value / baseline));
}

function inferPositionBucket({ seat, buttonSeat, numPlayers }) {
  if (!Number.isInteger(seat) || !Number.isInteger(numPlayers) || numPlayers <= 0) {
    return "UNKNOWN";
  }
  if (!Number.isInteger(buttonSeat)) return "UNKNOWN";
  const offset = ((seat - buttonSeat) % numPlayers + numPlayers) % numPlayers;
  if (numPlayers === 2) {
    return offset === 0 ? "BTN" : "BB";
  }
  switch (offset) {
    case 0:
      return "BTN";
    case 1:
      return "SB";
    case 2:
      return "BB";
    case 3:
      return "UTG";
    case 4:
      return "MP";
    default:
      return "CO";
  }
}

function buildDrawActionKey(discardCount) {
  const count = Number.isInteger(discardCount) ? Math.max(0, discardCount) : 0;
  return `DRAW:${Math.min(4, count)}`;
}

function buildBetActionKey(event, context) {
  const action = typeof event?.action === "string" ? event.action.toLowerCase() : "action";
  if (action.includes("fold")) return "FOLD";
  if (action.includes("check")) return "CHECK";
  if (action.includes("call")) return "CALL";
  const amount = pickFinite(event?.amount, event?.raiseTo, event?.total);
  const actorStack = Number(context?.actorStack);
  if (action.includes("all-in")) return "RAISE:ALLIN";
  const toCall = Number(context?.toCall);
  if (action.includes("raise") || action.includes("bet")) {
    if (!Number.isFinite(amount) || amount <= 0) return "RAISE:MIN";
    if (Number.isFinite(actorStack) && actorStack > 0 && amount >= actorStack - 1) {
      return "RAISE:ALLIN";
    }
    if (Number.isFinite(toCall) && toCall > 0) {
      const ratio = amount / Math.max(1, toCall);
      if (ratio <= 1.2) return "RAISE:MIN";
      if (ratio <= 2.2) return "RAISE:2X";
      if (ratio <= 3.5) return "RAISE:3X";
      return "RAISE:BIG";
    }
    if (Number.isFinite(actorStack) && actorStack > 0) {
      const stackRatio = amount / actorStack;
      if (stackRatio >= 0.95) return "RAISE:ALLIN";
      if (stackRatio >= 0.5) return "RAISE:BIG";
    }
    return "RAISE:MIN";
  }
  return action.toUpperCase();
}

export function buildSignatureKey(context = {}) {
  const payload = {
    phase: context.phase ?? "UNKNOWN",
    position: context.positionBucket ?? "UNKNOWN",
    pot: context.potBucket ?? null,
    toCall: context.toCallBucket ?? null,
    betRound: context.betRound ?? 0,
    drawRound: context.drawRound ?? 0,
    numPlayers: context.numPlayers ?? 0,
    numActive: context.numActive ?? 0,
    stackBuckets: context.stackBuckets ?? [],
  };
  return JSON.stringify(payload);
}

export function extractDecisionContext(handHistory, eventIndex) {
  if (!handHistory || !Array.isArray(handHistory.events)) return null;
  const event = handHistory.events[eventIndex];
  if (!event) return null;
  if (event.type !== "BET_ACTION" && event.type !== "DRAW_ACTION") return null;
  const seat = Number.isInteger(event.seat) ? event.seat : null;
  if (seat == null || seat < 0) return null;
  const seats = Array.isArray(handHistory.seats) ? handHistory.seats : [];
  const seatInfo = seats[seat] ?? {};
  const numPlayers = seats.length || Number(handHistory?.numPlayers) || 0;
  const pot = pickFinite(event.pot, event.potSize, event.totalPot, event.potAfter);
  const toCall = pickFinite(event.toCall, event.callAmount, event.needToCall);
  const minRaise = pickFinite(event.minRaise, event.raiseTo, event.minBet);
  const betRound = event.betRound ?? event.round ?? null;
  const drawRound = event.drawRound ?? null;
  const activeSeats = seats.filter(
    (entry) => Number(entry?.initialStack ?? entry?.startStack ?? entry?.stack) > 0,
  ).length;
  const phase = event.type === "DRAW_ACTION" ? "DRAW" : "BET";
  const actorStack = Number(seatInfo?.initialStack ?? seatInfo?.startStack ?? seatInfo?.stack);
  const discardCount = Array.isArray(event.discarded)
    ? event.discarded.length
    : Number(event.discardCount) || 0;
  const positionBucket = inferPositionBucket({
    seat,
    buttonSeat: handHistory?.buttonSeat,
    numPlayers,
  });
  const context = {
    phase,
    seat,
    seatInfo,
    numPlayers,
    buttonSeat: handHistory?.buttonSeat ?? null,
    sbSeat: handHistory?.sbSeat ?? null,
    bbSeat: handHistory?.bbSeat ?? null,
    pot,
    toCall,
    minRaise,
    betRound,
    drawRound,
    actorStack: Number.isFinite(actorStack) ? actorStack : null,
    discardCount,
    action: event?.action ?? null,
    positionBucket,
    stackBuckets: buildStackBuckets(seats),
    potBucket: bucketizeNumber(pot, 25),
    toCallBucket: bucketizeNumber(toCall, 10),
    numActive: activeSeats || numPlayers,
  };
  context.actionTaken =
    phase === "DRAW"
      ? buildDrawActionKey(discardCount)
      : String(event?.action ?? "action").toUpperCase();
  context.actionKey =
    phase === "DRAW" ? buildDrawActionKey(discardCount) : buildBetActionKey(event, context);
  context.signature = buildSignatureKey(context);
  return context;
}

export function generateBetCandidates(context = {}) {
  const toCall = Number(context?.toCall);
  const candidates = [
    { actionKey: "FOLD", label: "Fold", description: "Give up the current pot." },
  ];
  if (Number.isFinite(toCall) && toCall > 0) {
    candidates.push({
      actionKey: "CALL",
      label: "Call",
      description: `Match ${toCall} to continue.`,
    });
  } else {
    candidates.push({
      actionKey: "CHECK",
      label: "Check",
      description: "Take a free card if allowed.",
    });
  }
  candidates.push(
    { actionKey: "RAISE:MIN", label: "Raise (min)", description: "Minimal raise sizing." },
    { actionKey: "RAISE:2X", label: "Raise (2x)", description: "Apply additional pressure." },
    { actionKey: "RAISE:ALLIN", label: "All-in", description: "Maximum aggression." },
  );
  const seen = new Set();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.actionKey)) return false;
    seen.add(candidate.actionKey);
    return true;
  });
}

export function generateDrawCandidates() {
  return Array.from({ length: 5 }).map((_, idx) => ({
    actionKey: buildDrawActionKey(idx),
    label: idx === 0 ? "Keep all" : `Discard ${idx}`,
    description: idx === 0 ? "Stand pat, no discards." : `Discard ${idx} card(s).`,
  }));
}
