#!/usr/bin/env node
// Offline M2 only. Returns the designated hero's opening cards for seed-screen
// audit even when no legal FOLD/CALL/RAISE decision occurs. Never route this
// audit field to an inference observation or a published model.
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const source = fileURLToPath(new URL('../src/rl/badugiControllerBeliefInteractiveV3Draft.js', import.meta.url));
const temporary = join(tmpdir(), `mgx-d03-entry-m2-${randomUUID()}.mjs`);
let InteractiveSession;
try {
  await build({ entryPoints: [source], bundle: true, platform: 'node',
    format: 'esm', outfile: temporary, logLevel: 'silent' });
  process.env.NODE_ENV = 'production';
  ({ BadugiControllerBeliefInteractiveV3Draft: InteractiveSession } =
    await import(pathToFileURL(temporary).href));
} finally {
  rmSync(temporary, { force: true });
}

function openingAudit(session, heroSeat) {
  if (!Number.isInteger(heroSeat) || heroSeat < 0 || heroSeat >= session.occupiedSeatCount ||
      session.handIndex !== 0) {
    throw new TypeError('M2 audit requires the designated occupied hero and first hand');
  }
  const snapshot = session.controller.getUiSnapshot(session.state);
  const occupied = snapshot.players.slice(0, session.occupiedSeatCount);
  const cards = occupied.map((player) => player.hand);
  if (cards.some((hand) => !Array.isArray(hand) || hand.length !== 4) ||
      new Set(cards.flat()).size !== 4 * session.occupiedSeatCount) {
    throw new TypeError('M2 opening deal lacks four unique cards per occupied seat');
  }
  return { auditHeroSeat: heroSeat, auditOpeningHeroCards: [...cards[heroSeat]],
    auditOpeningHandIndex: session.handIndex };
}

function actorVisibleAudit(session, decision) {
  const snapshot = session.controller.getUiSnapshot(session.state);
  const player = snapshot.players[decision.seat];
  if (!player || !Array.isArray(player.hand) || player.hand.length !== 4) {
    throw new TypeError('M2 actor hand unavailable');
  }
  const dealerSeat = snapshot.dealerIdx ?? snapshot.dealerSeat ?? snapshot.metadata?.dealerIdx;
  if (!Number.isInteger(dealerSeat)) throw new TypeError('M2 dealer seat unavailable');
  const currentBet = snapshot.currentBet ?? snapshot.metadata?.currentBet ?? 0;
  const toCallChips = Math.max(0, currentBet - player.betThisRound);
  const unit = decision.drawRoundIndex >= 2 ? 2 * decision.activeBigBlind : decision.activeBigBlind;
  const legalAmountsChips = decision.legalMask.map((allowed, action) => {
    if (!allowed) return null;
    if (decision.phase === 'DRAW' || action === 0 || action === 1) return 0;
    if (action === 2) return Math.min(player.stack, toCallChips);
    if (action === 3 || action === 4) return toCallChips + unit;
    return null;
  });
  return { actorCurrentCards: [...player.hand], dealerSeat, legalAmountsChips,
    actorStackChips: player.stack, toCallChips, currentBetChips: currentBet,
    actorBetThisRoundChips: player.betThisRound };
}

let session = null;
let resetRequest = null;
let actionLog = [];

function actualLegalAmounts() {
  const current = session.currentDecision();
  if (current.phase !== 'BET') throw new TypeError('M2 amount audit requires BET');
  const actions = [0, 2, 4].filter((index) => current.legalMask[index] === 1);
  const amounts = {};
  for (const index of actions) {
    const replay = new InteractiveSession(resetRequest);
    replay.nextHand();
    for (const action of actionLog) replay.step(action);
    const before = replay.currentDecision();
    if (before.seat !== current.seat || before.phase !== current.phase ||
        before.drawRoundIndex !== current.drawRoundIndex ||
        before.decisionIndex !== current.decisionIndex || before.legalMask[index] !== 1) {
      throw new TypeError('M2 amount audit replay diverged before action');
    }
    replay.step(index);
    const event = replay.publicEvents.at(-1);
    if (event?.type !== 'BET_ACTION' || event.seat !== current.seat ||
        !Number.isFinite(event.amount) || event.amount < 0) {
      throw new TypeError('M2 amount audit lacks actual controller contribution');
    }
    amounts[index] = event.amount;
  }
  return { type: 'amount_audit', seat: current.seat,
    decisionIndex: current.decisionIndex, actualAmountsChips: amounts };
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  try {
    const request = JSON.parse(line);
    let response;
    if (request.command === 'reset') {
      session = new InteractiveSession(request);
      resetRequest = request;
      actionLog = [];
      response = session.nextHand();
      if (response.type !== 'decision') throw new TypeError('M2 requires a first-hand decision');
      const audit = openingAudit(session, request.heroSeat);
      response = { ...response, ...audit };
    } else if (request.command === 'step' && session) {
      response = session.step(request.actionIndex);
      actionLog.push(request.actionIndex);
    } else if (request.command === 'audit_legal_amounts' && session) {
      response = actualLegalAmounts();
    } else {
      throw new TypeError('M2 bridge expects reset or step in an active first hand');
    }
    if (response.type === 'decision') {
      response = { ...response, auditActorVisible: actorVisibleAudit(session, response) };
    }
    process.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ type: 'error', message: String(error?.message ?? error) })}\n`);
  }
}
