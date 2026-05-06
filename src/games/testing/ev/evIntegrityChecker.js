const EPSILON = 0.000001;

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function normalizeSeatIndex(value) {
  if (value == null) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function getPlayers(state = {}) {
  return Array.isArray(state.players) ? state.players : [];
}

function getPlayerSeat(player = {}, fallbackSeatIndex = null) {
  return normalizeSeatIndex(
    player.seatIndex ??
      player.seat ??
      player.index ??
      player.positionIndex ??
      fallbackSeatIndex,
  );
}

function getPlayerId(player = {}, seatIndex = null) {
  return player.playerId ?? player.id ?? player.seatId ?? (seatIndex == null ? null : `seat-${seatIndex}`);
}

function isPlayerFolded(player = {}) {
  return Boolean(player.folded || player.hasFolded || String(player.status ?? "").toLowerCase() === "folded");
}

function isPlayerInactive(player = {}) {
  return Boolean(
    player.isBusted ||
      player.busted ||
      player.eliminated ||
      player.seatOut ||
      player.sittingOut ||
      String(player.status ?? "").toLowerCase() === "busted",
  );
}

function getLivePot(state = {}) {
  if (isFiniteNumber(state.pot)) return toNumber(state.pot);
  if (isFiniteNumber(state.totalPot)) return toNumber(state.totalPot);
  if (Array.isArray(state.pots)) {
    return state.pots.reduce((sum, pot) => sum + Math.max(0, toNumber(pot?.amount ?? pot?.potAmount)), 0);
  }
  return 0;
}

function sumStacks(state = {}) {
  return getPlayers(state).reduce((sum, player) => sum + toNumber(player?.stack), 0);
}

function getContribution(player = {}) {
  return toNumber(
    player.totalInvested ??
      player.committed ??
      player.contribution ??
      player.contributed ??
      player.betTotal ??
      player.betThisHand ??
      player.bet ??
      player.betThisRound ??
      player.betThisStreet,
  );
}

function getCommittedTotal(state = {}) {
  const players = getPlayers(state);
  const playerCommitted = players.reduce((sum, player) => sum + Math.max(0, getContribution(player)), 0);
  const pot = getLivePot(state);
  return Math.max(playerCommitted, pot);
}

function getResult(state = {}, result = null, handHistory = null) {
  return (
    result ??
    handHistory?.result ??
    state.lastHandResult ??
    state.handResult ??
    state.result ??
    state.metadata?.lastHandResult ??
    null
  );
}

function resultPotTotal(result = {}) {
  if (!result) return 0;
  if (isFiniteNumber(result.totalPot)) return toNumber(result.totalPot);
  if (isFiniteNumber(result.pot)) return toNumber(result.pot);
  if (Array.isArray(result.potDetails)) {
    return result.potDetails.reduce((sum, pot) => sum + Math.max(0, toNumber(pot?.amount ?? pot?.potAmount)), 0);
  }
  if (Array.isArray(result.pots)) {
    return result.pots.reduce((sum, pot) => sum + Math.max(0, toNumber(pot?.amount ?? pot?.potAmount)), 0);
  }
  if (Array.isArray(result.results)) {
    return result.results.reduce((sum, entry) => sum + Math.max(0, toNumber(entry?.pot ?? entry?.amount)), 0);
  }
  return 0;
}

function normalizeWinnerEntry(entry, defaults = {}) {
  if (entry == null) return null;
  if (typeof entry === "number" || typeof entry === "string") {
    return {
      seatIndex: normalizeSeatIndex(entry),
      playerId: typeof entry === "string" ? entry : null,
      amount: defaults.amount ?? null,
      potIndex: defaults.potIndex ?? null,
      component: defaults.component ?? "main",
    };
  }
  const seatIndex = normalizeSeatIndex(entry.seatIndex ?? entry.seat ?? entry.index ?? entry.winnerSeatIndex);
  const playerId = entry.playerId ?? entry.id ?? entry.seatId ?? null;
  return {
    seatIndex,
    playerId,
    amount:
      entry.amount ??
      entry.payout ??
      entry.share ??
      entry.chips ??
      defaults.amount ??
      null,
    potIndex: entry.potIndex ?? defaults.potIndex ?? null,
    component: entry.component ?? entry.side ?? defaults.component ?? "main",
    raw: entry,
  };
}

function splitEvenly(amount, count) {
  if (!count) return [];
  const base = Math.floor(amount / count);
  let remainder = amount - base * count;
  return Array.from({ length: count }, () => {
    const share = base + (remainder > 0 ? 1 : 0);
    remainder -= 1;
    return share;
  });
}

function flattenPotWinners(pot = {}, potIndex = 0) {
  const amount = toNumber(pot.amount ?? pot.potAmount);
  const groups = [];
  if (Array.isArray(pot.winners) && pot.winners.length) groups.push({ component: "main", winners: pot.winners, amount });
  if (Array.isArray(pot.highWinners) && pot.highWinners.length) groups.push({ component: "high", winners: pot.highWinners, amount: amount / 2 });
  if (Array.isArray(pot.lowWinners) && pot.lowWinners.length) groups.push({ component: "low", winners: pot.lowWinners, amount: amount / 2 });
  if (Array.isArray(pot.badugiWinners) && pot.badugiWinners.length) {
    groups.push({ component: "badugi", winners: pot.badugiWinners, amount: amount / 2 });
  }
  return groups.flatMap((group) => {
    const shares = splitEvenly(Math.round(group.amount), group.winners.length);
    return group.winners.map((winner, index) =>
      normalizeWinnerEntry(winner, {
        amount: shares[index],
        potIndex,
        component: group.component,
      }),
    );
  }).filter(Boolean);
}

export function extractPayouts(result = {}) {
  if (!result) return [];
  const payouts = [];
  if (Array.isArray(result.potDetails)) {
    for (const [potIndex, pot] of result.potDetails.entries()) {
      payouts.push(...flattenPotWinners(pot, potIndex));
    }
  }
  if (Array.isArray(result.pots)) {
    for (const [potIndex, pot] of result.pots.entries()) {
      payouts.push(...flattenPotWinners(pot, potIndex));
    }
  }
  if (payouts.length === 0 && Array.isArray(result.results)) {
    for (const [potIndex, entry] of result.results.entries()) {
      const entryPayouts = entry?.payouts ?? entry?.winners ?? [];
      for (const payout of entryPayouts) {
        payouts.push(
          normalizeWinnerEntry(payout, {
            amount: payout?.amount ?? payout?.payout ?? entry?.amount ?? entry?.pot ?? null,
            potIndex,
            component: entry?.component ?? "main",
          }),
        );
      }
    }
  }
  if (payouts.length === 0 && Array.isArray(result.winners) && result.winners.length) {
    const existingAmount = payouts.reduce((sum, payout) => sum + toNumber(payout?.amount), 0);
    const total = Math.max(0, resultPotTotal(result) - existingAmount);
    const shares = splitEvenly(Math.round(total), result.winners.length);
    result.winners.forEach((winner, index) => {
      payouts.push(
        normalizeWinnerEntry(winner, {
          amount: shares[index],
          potIndex: 0,
          component: "main",
        }),
      );
    });
  }
  return payouts.filter(Boolean);
}

function getPotDetails(result = {}) {
  const pots = Array.isArray(result?.potDetails)
    ? result.potDetails
    : Array.isArray(result?.pots)
      ? result.pots
      : [];
  if (pots.length) {
    return pots.map((pot, potIndex) => ({
      potIndex,
      amount: toNumber(pot.amount ?? pot.potAmount),
      eligibleSeatIndexes: Array.isArray(pot.eligibleSeatIndexes)
        ? pot.eligibleSeatIndexes.map(normalizeSeatIndex).filter((seat) => seat != null)
        : Array.isArray(pot.eligible)
          ? pot.eligible.map(normalizeSeatIndex).filter((seat) => seat != null)
          : null,
      raw: pot,
    }));
  }
  const total = resultPotTotal(result);
  return total > 0 ? [{ potIndex: 0, amount: total, eligibleSeatIndexes: null, raw: result }] : [];
}

function getSeatLookup(state = {}) {
  const lookup = new Map();
  getPlayers(state).forEach((player, fallbackSeatIndex) => {
    const seatIndex = getPlayerSeat(player, fallbackSeatIndex);
    if (seatIndex != null) lookup.set(seatIndex, player);
  });
  return lookup;
}

function getSeatFromPayout(payout = {}, seatLookup = new Map()) {
  if (payout.seatIndex != null) return payout.seatIndex;
  if (payout.playerId != null) {
    for (const [seatIndex, player] of seatLookup.entries()) {
      if (getPlayerId(player, seatIndex) === payout.playerId) return seatIndex;
    }
  }
  return null;
}

function getRewardMap({ result = {}, handHistory = {} }) {
  const raw =
    result.rewardBySeat ??
    result.rewardsBySeat ??
    result.rewards ??
    handHistory.rewardBySeat ??
    handHistory.rewardsBySeat ??
    handHistory.rewards ??
    null;
  if (!raw || typeof raw !== "object") return null;
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Number(value)]));
}

function getStackDeltas(beforeState = {}, afterState = {}) {
  const beforePlayers = getSeatLookup(beforeState);
  const afterPlayers = getSeatLookup(afterState);
  const deltas = {};
  for (const [seatIndex, beforePlayer] of beforePlayers.entries()) {
    const afterPlayer = afterPlayers.get(seatIndex);
    if (!afterPlayer) continue;
    deltas[seatIndex] = toNumber(afterPlayer.stack) - toNumber(beforePlayer.stack);
  }
  return deltas;
}

function approxEqual(left, right, epsilon = EPSILON) {
  return Math.abs(Number(left) - Number(right)) <= epsilon;
}

function addError(errors, code, details = {}) {
  errors.push({ code, ...details });
}

export function validateHandEvIntegrity({
  beforeState = {},
  afterState = {},
  result = null,
  handHistory = null,
  variant = {},
  options = {},
} = {}) {
  const errors = [];
  const warnings = [];
  const resolvedResult = getResult(afterState, result, handHistory);
  const beforePlayers = getPlayers(beforeState);
  const afterPlayers = getPlayers(afterState);
  const seatLookup = getSeatLookup(afterState);
  const payouts = extractPayouts(resolvedResult);
  const pots = getPotDetails(resolvedResult);
  const payoutTotal = payouts.reduce((sum, payout) => sum + toNumber(payout.amount), 0);
  const potTotal = resultPotTotal(resolvedResult);
  const committedTotal = getCommittedTotal(beforeState);
  const beforeStackTotal = sumStacks(beforeState);
  const afterStackTotal = sumStacks(afterState);
  const afterLivePot = getLivePot(afterState);
  const stackDeltas = getStackDeltas(beforeState, afterState);

  [...beforePlayers, ...afterPlayers].forEach((player) => {
    if (!isFiniteNumber(player?.stack) || Number(player?.stack) < 0) {
      addError(errors, "invalid_stack", { playerId: player?.playerId ?? player?.id, stack: player?.stack });
    }
  });

  if (!resolvedResult && options.allowMissingResult !== true) {
    warnings.push({ code: "missing_result", message: "No terminal result was available for EV validation." });
  }

  if (resolvedResult && potTotal > 0 && payouts.length === 0) {
    addError(errors, "missing_payout", { potTotal });
  }

  if (resolvedResult && potTotal > 0 && !approxEqual(payoutTotal, potTotal, options.potEpsilon ?? EPSILON)) {
    addError(errors, "pot_payout_mismatch", { potTotal, payoutTotal });
  }

  const payoutKeys = new Set();
  for (const payout of payouts) {
    const seatIndex = getSeatFromPayout(payout, seatLookup);
    if (seatIndex == null) {
      addError(errors, "payout_missing_seat", { payout });
      continue;
    }
    if (!isFiniteNumber(payout.amount) || Number(payout.amount) < 0) {
      addError(errors, "invalid_payout_amount", { seatIndex, amount: payout.amount });
    }
    const player = seatLookup.get(seatIndex);
    if (!player) {
      addError(errors, "winner_missing_player", { seatIndex });
      continue;
    }
    if (isPlayerFolded(player)) addError(errors, "folded_player_winner", { seatIndex });
    if (isPlayerInactive(player)) addError(errors, "inactive_player_winner", { seatIndex });

    const pot = pots.find((entry) => entry.potIndex === payout.potIndex);
    if (pot?.eligibleSeatIndexes?.length && !pot.eligibleSeatIndexes.includes(seatIndex)) {
      addError(errors, "winner_not_pot_eligible", { seatIndex, potIndex: payout.potIndex });
    }

    const key = `${payout.potIndex ?? 0}:${payout.component ?? "main"}:${seatIndex}`;
    if (payoutKeys.has(key)) addError(errors, "duplicate_payout", { key });
    payoutKeys.add(key);
  }

  if (resolvedResult && pots.length > 1 && potTotal > 0 && committedTotal <= potTotal && options.allowSidePot === false) {
    addError(errors, "fake_side_pot", { potCount: pots.length, potTotal });
  }

  if (options.strictChipConservation) {
    const beforeTotal = beforeStackTotal + getLivePot(beforeState);
    const afterTotal = afterStackTotal + afterLivePot;
    if (!approxEqual(beforeTotal, afterTotal, options.chipEpsilon ?? EPSILON)) {
      addError(errors, "chip_conservation_mismatch", { beforeTotal, afterTotal });
    }
  } else if (beforePlayers.length && afterPlayers.length) {
    const expectedTerminalTotal = beforeStackTotal + getLivePot(beforeState);
    const actualTerminalTotal = afterStackTotal + (options.allowResultPotEcho ? 0 : afterLivePot);
    if (
      afterLivePot === 0 &&
      !approxEqual(expectedTerminalTotal, afterStackTotal, options.chipEpsilon ?? EPSILON)
    ) {
      warnings.push({
        code: "chip_conservation_ambiguous",
        expectedTerminalTotal,
        afterStackTotal,
      });
    } else if (afterLivePot > 0 && !approxEqual(expectedTerminalTotal, actualTerminalTotal, options.chipEpsilon ?? EPSILON)) {
      warnings.push({
        code: "chip_conservation_live_pot_present",
        expectedTerminalTotal,
        afterStackTotal,
        afterLivePot,
      });
    }
  }

  const rewards = getRewardMap({ result: resolvedResult ?? {}, handHistory: handHistory ?? {} });
  if (rewards) {
    let rewardSum = 0;
    for (const [seat, reward] of Object.entries(rewards)) {
      if (!Number.isFinite(Number(reward))) {
        addError(errors, "reward_not_finite", { seat, reward });
      }
      rewardSum += Number(reward);
      const stackDelta = stackDeltas[seat];
      if (stackDelta != null && Math.abs(Number(reward) - stackDelta) > (options.rewardDeltaEpsilon ?? 0.001)) {
        addError(errors, "reward_stack_delta_mismatch", { seat, reward, stackDelta });
      }
    }
    if (options.enforceZeroSumReward !== false && Math.abs(rewardSum) > (options.rewardSumEpsilon ?? 0.001)) {
      addError(errors, "reward_sum_not_zero", { rewardSum });
    }
  }

  if (Array.isArray(options.expectedWinnerSeatIndexes)) {
    const actual = new Set(payouts.map((payout) => getSeatFromPayout(payout, seatLookup)).filter((seat) => seat != null));
    const expected = new Set(options.expectedWinnerSeatIndexes);
    const missing = [...expected].filter((seat) => !actual.has(seat));
    const unexpected = [...actual].filter((seat) => !expected.has(seat));
    if (missing.length || unexpected.length) {
      addError(errors, "evaluator_winner_mismatch", { missing, unexpected, variantId: variant?.id ?? variant?.variantId });
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    metrics: {
      beforeStackTotal,
      afterStackTotal,
      beforeLivePot: getLivePot(beforeState),
      afterLivePot,
      committedTotal,
      potTotal,
      payoutTotal,
      payoutCount: payouts.length,
      potCount: pots.length,
      stackDeltas,
    },
    trace: {
      variantId: variant?.id ?? variant?.variantId ?? afterState.variantId ?? beforeState.variantId ?? "unknown",
      handId: resolvedResult?.handId ?? handHistory?.handId ?? afterState.handId ?? beforeState.handId ?? null,
      beforeStacks: beforePlayers.map((player, index) => ({
        seatIndex: getPlayerSeat(player, index),
        playerId: getPlayerId(player, index),
        stack: toNumber(player.stack),
      })),
      afterStacks: afterPlayers.map((player, index) => ({
        seatIndex: getPlayerSeat(player, index),
        playerId: getPlayerId(player, index),
        stack: toNumber(player.stack),
      })),
      pots,
      payouts,
      foldedSeats: afterPlayers.map((player, index) => (isPlayerFolded(player) ? getPlayerSeat(player, index) : null)).filter((seat) => seat != null),
      allInSeats: afterPlayers.map((player, index) => (player?.allIn ? getPlayerSeat(player, index) : null)).filter((seat) => seat != null),
    },
  };
}
