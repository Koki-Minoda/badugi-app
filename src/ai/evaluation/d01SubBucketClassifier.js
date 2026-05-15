import { evaluateLowHand } from "../../games/evaluators/low.js";

function normalizeCard(card = "") {
  return String(card ?? "").trim().toUpperCase();
}

function rankValue(card = "") {
  const normalized = normalizeCard(card);
  const rank = normalized.slice(0, -1);
  if (rank === "A") return 14;
  if (rank === "K") return 13;
  if (rank === "Q") return 12;
  if (rank === "J") return 11;
  return Number(rank);
}

function getActorPlayer(sample = {}) {
  const seat = Number(sample.actorSeat ?? sample.seatIndex ?? 0);
  return sample?.snapshot?.players?.[seat] ?? sample?.state?.snapshot?.players?.[seat] ?? null;
}

function getActorHand(sample = {}) {
  const player = getActorPlayer(sample);
  const hand = player?.hand ?? player?.cards ?? [];
  return Array.isArray(hand) ? [...hand] : [];
}

function analyze27Texture(hand = []) {
  const evaluation = evaluateLowHand({ cards: hand, lowType: "27" });
  const ranks = [...(evaluation?.metadata?.ranks ?? [])].map((rank) => Number(rank) || 99).sort((a, b) => a - b);
  const orderedHigh = [...ranks].sort((a, b) => b - a);
  const highestRank = orderedHigh[0] ?? 99;
  const secondHighest = orderedHigh[1] ?? 99;
  const largestGap = ranks.slice(1).reduce((gap, rank, index) => Math.max(gap, rank - ranks[index]), 0);
  const category = String(evaluation?.metadata?.category ?? "");
  const paired = new Set(orderedHigh).size < orderedHigh.length;
  const penalty = paired || ["pair", "straight", "flush", "straightFlush"].includes(category);
  const isSmooth = highestRank <= 8 && secondHighest <= 6 && largestGap <= 2;
  const isRough = !penalty && !isSmooth;
  return {
    evaluation,
    category,
    ranks: orderedHigh,
    highestRank,
    secondHighest,
    largestGap,
    paired,
    penalty,
    isSmooth,
    isRough,
  };
}

function classifyPlayerCount(playerCount = 0) {
  if (playerCount <= 2) return "HU";
  if (playerCount === 3) return "3way";
  return "4way+";
}

function classifyPosition(position = "") {
  const normalized = String(position ?? "").toLowerCase();
  if (normalized.includes("button")) return "button";
  if (normalized.includes("blind")) return "blind";
  if (normalized === "cutoff" || normalized === "late") return "IP";
  return "OOP";
}

function classifyDrawRound(drawRound = 0) {
  const round = Number(drawRound ?? 0);
  if (round <= 0) return "drawRound1";
  if (round === 1) return "drawRound2";
  return "finalRound";
}

function classifyRaiseState(sample = {}) {
  const facing = String(sample.facingAction ?? "none").toLowerCase();
  const roundBucket = classifyDrawRound(sample.drawRound);
  if (facing === "raise" && roundBucket === "finalRound") return "repeatedPressure";
  if (facing === "raise") return "facingRaise";
  return "facingBet";
}

function classifyPressureSize(sample = {}) {
  const player = getActorPlayer(sample);
  const currentBet = Number(sample?.snapshot?.currentBet ?? sample?.state?.snapshot?.currentBet ?? 0);
  const playerBet = Number(player?.betThisRound ?? player?.betThisStreet ?? player?.bet ?? 0);
  const toCall = Math.max(0, currentBet - playerBet);
  if (toCall <= 10) return { pressureSize: "tiny", toCall };
  if (toCall <= 20) return { pressureSize: "small", toCall };
  if (toCall <= 40) return { pressureSize: "medium", toCall };
  return { pressureSize: "large", toCall };
}

function classifyHandTexture(parentBucket = "", hand = []) {
  const texture = analyze27Texture(hand);
  if (texture.paired || texture.penalty) {
    return { handTexture: "paired blocker", texture };
  }
  if (parentBucket.startsWith("premium27TD") && texture.isSmooth) {
    return { handTexture: "premium smooth", texture };
  }
  if (texture.isSmooth) {
    return { handTexture: "smooth", texture };
  }
  return { handTexture: "rough", texture };
}

function getParentBucket(sample = {}) {
  const handClass = String(sample.handClass ?? "");
  if (handClass === "premium27TD") return "premium27TD late pressure";
  if (handClass === "strong27TD") return "strong27TD late pressure";
  if (handClass === "medium27TD") return "medium27TD pressure";
  return null;
}

export function classifyD01SubBucket(sample = {}) {
  if (String(sample.variantId ?? "") !== "D01") return null;
  const parentBucket = getParentBucket(sample);
  if (!parentBucket) return null;
  const hand = getActorHand(sample);
  const playerCountClass = classifyPlayerCount(Number(sample.playerCount ?? 0));
  const positionClass = classifyPosition(sample.position);
  const { pressureSize, toCall } = classifyPressureSize(sample);
  const raiseState = classifyRaiseState(sample);
  const drawRoundClass = classifyDrawRound(sample.drawRound);
  const { handTexture, texture } = classifyHandTexture(parentBucket, hand);
  const subBucketId = [
    parentBucket,
    playerCountClass,
    positionClass,
    pressureSize,
    raiseState,
    drawRoundClass,
    handTexture,
  ].join("|");

  return {
    subBucketId,
    parentBucket,
    decomposition: {
      playerCount: playerCountClass,
      position: positionClass,
      pressureSize,
      raiseState,
      drawRound: drawRoundClass,
      handTexture,
      toCall,
      highestRank: texture.highestRank,
      secondHighest: texture.secondHighest,
      largestGap: texture.largestGap,
      paired: texture.paired,
      penalty: texture.penalty,
      ranks: texture.ranks,
      hand: hand.map(normalizeCard),
    },
  };
}

