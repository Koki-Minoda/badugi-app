import { combinations } from "../evaluators/core.js";
import {
  compareChineseScore,
  evaluateChineseRows,
} from "./chinesePokerScorer.js";

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const SUITS = ["C", "D", "H", "S"];
const ROWS = ["front", "middle", "back"];

function createStandardDeck() {
  return RANKS.flatMap((rank) => SUITS.map((suit) => `${rank}${suit}`));
}

function shuffleDeck(cards, random = Math.random) {
  const deck = [...cards];
  for (let idx = deck.length - 1; idx > 0; idx -= 1) {
    const swapIdx = Math.floor(random() * (idx + 1));
    [deck[idx], deck[swapIdx]] = [deck[swapIdx], deck[idx]];
  }
  return deck;
}

function uniqueCards(cards = []) {
  return new Set(cards).size === cards.length;
}

function withoutCards(cards, remove) {
  const removeSet = new Set(remove);
  return cards.filter((card) => !removeSet.has(card));
}

function getArrangementScore(evaluation) {
  if (!evaluation || evaluation.foul) return Number.NEGATIVE_INFINITY;
  return (
    evaluation.royalties.total * 100000 -
    evaluation.front.rankPrimary * 0.2 -
    evaluation.middle.rankPrimary * 0.35 -
    evaluation.back.rankPrimary * 0.45
  );
}

export function autoArrangeChineseHand(cards = []) {
  if (!Array.isArray(cards) || cards.length !== 13 || !uniqueCards(cards)) {
    throw new Error("Chinese Poker auto arrange requires 13 unique cards");
  }

  let best = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const back of combinations(cards, 5)) {
    const restAfterBack = withoutCards(cards, back);
    for (const middle of combinations(restAfterBack, 5)) {
      const front = withoutCards(restAfterBack, middle);
      const evaluation = evaluateChineseRows({ front, middle, back });
      const score = getArrangementScore(evaluation);
      if (score > bestScore) {
        bestScore = score;
        best = { front, middle, back, evaluation };
      }
    }
  }

  if (best) return best;
  const fallback = {
    front: cards.slice(0, 3),
    middle: cards.slice(3, 8),
    back: cards.slice(8, 13),
  };
  return { ...fallback, evaluation: evaluateChineseRows(fallback) };
}

function normalizeSeat(seat, index) {
  if (typeof seat === "string") {
    return { id: seat, name: seat, isHero: index === 0 };
  }
  return {
    id: seat?.id ?? `seat-${index + 1}`,
    name: seat?.name ?? `Player ${index + 1}`,
    isHero: Boolean(seat?.isHero) || index === 0,
    stack: seat?.stack ?? 0,
  };
}

function compareRows(row, left, right) {
  return compareChineseScore(left.evaluation[row], right.evaluation[row]);
}

function scoreHeadsUp(left, right) {
  if (left.evaluation.foul && right.evaluation.foul) {
    return { points: 0, rows: {}, royalties: 0, scoop: 0, foul: "both" };
  }
  if (left.evaluation.foul) {
    return { points: -6, rows: { front: -1, middle: -1, back: -1 }, royalties: 0, scoop: -3, foul: left.id };
  }
  if (right.evaluation.foul) {
    return { points: 6, rows: { front: 1, middle: 1, back: 1 }, royalties: 0, scoop: 3, foul: right.id };
  }

  const rows = {};
  let rowPoints = 0;
  for (const row of ROWS) {
    const cmp = compareRows(row, left, right);
    rows[row] = cmp < 0 ? 1 : cmp > 0 ? -1 : 0;
    rowPoints += rows[row];
  }
  const scoop = rowPoints === 3 ? 3 : rowPoints === -3 ? -3 : 0;
  const royalties = left.evaluation.royalties.total - right.evaluation.royalties.total;
  return {
    points: rowPoints + scoop + royalties,
    rows,
    royalties,
    scoop,
    foul: null,
  };
}

export class ChinesePokerController {
  constructor({ seats = [], random = Math.random, deck = null, shuffle = true } = {}) {
    const normalizedSeats = seats.map(normalizeSeat).filter(Boolean);
    this.seats =
      normalizedSeats.length >= 2
        ? normalizedSeats
        : [
            normalizeSeat({ id: "hero", name: "You", isHero: true }, 0),
            normalizeSeat({ id: "cpu-1", name: "CPU 1" }, 1),
          ];
    this.random = random;
    this.sourceDeck = deck;
    this.shuffle = shuffle;
    this.handId = 0;
    this.phase = "idle";
    this.players = [];
    this.results = null;
  }

  startNewHand() {
    const activeSeats = this.seats.slice(0, 4);
    const baseDeck = this.sourceDeck ?? createStandardDeck();
    const deck = this.shuffle ? shuffleDeck(baseDeck, this.random) : [...baseDeck];
    this.handId += 1;
    this.phase = "set";
    this.results = null;
    this.players = activeSeats.map((seat, index) => {
      const hand = deck.slice(index * 13, index * 13 + 13);
      const arrangement = autoArrangeChineseHand(hand);
      return {
        ...seat,
        hand,
        rows: {
          front: arrangement.front,
          middle: arrangement.middle,
          back: arrangement.back,
        },
        evaluation: arrangement.evaluation,
        ready: !seat.isHero,
      };
    });
    return this.getSnapshot();
  }

  setRows(playerId, rows) {
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new Error(`Unknown Chinese Poker player: ${playerId}`);
    const nextRows = {
      front: rows?.front ?? [],
      middle: rows?.middle ?? [],
      back: rows?.back ?? [],
    };
    const used = [...nextRows.front, ...nextRows.middle, ...nextRows.back];
    const ownsAllCards = used.every((card) => player.hand.includes(card));
    if (used.length !== 13 || !uniqueCards(used) || !ownsAllCards) {
      throw new Error("Chinese Poker rows must use exactly the player's 13 unique cards");
    }
    player.rows = nextRows;
    player.evaluation = evaluateChineseRows(nextRows);
    player.ready = true;
    return this.getSnapshot();
  }

  autoSetRows(playerId) {
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new Error(`Unknown Chinese Poker player: ${playerId}`);
    const arrangement = autoArrangeChineseHand(player.hand);
    return this.setRows(playerId, arrangement);
  }

  resolveShowdown() {
    const ready = this.players.every((player) => player.ready);
    if (!ready) {
      throw new Error("Cannot resolve Chinese Poker showdown before all players are ready");
    }
    const totals = Object.fromEntries(this.players.map((player) => [player.id, 0]));
    const matchups = [];
    for (let i = 0; i < this.players.length; i += 1) {
      for (let j = i + 1; j < this.players.length; j += 1) {
        const left = this.players[i];
        const right = this.players[j];
        const result = scoreHeadsUp(left, right);
        totals[left.id] += result.points;
        totals[right.id] -= result.points;
        matchups.push({
          playerA: left.id,
          playerB: right.id,
          ...result,
        });
      }
    }
    this.phase = "showdown";
    this.results = { totals, matchups };
    return this.getSnapshot();
  }

  nextHand() {
    return this.startNewHand();
  }

  getSnapshot() {
    return {
      game: "chinese_poker",
      handId: this.handId,
      phase: this.phase,
      players: this.players.map((player) => ({
        id: player.id,
        name: player.name,
        isHero: player.isHero,
        stack: player.stack,
        hand: player.isHero || this.phase === "showdown" ? [...player.hand] : [],
        rows: {
          front: [...(player.rows?.front ?? [])],
          middle: [...(player.rows?.middle ?? [])],
          back: [...(player.rows?.back ?? [])],
        },
        evaluation: player.evaluation,
        ready: player.ready,
      })),
      results: this.results,
    };
  }
}

export default ChinesePokerController;
