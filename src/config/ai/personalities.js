const PERSONALITY_PARAMETERS = [
  "aggression",
  "looseness",
  "bluff",
  "callDown",
  "drawGreed",
  "tiltResistance",
];

export const AI_PERSONALITIES = [
  {
    id: "nit",
    label: "Nit",
    aggression: 0.25,
    looseness: 0.18,
    bluff: 0.08,
    callDown: 0.22,
    drawGreed: 0.2,
    tiltResistance: 0.82,
  },
  {
    id: "tag",
    label: "TAG",
    aggression: 0.55,
    looseness: 0.35,
    bluff: 0.25,
    callDown: 0.45,
    drawGreed: 0.4,
    tiltResistance: 0.7,
  },
  {
    id: "lag",
    label: "LAG",
    aggression: 0.72,
    looseness: 0.62,
    bluff: 0.46,
    callDown: 0.52,
    drawGreed: 0.58,
    tiltResistance: 0.58,
  },
  {
    id: "maniac",
    label: "Maniac",
    aggression: 0.9,
    looseness: 0.82,
    bluff: 0.62,
    callDown: 0.64,
    drawGreed: 0.76,
    tiltResistance: 0.32,
  },
  {
    id: "calling-station",
    label: "Calling Station",
    aggression: 0.28,
    looseness: 0.7,
    bluff: 0.08,
    callDown: 0.88,
    drawGreed: 0.54,
    tiltResistance: 0.62,
  },
  {
    id: "balanced",
    label: "Balanced",
    aggression: 0.5,
    looseness: 0.5,
    bluff: 0.22,
    callDown: 0.5,
    drawGreed: 0.45,
    tiltResistance: 0.65,
  },
];

const PERSONALITY_MAP = new Map(
  AI_PERSONALITIES.map((personality) => [personality.id, personality]),
);

export function getPersonalityById(personalityId = "balanced") {
  return PERSONALITY_MAP.get(personalityId) ?? PERSONALITY_MAP.get("balanced");
}

export function normalizePersonalityId(personalityId = "balanced") {
  return getPersonalityById(personalityId)?.id ?? "balanced";
}

export function hasRequiredPersonalityParameters(personality) {
  return PERSONALITY_PARAMETERS.every((key) => Number.isFinite(personality?.[key]));
}

export function getPersonalityParameters() {
  return [...PERSONALITY_PARAMETERS];
}
