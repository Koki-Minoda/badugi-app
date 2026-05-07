import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_REPORT_PATH = path.resolve("reports/ai-eval/pro-vs-standard-20260506.json");
const DEFAULT_OUTPUT_PATH = path.resolve("docs/ai/MGX_PRO_LEAK_ANALYSIS.md");
const DEFAULT_CLASSIFICATION_PATH = path.resolve("docs/ai/MGX_PRO_STEP4B_LEAK_CLASSIFICATION.md");

function formatRate(value) {
  return typeof value === "number" ? value.toFixed(4) : "-";
}

function formatValue(value) {
  return typeof value === "number" ? value.toFixed(1) : "-";
}

function topItems(items = [], limit = 5) {
  return [...items].sort((left, right) => right[1] - left[1]).slice(0, limit);
}

function buildFallbackRows(variants = {}) {
  return Object.entries(variants)
    .filter(([, result]) => result?.analysis?.fallbackReasonCounts)
    .map(([variantId, result]) => {
      const counts = result.analysis.fallbackReasonCounts;
      return `| ${variantId} | ${counts["missing-logic"] ?? 0} | ${counts["no-rule-match"] ?? 0} | ${counts["unsafe-action"] ?? 0} | ${counts["illegal-block"] ?? 0} |`;
    })
    .join("\n");
}

function buildFallbackSamples(variants = {}) {
  const rows = [];
  Object.entries(variants).forEach(([variantId, result]) => {
    (result.analysis?.fallbackSamples ?? []).slice(0, 6).forEach((sample) => {
      rows.push(
        `| ${variantId} | ${sample.phase} | ${sample.actionType} | ${sample.fallbackReasonCategory ?? "-"} | ${sample.reason ?? "-"} | ${sample.handSummary?.hand?.join(" " ) ?? "-"} |`,
      );
    });
  });
  return rows.length
    ? rows.join("\n")
    : "| - | - | - | - | - | - |";
}

function buildLossSamples(variants = {}) {
  const rows = [];
  Object.entries(variants).forEach(([variantId, result]) => {
    (result.analysis?.lossSamples ?? []).slice(0, 6).forEach((sample) => {
      rows.push(
        `| ${variantId} | ${sample.delta} | ${sample.handSummary?.category ?? sample.handSummary?.madeCount ?? "-"} | ${sample.handSummary?.highestRank ?? sample.handSummary?.kicker ?? "-"} | ${sample.handSummary?.hand?.join(" ") ?? "-"} |`,
      );
    });
  });
  return rows.length
    ? rows.join("\n")
    : "| - | - | - | - | - |";
}

function buildMetricRows(variants = {}) {
  return Object.entries(variants)
    .filter(([, result]) => result?.resultsByTier?.pro)
    .map(([variantId, result]) => {
      const pro = result.resultsByTier.pro;
      return `| ${variantId} | ${formatRate(pro.drawMistakeRate)} | ${formatRate(pro.recklessRaiseRate)} | ${formatRate(pro.fallbackRate)} | ${formatValue(pro.evPerHand)} |`;
    })
    .join("\n");
}

function summarizeEvImpact(samples = []) {
  return samples.reduce((sum, sample) => sum + Math.abs(Number(sample?.delta ?? 0) || 0), 0);
}

function getWeakThresholdForVariant(variantId = "") {
  return ["D02", "S02"].includes(variantId) ? 8 : 9;
}

function classifyVariantLeaks(variantId, result = {}) {
  const rows = [];
  const fallbackSamples = (result.analysis?.fallbackSamples ?? []).filter((sample) => sample.variantId === variantId);
  const patMistakeSamples = (result.analysis?.patMistakeSamples ?? []).filter((sample) => sample.variantId === variantId);
  const lossSamples = (result.analysis?.lossSamples ?? []).filter((sample) => sample.variantId === variantId);
  const weakThreshold = getWeakThresholdForVariant(variantId);
  const weakLosses = lossSamples.filter((sample) => {
    const highestRank = Number(sample?.handSummary?.highestRank ?? sample?.handSummary?.kicker ?? 99);
    const category = String(sample?.handSummary?.category ?? "");
    return highestRank >= weakThreshold || ["onePair", "twoPair"].includes(category);
  });
  const strongLosses = lossSamples.filter((sample) => {
    const highestRank = Number(sample?.handSummary?.highestRank ?? sample?.handSummary?.kicker ?? 99);
    const madeCount = Number(sample?.handSummary?.madeCount ?? 0);
    return highestRank <= (["D02", "S02"].includes(variantId) ? 6 : 8) || madeCount >= 4;
  });
  const fallbackBetSamples = fallbackSamples.filter((sample) => sample.phase === "BET");

  if (weakLosses.length) {
    rows.push({
      variantId,
      leakType: variantId.startsWith("S") ? "single-draw over-aggression" : "weak call loss",
      count: weakLosses.length,
      evImpact: summarizeEvImpact(weakLosses),
      example: weakLosses[0]?.handSummary?.hand?.join(" ") ?? "-",
      fix:
        variantId.startsWith("S")
          ? "Lower final-round aggression and let marginal one-draw hands check/fold more often."
          : "Reduce marginal calls and rough-low defense after the final draw.",
    });
  }

  if (strongLosses.length) {
    rows.push({
      variantId,
      leakType: "missed value bet",
      count: strongLosses.length,
      evImpact: summarizeEvImpact(strongLosses),
      example: strongLosses[0]?.handSummary?.hand?.join(" ") ?? "-",
      fix: "Separate premium made lows from marginal made lows so value spots still bet/raise.",
    });
  }

  if (patMistakeSamples.length) {
    rows.push({
      variantId,
      leakType: "bad pat",
      count: patMistakeSamples.length,
      evImpact: patMistakeSamples.length * 10,
      example: patMistakeSamples[0]?.handSummary?.hand?.join(" ") ?? "-",
      fix: "Tighten pat thresholds for completed lows and made Badugi hands.",
    });
  }

  if (fallbackBetSamples.length) {
    rows.push({
      variantId,
      leakType: "fallback-heavy street",
      count: fallbackBetSamples.length,
      evImpact: fallbackBetSamples.length * 5,
      example: fallbackBetSamples[0]?.handSummary?.hand?.join(" ") ?? "-",
      fix: "Cover more betting spots inside the Pro overlay instead of dropping to fallback.",
    });
  }

  if (!rows.length && lossSamples.length) {
    rows.push({
      variantId,
      leakType: "final betting leak",
      count: lossSamples.length,
      evImpact: summarizeEvImpact(lossSamples),
      example: lossSamples[0]?.handSummary?.hand?.join(" ") ?? "-",
      fix: "Rebalance final-street betting thresholds against Standard.",
    });
  }

  return rows;
}

function buildLeakClassificationRows(variants = {}) {
  const rows = Object.entries(variants).flatMap(([variantId, result]) => classifyVariantLeaks(variantId, result));
  return rows.length
    ? rows
        .map(
          (row) =>
            `| ${row.variantId} | ${row.leakType} | ${row.count} | ${formatValue(row.evImpact)} | ${row.example} | ${row.fix} |`,
        )
        .join("\n")
    : "| - | - | - | - | - | - |";
}

export async function analyzeProLeaks({
  reportPath = DEFAULT_REPORT_PATH,
  outputPath = DEFAULT_OUTPUT_PATH,
  classificationPath = DEFAULT_CLASSIFICATION_PATH,
} = {}) {
  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  const variants = report.variants ?? {};
  const regressionCandidates = Object.entries(variants)
    .filter(([, result]) => result?.summary?.verdict === "PRO_WORSE")
    .map(([variantId, result]) => [
      variantId,
      (result.resultsByTier?.standard?.evPerHand ?? 0) - (result.resultsByTier?.pro?.evPerHand ?? 0),
    ]);

  const markdown = `# MGX Pro Leak Analysis

Source: \`${path.relative(process.cwd(), reportPath)}\`

## Regression Priority

${topItems(regressionCandidates).map(([variantId, evGap]) => `- \`${variantId}\`: EV gap ${formatValue(evGap)}`).join("\n") || "- none"}

## Fallback Reason Breakdown

| Variant | missing-logic | no-rule-match | unsafe-action | illegal-block |
| ------- | ------------: | ------------: | ------------: | ------------: |
${buildFallbackRows(variants)}

## Fallback Spot Samples

| Variant | Phase | Action | Category | Reason | Hand |
| ------- | ----- | ------ | -------- | ------ | ---- |
${buildFallbackSamples(variants)}

## Pro Losing Hand Samples

| Variant | Delta | Category | High Rank | Hand |
| ------- | ----: | -------- | --------: | ---- |
${buildLossSamples(variants)}

## Draw/Betting Leak Metrics

| Variant | Draw Mistake Rate | Betting Mistake Rate | Fallback Rate | Pro EV/Hand |
| ------- | ----------------: | -------------------: | ------------: | ----------: |
${buildMetricRows(variants)}

## Pat Decision Misses

${Object.entries(variants)
  .filter(([, result]) => (result.analysis?.patMistakeSamples ?? []).length > 0)
  .map(([variantId, result]) => `- \`${variantId}\`: ${(result.analysis?.patMistakeSamples ?? []).length} sampled pat/draw misses`)
  .join("\n") || "- no sampled pat/draw misses"}
`;

  const classificationMarkdown = `# MGX Pro Step4-B Leak Classification

Source: \`${path.relative(process.cwd(), reportPath)}\`

| Variant | Leak Type | Count | EV Impact | Example Hand/Trace | Suggested Fix |
| --- | ---: | ---: | ---: | --- | --- |
${buildLeakClassificationRows(variants)}
`;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, markdown, "utf8");
  await fs.mkdir(path.dirname(classificationPath), { recursive: true });
  await fs.writeFile(classificationPath, classificationMarkdown, "utf8");
  return { reportPath, outputPath, classificationPath };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const reportPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_REPORT_PATH;
  const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_OUTPUT_PATH;
  const classificationPath = process.argv[4] ? path.resolve(process.argv[4]) : DEFAULT_CLASSIFICATION_PATH;
  const result = await analyzeProLeaks({ reportPath, outputPath, classificationPath });
  console.log(JSON.stringify(result, null, 2));
}
