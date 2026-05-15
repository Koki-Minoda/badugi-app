import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_REPORT_PATHS = [
  path.resolve("reports/ai-eval/pro-vs-standard-20260506.json"),
  path.resolve("reports/ai-eval/pro-vs-standard-20260507.json"),
  path.resolve("reports/ai-eval/pro-vs-standard-20260508.json"),
];

const DEFAULT_OUTPUT_PATH = path.resolve("docs/ai/MGX_PRO_STEP4C_EV_ACTION_ATTRIBUTION.md");

function formatValue(value) {
  return typeof value === "number" ? value.toFixed(1) : "-";
}

function inferActionLeakRows(variantId, result = {}) {
  const rows = [];
  const fallbackSamples = result.analysis?.fallbackSamples ?? [];
  const patMistakes = result.analysis?.patMistakeSamples ?? [];
  const losses = result.analysis?.lossSamples ?? [];

  const addRow = ({ actionType, leakType, count, evImpact, exampleTrace, suggestedFix }) => {
    if (!count) return;
    rows.push({
      variantId,
      actionType,
      leakType,
      count,
      evImpact,
      exampleTrace,
      suggestedFix,
    });
  };

  const checkFallbacks = fallbackSamples.filter((sample) => sample.phase === "BET" && sample.actionType === "CHECK");
  addRow({
    actionType: "CHECK",
    leakType: "CHECK missed value",
    count: checkFallbacks.length,
    evImpact: checkFallbacks.length * 5,
    exampleTrace: checkFallbacks[0]?.reason ?? "-",
    suggestedFix: "Value-bet smooth made lows and medium made Badugi hands more often on unopened final streets.",
  });

  const callFallbacks = fallbackSamples.filter((sample) => sample.phase === "BET" && sample.actionType === "CALL");
  addRow({
    actionType: "CALL",
    leakType: "CALL losing call",
    count: callFallbacks.length,
    evImpact: callFallbacks.length * 6,
    exampleTrace: callFallbacks[0]?.reason ?? "-",
    suggestedFix: "Tighten facing-bet defense for rough lows, paired finals, and weak 3-card Badugi holdings.",
  });

  const foldishLosses = losses.filter((sample) => {
    const high = Number(sample?.handSummary?.highestRank ?? sample?.handSummary?.kicker ?? 99);
    return high <= (["D02", "S02"].includes(variantId) ? 6 : 7);
  });
  addRow({
    actionType: "FOLD",
    leakType: "FOLD missed showdown",
    count: foldishLosses.length,
    evImpact: foldishLosses.reduce((sum, sample) => sum + Math.abs(Number(sample.delta ?? 0)), 0),
    exampleTrace: foldishLosses[0]?.handSummary?.hand?.join(" ") ?? "-",
    suggestedFix: "Keep premium made lows and strong Badugi hands on value/call rails instead of over-folding.",
  });

  const raisePatMistakes = patMistakes.filter((sample) => sample.recklessRaise > 0);
  addRow({
    actionType: "RAISE",
    leakType: "RAISE reckless raise",
    count: raisePatMistakes.length,
    evImpact: raisePatMistakes.length * 10,
    exampleTrace: raisePatMistakes[0]?.reason ?? "-",
    suggestedFix: "Remove final-street raises from rough lows and weak made Badugi hands.",
  });

  const drawMistakes = patMistakes.filter((sample) => sample.drawMistake > 0);
  addRow({
    actionType: "DRAW",
    leakType: "DRAW bad discard",
    count: drawMistakes.length,
    evImpact: drawMistakes.length * 10,
    exampleTrace: drawMistakes[0]?.handSummary?.hand?.join(" ") ?? "-",
    suggestedFix: "Refine pat/draw thresholds for completed lows and made Badugi hands before the last draw.",
  });

  const weakPatLosses = losses.filter((sample) => {
    const high = Number(sample?.handSummary?.highestRank ?? sample?.handSummary?.kicker ?? 99);
    const category = String(sample?.handSummary?.category ?? "");
    return high >= (["D02", "S02"].includes(variantId) ? 8 : 9) || ["onePair", "twoPair"].includes(category);
  });
  addRow({
    actionType: "PAT",
    leakType: "PAT too weak",
    count: weakPatLosses.length,
    evImpact: weakPatLosses.reduce((sum, sample) => sum + Math.abs(Number(sample.delta ?? 0)), 0),
    exampleTrace: weakPatLosses[0]?.handSummary?.hand?.join(" ") ?? "-",
    suggestedFix: "Do not lock in rough or paired finals too aggressively; keep weak pat hands on check/fold paths.",
  });

  const strongPatLosses = foldishLosses.filter((sample) => sample.winner === false);
  addRow({
    actionType: "PAT",
    leakType: "PAT too passive",
    count: strongPatLosses.length,
    evImpact: strongPatLosses.reduce((sum, sample) => sum + Math.abs(Number(sample.delta ?? 0)), 0),
    exampleTrace: strongPatLosses[0]?.handSummary?.hand?.join(" ") ?? "-",
    suggestedFix: "Increase value betting for smooth completed lows and stronger made Badugi hands after the final draw.",
  });

  const finalStreetLeaks = fallbackSamples.filter((sample) => sample.phase === "BET" && sample.drawRoundIndex >= (variantId.startsWith("S") ? 1 : 3));
  addRow({
    actionType: "BET/CALL",
    leakType: "final street leak",
    count: finalStreetLeaks.length,
    evImpact: finalStreetLeaks.length * 5,
    exampleTrace: finalStreetLeaks[0]?.reason ?? "-",
    suggestedFix: "Rebalance final-street bet/check/call thresholds so Pro realizes more value without reviving spew.",
  });

  const facingBetLeaks = fallbackSamples.filter((sample) => sample.phase === "BET" && ["CALL", "FOLD"].includes(sample.actionType));
  addRow({
    actionType: "CALL/FOLD",
    leakType: "facing bet leak",
    count: facingBetLeaks.length,
    evImpact: facingBetLeaks.length * 5,
    exampleTrace: facingBetLeaks[0]?.reason ?? "-",
    suggestedFix: "Separate premium bluff-catch calls from rough-low folds when facing late action.",
  });

  return rows;
}

export async function analyzeStep4cActionAttribution({
  reportPaths = DEFAULT_REPORT_PATHS,
  outputPath = DEFAULT_OUTPUT_PATH,
} = {}) {
  const aggregate = new Map();
  const variantCoverage = new Set();
  for (const reportPath of reportPaths) {
    const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
    for (const [variantId, result] of Object.entries(report.variants ?? {})) {
      variantCoverage.add(variantId);
      for (const row of inferActionLeakRows(variantId, result)) {
        const key = `${row.variantId}::${row.actionType}::${row.leakType}`;
        const current = aggregate.get(key) ?? {
          ...row,
          count: 0,
          evImpact: 0,
        };
        current.count += row.count;
        current.evImpact += row.evImpact;
        if (!current.exampleTrace || current.exampleTrace === "-") {
          current.exampleTrace = row.exampleTrace;
        }
        aggregate.set(key, current);
      }
    }
  }

  const rows = [...aggregate.values()];
  for (const variantId of variantCoverage) {
    if (!rows.some((row) => row.variantId === variantId)) {
      rows.push({
        variantId,
        actionType: "BET",
        leakType: "BET missed value",
        count: 0,
        evImpact: 0,
        exampleTrace: "no dominant Step4-C leak sample",
        suggestedFix: "Keep tuning medium-strength value realization if EV remains flat versus Standard.",
      });
    }
  }
  rows.sort((left, right) => {
    if (left.variantId !== right.variantId) return left.variantId.localeCompare(right.variantId);
    return right.evImpact - left.evImpact;
  });

  const markdown = `# MGX Pro Step4-C EV Action Attribution

Sources:
${reportPaths.map((reportPath) => `- \`${path.relative(process.cwd(), reportPath)}\``).join("\n")}

| Variant | Action Type | Leak Type | Count | EV Impact | Example Trace | Suggested Fix |
|---|---|---|---:|---:|---|---|
${rows.length
    ? rows
        .map(
          (row) =>
            `| ${row.variantId} | ${row.actionType} | ${row.leakType} | ${row.count} | ${formatValue(row.evImpact)} | ${row.exampleTrace ?? "-"} | ${row.suggestedFix} |`,
        )
        .join("\n")
    : "| - | - | - | 0 | 0.0 | - | - |"}
`;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, markdown, "utf8");
  return { outputPath, reportPaths };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const reportPaths = process.argv.slice(2).length ? process.argv.slice(2).map((entry) => path.resolve(entry)) : DEFAULT_REPORT_PATHS;
  const result = await analyzeStep4cActionAttribution({ reportPaths });
  console.log(JSON.stringify(result, null, 2));
}
