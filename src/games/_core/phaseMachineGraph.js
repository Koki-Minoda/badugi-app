const TERMINAL_PHASES = new Set(["SHOWDOWN", "COLLECT", "RESULT", "HAND_RESULT", "NEXT_HAND", "WAITING_NEXT_HAND", "TABLE_FINISHED"]);

export const CORE5_PHASES = Object.freeze([
  "HAND_START",
  "POST_BLINDS",
  "BET",
  "DRAW",
  "SHOWDOWN",
  "COLLECT",
  "RESULT",
  "NEXT_HAND",
  "TABLE_FINISHED",
]);

export const CORE5_PHASE_GRAPH = Object.freeze({
  HAND_START: Object.freeze(["POST_BLINDS", "BET"]),
  POST_BLINDS: Object.freeze(["BET"]),
  BET: Object.freeze(["DRAW", "SHOWDOWN", "COLLECT", "RESULT", "HAND_RESULT", "NEXT_HAND", "TABLE_FINISHED"]),
  DRAW: Object.freeze(["BET", "SHOWDOWN", "COLLECT", "RESULT", "HAND_RESULT", "NEXT_HAND", "TABLE_FINISHED"]),
  SHOWDOWN: Object.freeze(["COLLECT", "RESULT", "HAND_RESULT", "NEXT_HAND", "TABLE_FINISHED"]),
  COLLECT: Object.freeze(["RESULT", "HAND_RESULT", "NEXT_HAND", "TABLE_FINISHED"]),
  RESULT: Object.freeze(["NEXT_HAND", "TABLE_FINISHED", "HAND_START", "POST_BLINDS", "BET"]),
  HAND_RESULT: Object.freeze(["NEXT_HAND", "TABLE_FINISHED", "HAND_START", "POST_BLINDS", "BET"]),
  NEXT_HAND: Object.freeze(["HAND_START", "POST_BLINDS", "BET", "TABLE_FINISHED"]),
  WAITING_NEXT_HAND: Object.freeze(["NEXT_HAND", "TABLE_FINISHED", "HAND_START", "POST_BLINDS", "BET"]),
  TABLE_FINISHED: Object.freeze([]),
});

const VARIANT_MAX_DRAWS = Object.freeze({
  badugi: 3,
  D01: 3,
  D02: 3,
  S01: 1,
  S02: 1,
});

export function normalizePhaseName(phase) {
  if (phase == null) return null;
  const value = String(phase).toUpperCase();
  if (value === "COMPLETE" || value === "TERMINAL") return "RESULT";
  if (value === "WAITING_NEXT_HAND") return "NEXT_HAND";
  return value;
}

export function getCore5MaxDrawRounds(variantId) {
  const key = String(variantId ?? "").trim();
  return VARIANT_MAX_DRAWS[key] ?? VARIANT_MAX_DRAWS[key.toUpperCase()] ?? 3;
}

export function isTerminalPhase(phase) {
  return TERMINAL_PHASES.has(normalizePhaseName(phase)) || TERMINAL_PHASES.has(String(phase ?? "").toUpperCase());
}

export function isLegalPhaseTransition(fromPhase, toPhase) {
  const from = normalizePhaseName(fromPhase);
  const to = normalizePhaseName(toPhase);
  if (!from || !to) return true;
  if (from === to) return true;
  return (CORE5_PHASE_GRAPH[from] ?? []).includes(to);
}

export function getLegalNextPhases(phase) {
  return [...(CORE5_PHASE_GRAPH[normalizePhaseName(phase)] ?? [])];
}
