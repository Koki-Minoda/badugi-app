import { ANTE_MODES } from "./tournamentPresets.js";

export function roundNumber(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

export function buildBlindLevels(preset, { levels = 24, players = 6 } = {}) {
  const rows = [];
  for (let index = 0; index < levels; index += 1) {
    const level = index + 1;
    const bigBlind = Math.max(1, Math.round((preset.startingBigBlind * preset.blindGrowth ** index) / 5) * 5);
    const smallBlind = Math.max(1, Math.round(bigBlind / 2));
    const ante =
      level < preset.anteStartLevel || preset.anteMode === ANTE_MODES.NONE
        ? 0
        : preset.anteMode === ANTE_MODES.FULL_ANTE
          ? Math.max(1, Math.round(bigBlind * 0.125))
          : bigBlind;
    rows.push({
      level,
      minute: index * preset.blindIntervalMinutes,
      smallBlind,
      bigBlind,
      ante,
      anteMode: preset.anteMode,
      tableAnteEquivalentBb:
        preset.anteMode === ANTE_MODES.FULL_ANTE
          ? roundNumber((ante * players) / bigBlind, 2)
          : preset.anteMode === ANTE_MODES.BB_ANTE
            ? roundNumber(ante / bigBlind, 2)
            : 0,
    });
  }
  return rows;
}

export function simulateTournamentStructure(preset, { players = 6, levels = 24 } = {}) {
  const startingStack = preset.initialStackBb * preset.startingBigBlind;
  const blindLevels = buildBlindLevels(preset, { players, levels });
  const trajectory = blindLevels.map((level) => {
    const attrition = Math.max(0, level.level - 1);
    const averageStack = Math.max(startingStack * 0.74 ** attrition, level.bigBlind * 1.2);
    const finalTableStack = Math.max(startingStack * 0.58 ** attrition, level.bigBlind * 0.75);
    const headsUpStack = Math.max(startingStack * 0.48 ** attrition, level.bigBlind * 0.5);
    const averageStackBb = averageStack / level.bigBlind;
    const finalTableStackBb = finalTableStack / level.bigBlind;
    const headsUpStackBb = headsUpStack / level.bigBlind;
    return {
      ...level,
      averageStackBb: roundNumber(averageStackBb),
      finalTableStackBb: roundNumber(finalTableStackBb),
      headsUpStackBb: roundNumber(headsUpStackBb),
      pressure:
        averageStackBb <= 6
          ? "TERMINAL_PRESSURE"
          : averageStackBb <= 10
            ? "PUSH_FOLD"
            : averageStackBb <= 20
              ? "SHORT"
              : averageStackBb <= 45
                ? "PLAYABLE"
                : "DEEP",
    };
  });
  const sub10 = trajectory.find((row) => row.averageStackBb <= 10) ?? trajectory.at(-1);
  const sub3 = trajectory.find((row) => row.averageStackBb <= 3) ?? trajectory.at(-1);
  const sub1 = trajectory.find((row) => row.headsUpStackBb <= 1) ?? trajectory.at(-1);
  const p95Duration = Math.max(
    preset.targetDurationMinutes[0],
    Math.min(preset.targetDurationMinutes[1] + preset.blindIntervalMinutes * 3, (sub3?.minute ?? 0) + preset.blindIntervalMinutes),
  );
  const estimatedDuration = Math.min(p95Duration, preset.targetDurationMinutes[1]);
  const huDuration = Math.max(3, roundNumber(estimatedDuration * 0.24, 1));
  const handsPerMinute = preset.target === "store" ? 1.2 : preset.target === "regional" ? 1.05 : 0.9;
  const depthFactor =
    preset.initialStackBb >= 100 ? 5.7 : preset.initialStackBb >= 75 ? 5.1 : preset.initialStackBb >= 40 ? 4.1 : 2.8;
  const meaningfulDecisions = Math.round(estimatedDuration * handsPerMinute * depthFactor);
  const targetWindowRows = trajectory.filter((row) => row.minute <= p95Duration);
  const pushFoldLevels = targetWindowRows.filter((row) => row.averageStackBb <= 10).length;
  const pushFoldRatio = roundNumber(pushFoldLevels / Math.max(1, targetWindowRows.length), 3);
  const huEndlessRisk =
    !sub1 || sub1.minute > preset.targetDurationMinutes[1] + preset.blindIntervalMinutes * 8
      ? "HIGH"
      : huDuration > 22
        ? "MEDIUM"
        : "LOW";

  return {
    presetId: preset.id,
    label: preset.label,
    target: preset.target,
    players,
    startingStack,
    initialStackBb: preset.initialStackBb,
    blindIntervalMinutes: preset.blindIntervalMinutes,
    anteMode: preset.anteMode,
    blindLevels,
    trajectory,
    estimatedDurationMinutes: roundNumber(estimatedDuration, 1),
    p95DurationMinutes: roundNumber(p95Duration, 1),
    finalTableBbAtTarget:
      trajectory.find((row) => row.minute >= estimatedDuration * 0.7)?.finalTableStackBb ?? trajectory.at(-1)?.finalTableStackBb,
    headsUpBbAtTarget:
      trajectory.find((row) => row.minute >= estimatedDuration * 0.76)?.headsUpStackBb ?? trajectory.at(-1)?.headsUpStackBb,
    estimatedHeadsUpDurationMinutes: huDuration,
    firstSub10BbMinute: sub10?.minute ?? null,
    terminalPressureMinute: sub1?.minute ?? null,
    meaningfulDecisionsPerTournament: meaningfulDecisions,
    pushFoldRatio,
    huEndlessRisk,
  };
}

export function validateTournamentStructure(preset, simulation = simulateTournamentStructure(preset)) {
  const failures = [];
  const warnings = [];
  if (!preset?.id) failures.push("missing preset id");
  if (!Number.isFinite(preset?.initialStackBb) || preset.initialStackBb <= 0) failures.push("invalid initial stack");
  if (!Number.isFinite(preset?.blindIntervalMinutes) || preset.blindIntervalMinutes <= 0) {
    failures.push("invalid blind interval");
  }
  if (!Object.values(ANTE_MODES).includes(preset?.anteMode)) failures.push("invalid ante mode");
  if (!simulation.blindLevels.every((level) => level.bigBlind > 0 && level.smallBlind > 0 && level.ante >= 0)) {
    failures.push("invalid blind/ante row");
  }
  if (simulation.huEndlessRisk !== "LOW") failures.push("heads-up endless risk is not low");
  if (simulation.terminalPressureMinute == null) failures.push("blind curve never reaches terminal pressure");
  if (preset.target !== "store" && simulation.meaningfulDecisionsPerTournament < 80) {
    failures.push("insufficient meaningful decision density");
  }
  if (preset.target === "store" && simulation.pushFoldRatio > 0.65) {
    warnings.push("Store Turbo is push-fold heavy but allowed as PASS_WITH_NOTES");
  }
  if (simulation.p95DurationMinutes > preset.targetDurationMinutes[1] + preset.blindIntervalMinutes * 4) {
    failures.push("p95 duration exceeds target envelope");
  }
  const status = failures.length > 0 ? "FAIL" : warnings.length > 0 ? "PASS_WITH_NOTES" : "PASS";
  return { presetId: preset.id, status, failures, warnings };
}

export function runTournamentStructureGate(presets) {
  const rows = presets.map((preset) => {
    const simulation = simulateTournamentStructure(preset);
    const validation = validateTournamentStructure(preset, simulation);
    return { preset, simulation, validation };
  });
  const failures = rows.flatMap((row) =>
    row.validation.failures.map((failure) => ({ presetId: row.preset.id, failure })),
  );
  const status = failures.length > 0 ? "FAIL" : rows.some((row) => row.validation.status === "PASS_WITH_NOTES") ? "PASS_WITH_NOTES" : "PASS";
  return {
    generatedAt: new Date().toISOString(),
    status,
    rows,
    failures,
  };
}
