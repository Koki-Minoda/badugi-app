import fs from "node:fs";
import path from "node:path";
const root =
  process.argv[2] ?? "reports/mobile-performance/production-baseline";
function stats(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const percentile = (p) =>
    sorted.length
      ? Math.round(
          sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)] * 100,
        ) / 100
      : null;
  return {
    n: sorted.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    max: sorted.length ? Math.round(sorted.at(-1) * 100) / 100 : null,
  };
}
const criteria = {
  heroResponseP95Ms: 100,
  cpuTurnP95Ms: 2000,
  eventLoopMaxMs: 250,
  transitionMs: 2000,
  repeatRatio: 2,
  repeatDeltaMs: {
    "hero-response": 100,
    "cpu-turn": 500,
    "event-loop": 50,
    "storage-write": 10,
  },
};
const projects = [];
for (const project of fs.readdirSync(root)) {
  const file = path.join(root, project, "measurements.jsonl");
  if (!fs.existsSync(file)) continue;
  const rows = fs
    .readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const probes = rows.filter((row) => row.kind === "probe");
  const fixtureProbes = new Set();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].kind !== "history-fixture") continue;
    const nextProbe = rows.slice(i + 1).find((row) => row.kind === "probe");
    if (nextProbe) fixtureProbes.add(nextProbe);
  }
  const stages = [];
  for (const leg of [...new Set(probes.map((row) => row.leg))]) {
    const group = probes.filter((row) => row.leg === leg);
    const cycles = group.map((row) => {
      const metrics = {};
      for (const kind of [
        "hero-response",
        "cpu-turn",
        "event-loop",
        "long-task",
        "frame-gap",
        "storage-write",
      ])
        metrics[kind] = stats(
          row.samples.filter((s) => s.kind === kind).map((s) => s.ms),
        );
      return {
        cycle: row.cycle,
        includesSyntheticHistorySetup: fixtureProbes.has(row),
        metrics,
        probeVersion: row.probeVersion ?? 1,
        consoleCalls: row.console,
        heapBytes: row.heapBytes,
        cpuTraceEntries: row.cpuTraceEntries,
      };
    });
    const comparable = cycles.filter(
      (row) => row.cycle >= 0 && !row.includesSyntheticHistorySetup,
    );
    const early = comparable[0],
      late = comparable.at(-1);
    const changes = {};
    if (early && late && early !== late) {
      for (const kind of [
        "hero-response",
        "cpu-turn",
        "event-loop",
        "storage-write",
      ]) {
        const before = early.metrics[kind].p95,
          after = late.metrics[kind].p95;
        changes[kind] = {
          earlyP95: before,
          lateP95: after,
          deltaMs:
            before != null && after != null
              ? Math.round((after - before) * 100) / 100
              : null,
          ratio:
            before > 0 && after != null
              ? Math.round((after / before) * 100) / 100
              : null,
        };
      }
    }
    stages.push({ leg, cycles, changes });
  }
  const transitions = [];
  for (const name of [
    ...new Set(
      rows.filter((row) => row.kind === "transition").map((row) => row.name),
    ),
  ]) {
    const values = rows.filter(
      (row) => row.kind === "transition" && row.name === name,
    );
    transitions.push({
      name,
      stats: stats(values.map((row) => row.ms)),
      samples: values.map(({ cycle, ms }) => ({
        cycle,
        ms: Math.round(ms * 100) / 100,
      })),
    });
  }
  const storage = [];
  const writes = probes.flatMap((row) =>
    row.samples.filter((sample) => sample.kind === "storage-write"),
  );
  for (const key of [...new Set(writes.map((row) => row.key))]) {
    const values = writes.filter((row) => row.key === key);
    storage.push({
      key,
      timing: stats(values.map((row) => row.ms)),
      maxBytes: Math.max(...values.map((row) => row.bytes ?? 0)),
      totalMs:
        Math.round(values.reduce((sum, row) => sum + row.ms, 0) * 100) / 100,
    });
  }
  const allSamples = probes.flatMap((row) => row.samples);
  projects.push({
    project,
    physicalDevice: rows.some((row) => row.kind === "physical-device"),
    failures: rows.filter((row) => row.kind === "failure"),
    completedHands: rows.filter((row) => row.kind === "hand").length,
    pageErrors: rows.filter((row) => row.kind === "page-error"),
    heroResponseTimeouts: allSamples.filter(
      (row) => row.kind === "hero-response-timeout",
    ),
    stages,
    transitions,
    storage: storage.sort((a, b) => b.totalMs - a.totalMs),
    diagnosticBuffer:
      rows.find((row) => row.kind === "diagnostic-buffer") ?? null,
  });
}
const flags = [];
for (const project of projects) {
  for (const stage of project.stages) {
    for (const cycle of stage.cycles) {
      if (cycle.cycle < 0) continue;
      for (const [kind, limit] of [
        ["hero-response", criteria.heroResponseP95Ms],
        ["cpu-turn", criteria.cpuTurnP95Ms],
      ]) {
        const value = cycle.metrics[kind].p95;
        if (value > limit)
          flags.push({
            project: project.project,
            leg: stage.leg,
            cycle: cycle.cycle,
            kind,
            value,
            limit,
          });
      }
      if (
        !cycle.includesSyntheticHistorySetup &&
        cycle.metrics["event-loop"].max > criteria.eventLoopMaxMs
      )
        flags.push({
          project: project.project,
          leg: stage.leg,
          cycle: cycle.cycle,
          kind: "event-loop-max",
          value: cycle.metrics["event-loop"].max,
        });
    }
    for (const [kind, change] of Object.entries(stage.changes))
      if (
        change.ratio > criteria.repeatRatio &&
        change.deltaMs > criteria.repeatDeltaMs[kind]
      )
        flags.push({
          project: project.project,
          leg: stage.leg,
          kind: "repeated-" + kind,
          ...change,
        });
  }
  for (const transition of project.transitions)
    for (const sample of transition.samples)
      if (sample.ms > criteria.transitionMs)
        flags.push({
          project: project.project,
          kind: "transition",
          name: transition.name,
          ...sample,
        });
}
const report = {
  criteria,
  flags,
  generatedAt: new Date().toISOString(),
  root,
  units: "milliseconds unless named otherwise",
  notes: [
    "Thresholds are investigation heuristics, not approved release requirements.",
    "physicalDevice identifies hardware runs; other projects use host CPU mobile emulation.",
    "Physical runs use scripted DOM button activation and do not measure physical touch input latency.",
    "Samples marked includesSyntheticHistorySetup contain artificial quota-fill work; event-loop maxima and early/late comparisons exclude these samples from game-lag attribution. Raw metrics remain available.",
    "CPU turn time includes intentional pause and render transition; it is not model inference latency.",
    "First cold hand and reload hand are separate from repeated-cycle comparisons.",
    "Transitions include UI automation dispatch, while hero-response is browser click to first observed state change.",
    "performance.memory is browser-dependent and may be quantized.",
  ],
  projects,
};
fs.writeFileSync(
  path.join(root, "summary.json"),
  JSON.stringify(report, null, 2) + "\n",
);
for (const project of projects) {
  console.log(
    project.project,
    project.completedHands,
    "hands",
    "errors",
    project.pageErrors.length,
  );
  for (const stage of project.stages) {
    if (Object.keys(stage.changes).length)
      console.log(stage.leg, JSON.stringify(stage.changes));
  }
  console.log("buffer", JSON.stringify(project.diagnosticBuffer));
}

console.log("Investigation flags", JSON.stringify(flags));
