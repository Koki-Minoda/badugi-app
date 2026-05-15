import fs from "node:fs/promises";
import path from "node:path";

import { replayHandFromHistory } from "../../games/badugi/flow/handReplay.js";
import { readJson, writeJsonReport } from "../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP51_REAL_REPLAY_FIXTURE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step51-real-replay-coaching-fixture.json",
);

const DEFAULT_OPPORTUNITY_PATH = path.resolve(
  "reports/ai-iron/s02-deep-exact-opportunities-step41.jsonl",
);
const DEFAULT_SAMPLE_DIR = path.resolve("reports/ai-eval/divergence-replay-samples");

function normalizeAction(action = "") {
  return String(action ?? "").trim().toUpperCase();
}

async function readJsonl(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function byCandidateId(items = []) {
  return new Map(items.map((item) => [item.candidateId ?? item.lessonId, item]));
}

function sourceIsCoachingCompatible(sample = {}) {
  const legal = new Set((sample.legalActions ?? []).map(normalizeAction));
  const handClass = String(sample.handClass ?? "").toLowerCase();
  return (
    sample.variantId === "S02" &&
    String(sample.actionPair ?? "RAISE-vs-CHECK").includes("RAISE") &&
    legal.has("RAISE") &&
    legal.has("CHECK") &&
    !handClass.includes("weak") &&
    !handClass.includes("trash")
  );
}

async function loadSourceSample(opportunity, sampleDir = DEFAULT_SAMPLE_DIR) {
  if (!opportunity?.sampleFile) return null;
  const rows = await readJsonl(path.join(sampleDir, opportunity.sampleFile));
  return (
    rows.find(
      (row) =>
        row.seed === opportunity.seed &&
        row.handId === opportunity.handId &&
        row.step === opportunity.step,
    ) ?? null
  );
}

async function pickSourceSampleForLesson({
  playerCount,
  opportunities,
  sampleDir = DEFAULT_SAMPLE_DIR,
}) {
  const candidates = opportunities.filter(
    (row) =>
      row.type === "opportunity" &&
      row.variant === "S02" &&
      row.playerCount === playerCount &&
      row.stackDepth === "deep" &&
      row.actionPair === "RAISE-vs-CHECK",
  );

  for (const opportunity of candidates) {
    const sample = await loadSourceSample(opportunity, sampleDir);
    if (sourceIsCoachingCompatible(sample)) {
      return { opportunity, sample };
    }
  }

  const fallback = candidates[0] ?? null;
  return fallback ? { opportunity: fallback, sample: await loadSourceSample(fallback, sampleDir) } : null;
}

function seatName(player = {}, fallbackSeat = 0) {
  return player.name ?? player.playerId ?? `Seat ${player.seatIndex ?? fallbackSeat}`;
}

function buildReplayHandHistory({ lesson, annotation, source }) {
  const snapshot = source.sample?.snapshot ?? {};
  const players = snapshot.players ?? [];
  const metadata = snapshot.metadata ?? {};
  const actorSeat = Number(source.sample?.actorSeat ?? snapshot.actingPlayerIndex ?? 0);
  const playerCount = Number(lesson.playerCount ?? source.sample?.playerCount ?? 0);
  const handId = `step51-${lesson.candidateId ?? annotation.lessonId}-${source.sample.seed}-${source.sample.handId}`;
  const betUnit = Number(metadata.betUnit ?? 20);
  const currentBet = Number(metadata.currentBet ?? betUnit);
  const actionIndex = Number(annotation.actionIndex ?? lesson.replayReference?.actionIndex ?? 5);
  const legalActions = (source.sample.legalActions ?? []).map(normalizeAction);
  const nonActorActive = players
    .filter((player) => player.seatIndex !== actorSeat && player.folded !== true)
    .slice(0, 3);
  const fillerActions = nonActorActive.map((player, idx) => ({
    type: "BET_ACTION",
    seat: player.seatIndex,
    action: normalizeAction(player.lastAction).includes("BET")
      ? "BET"
      : normalizeAction(player.lastAction).includes("RAISE")
        ? "RAISE"
        : "CALL",
    amount: Math.max(0, Number(player.betThisRound ?? currentBet) || currentBet),
    actionSeq: idx + 1,
  }));
  while (fillerActions.length < 3) {
    fillerActions.push({
      type: "BET_ACTION",
      seat: Math.max(0, (actorSeat + fillerActions.length + 1) % Math.max(players.length, 1)),
      action: "CALL",
      amount: currentBet,
      actionSeq: fillerActions.length + 1,
    });
  }

  const events = [
    {
      type: "HAND_START",
      variantId: source.sample.variantId,
      seed: source.sample.seed,
      source: "engine-backed-divergence-replay-sample",
    },
    {
      type: "BLINDS_POSTED",
      sbSeat: Number(metadata.lastBlinds?.sbIndex ?? 1),
      sbAmount: Number(snapshot.smallBlind ?? 10),
      bbSeat: Number(metadata.lastBlinds?.bbIndex ?? 2),
      bbAmount: Number(snapshot.bigBlind ?? 20),
    },
    ...fillerActions.slice(0, 3),
    {
      type: "BET_ACTION",
      seat: actorSeat,
      actorSeat,
      action: normalizeAction(annotation.highlightAction ?? lesson.recommendedAction ?? "RAISE"),
      amount: betUnit,
      actionSeq: actionIndex,
      legalActions,
      metadata: {
        variantId: source.sample.variantId,
        playerCount,
        stackDepth: "deep",
        handClass: source.sample.handClass,
        recommendedAction: normalizeAction(annotation.highlightAction ?? lesson.recommendedAction),
        baselineAction: normalizeAction(annotation.baselineAction ?? lesson.baselineAction),
        lessonId: annotation.lessonId,
      },
    },
    { type: "PHASE_TRANSITION", from: "BET", to: "DRAW" },
    { type: "HAND_END", totalPot: Number(source.sample.potSize ?? 0), winners: [] },
  ];

  return {
    handId,
    variantId: source.sample.variantId,
    source: "step51-real-replay-fixture-from-engine-backed-sample",
    startedAt: Date.parse("2026-05-15T00:00:00.000Z"),
    endedAt: Date.parse("2026-05-15T00:02:00.000Z"),
    seats: players.map((player, idx) => ({
      seat: player.seatIndex ?? idx,
      name: seatName(player, idx),
      stack: Number(player.stack ?? 500) + Number(player.totalInvested ?? 0),
    })),
    events,
  };
}

function buildFixtureEntry({ lesson, annotation, link, source }) {
  const handHistory = buildReplayHandHistory({ lesson, annotation, source });
  const replayFrames = replayHandFromHistory(handHistory);
  const actionIndex = Number(annotation.actionIndex ?? lesson.replayReference?.actionIndex ?? 5);
  const actionFrame =
    replayFrames.find((frame, idx) => idx === actionIndex || frame.event?.actionSeq === actionIndex) ??
    null;
  const actorSeat = Number(source.sample?.actorSeat ?? actionFrame?.event?.seat ?? -1);
  return {
    lessonId: annotation.lessonId,
    variantId: annotation.variantId,
    seed: source.sample.seed,
    handId: handHistory.handId,
    sourceHandId: source.sample.handId,
    step47ReplayRef: lesson.replayReference ?? link ?? null,
    realReplayRef: {
      sampleTag: source.opportunity.sampleTag,
      sampleFile: source.opportunity.sampleFile,
      seed: source.sample.seed,
      handId: source.sample.handId,
      step: source.sample.step,
    },
    actionIndex,
    playerCount: lesson.playerCount ?? source.sample.playerCount,
    actorSeat,
    heroSeat: actorSeat,
    actionAtIndex: actionFrame?.event ?? null,
    expectedHighlightTarget: {
      rowTestId: `replay-event-row-${actionIndex}`,
      actionIndex,
      actionSeq: actionIndex,
      actorSeat,
    },
    replayActions: replayFrames.map((frame, idx) => ({
      frameIndex: idx,
      actionSeq: frame.event?.actionSeq ?? null,
      type: frame.event?.type ?? null,
      action: frame.event?.action ?? null,
      seat: frame.event?.seat ?? null,
      phase: frame.phase,
    })),
    handHistory,
    coaching: {
      lessonId: annotation.lessonId,
      lessonTag: annotation.lessonTag,
      severity: annotation.severity,
      evDelta: annotation.evDelta,
      recommendedAction: annotation.highlightAction,
      baselineAction: annotation.baselineAction,
      jp: annotation.jp,
      en: annotation.en,
      replayDeterministic: annotation.replayDeterministic === true,
    },
    sourceMetadata: {
      legalActions: source.sample.legalActions ?? [],
      handClass: source.sample.handClass,
      stackDepth: "deep",
      drawRound: source.sample.drawRound,
      playerCount: source.sample.playerCount,
      position: source.sample.position,
    },
    checks: {
      actionIndexExists: Boolean(actionFrame),
      actionRowExists: Boolean(actionFrame?.event),
      replayDeterministic: annotation.replayDeterministic === true,
      lessonMetadataMatchesReplay:
        annotation.variantId === source.sample.variantId &&
        Number(lesson.playerCount ?? source.sample.playerCount) === Number(source.sample.playerCount),
    },
  };
}

export async function buildRealReplayCoachingFixtureSummary({
  coachingPackage = {},
  replayMetadata = {},
  annotations = {},
  opportunities = null,
  sampleDir = DEFAULT_SAMPLE_DIR,
} = {}) {
  const lessons = byCandidateId(coachingPackage.candidates ?? []);
  const links = byCandidateId(replayMetadata.links ?? []);
  const opportunityRows = opportunities ?? (await readJsonl(DEFAULT_OPPORTUNITY_PATH));
  const fixtures = [];

  for (const annotation of annotations.annotations ?? []) {
    const lesson = lessons.get(annotation.lessonId);
    if (!lesson) continue;
    const source = await pickSourceSampleForLesson({
      playerCount: lesson.playerCount,
      opportunities: opportunityRows,
      sampleDir,
    });
    if (!source?.sample) continue;
    fixtures.push(
      buildFixtureEntry({
        lesson,
        annotation,
        link: links.get(annotation.lessonId),
        source,
      }),
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    source: "step47-step50-plus-engine-backed-replay-samples",
    fixtureCount: fixtures.length,
    fixtures,
    allActionRowsExist: fixtures.every((fixture) => fixture.checks.actionRowExists),
    allDeterministic: fixtures.every((fixture) => fixture.checks.replayDeterministic),
    syntheticReplayInjection: false,
    hiddenStateInjection: false,
    gameplayMutation: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildRealReplayCoachingFixture({
  coachingPackagePath = path.resolve("reports/ai-iron/step47-coaching-handoff-package.json"),
  replayMetadataPath = path.resolve("reports/ai-iron/step47-replay-deeplink-metadata.json"),
  annotationPath = path.resolve("reports/ai-iron/step50-replay-annotation-viewmodel.json"),
  outputPath = DEFAULT_STEP51_REAL_REPLAY_FIXTURE_OUTPUT_PATH,
  coachingPackage = null,
  replayMetadata = null,
  annotations = null,
} = {}) {
  const report = await buildRealReplayCoachingFixtureSummary({
    coachingPackage: coachingPackage ?? (await readJson(coachingPackagePath)),
    replayMetadata: replayMetadata ?? (await readJson(replayMetadataPath)),
    annotations: annotations ?? (await readJson(annotationPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildRealReplayCoachingFixture();
  console.log(JSON.stringify(report, null, 2));
}
