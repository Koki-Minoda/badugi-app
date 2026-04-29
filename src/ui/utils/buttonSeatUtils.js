/**
 * Determines whether a player should be considered seated for button selection.
 * @param {object|null|undefined} player
 * @returns {boolean}
 */
import {
  isPlayerActiveInGame as baseIsPlayerActiveInGame,
  isPlayerSeated as baseIsPlayerSeated,
} from "../../games/badugi/flow/actionUtils.js";

export function isPlayerSeated(player) {
  return baseIsPlayerSeated(player);
}

/**
 * Determines whether a player is eligible to play the next hand.
 * @param {object|null|undefined} player
 * @returns {boolean}
 */
export function isPlayerActiveInGame(player) {
  if (!player) return false;
  if (typeof player.isActiveInGame === "boolean") return player.isActiveInGame;
  if (!isPlayerSeated(player)) return false;
  if (!baseIsPlayerActiveInGame(player)) return false;
  if (typeof player?.stack === "number" && player.stack <= 0) return false;
  return true;
}

/**
 * Picks a random dealer seat for the very first hand.
 * Throws if fewer than two players are eligible.
 * @param {Array<object>} players
 * @returns {number}
 */
export function initializeButtonForFirstHand(players = []) {
  const seatPool = (Array.isArray(players) ? players : [])
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => isPlayerSeated(player) && isPlayerActiveInGame(player))
    .map(({ index }) => index);

  if (seatPool.length < 2) {
    throw new Error("Not enough active seated players to start the game.");
  }

  const randomIndex = Math.floor(Math.random() * seatPool.length);
  return seatPool[randomIndex];
}

/**
 * Finds the next alive (seated + active) seat after a given dealer index.
 * @param {Array<object>} players
 * @param {number} fromSeat
 * @returns {number|null}
 */
export function nextAliveSeat(players = [], fromSeat = 0) {
  const list = Array.isArray(players) ? players : [];
  const n = list.length;
  if (n === 0) return null;
  let cursor = typeof fromSeat === "number" ? fromSeat : 0;
  for (let step = 0; step < n; step += 1) {
    cursor = (cursor + 1) % n;
    const candidate = list[cursor];
    if (isPlayerSeated(candidate) && isPlayerActiveInGame(candidate)) {
      return cursor;
    }
  }
  return null;
}
