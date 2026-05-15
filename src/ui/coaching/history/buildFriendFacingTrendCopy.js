import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";

export const DEFAULT_STEP55_FRIEND_COPY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step55-friend-facing-trend-copy.json",
);

function labelFor(tag, locale = "jp") {
  if (locale === "en") {
    if (tag === "missed-value") return "missed-value spots";
    if (tag === "second-pressure") return "second-pressure spots";
    return tag ?? "review spots";
  }
  if (tag === "missed-value") return "価値を取り逃す場面";
  if (tag === "second-pressure") return "二度目の圧力判断";
  return tag ?? "見直しポイント";
}

export function buildFriendFacingTrendCopySummary({ recap = {}, repeatedLeaks = {} } = {}) {
  const byVariant = Object.fromEntries(
    Object.entries(repeatedLeaks.byVariant ?? recap.byVariant ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([variantId, value]) => {
        const leaks = Array.isArray(value) ? value : value.repeatedLeaks ?? [];
        const top = leaks[0] ?? null;
        const ev = roundNumber(top?.estimatedEVReviewed ?? recap.byVariant?.[variantId]?.estimatedEVReviewed ?? 0, 1);
        return [
          variantId,
          {
            jp: top
              ? `${variantId}では「${labelFor(top.leakTag, "jp")}」が${top.count}回出ています。次は強い手で受け身になりすぎないことを意識しましょう。`
              : `${variantId}では、次回も直近のリプレイを1つ見直しましょう。`,
            en: top
              ? `In ${variantId}, ${labelFor(top.leakTag, "en")} appeared ${top.count} times. Try looking for active value decisions with strong hands.`
              : `In ${variantId}, revisit one recent replay before the next session.`,
            evReviewed: ev,
          },
        ];
      }),
  );
  const totalEv = roundNumber(recap.global?.estimatedEVReviewed ?? recap.global?.estimatedTotalEVReviewed ?? 0, 1);
  return {
    generatedAt: new Date().toISOString(),
    previewOnly: true,
    tone: "coach-light",
    noGtoClaims: true,
    noSolverCertainty: true,
    global: {
      jp: `今回の見直し済みEVは +${totalEv.toFixed(1)} 相当です。`,
      en: `Reviewed EV this recap is about +${totalEv.toFixed(1)}.`,
    },
    byVariant,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildFriendFacingTrendCopy({
  recapPath = path.resolve("reports/ai-iron/step55-multi-tournament-recap.json"),
  repeatedLeaksPath = path.resolve("reports/ai-iron/step55-variant-repeated-leaks.json"),
  outputPath = DEFAULT_STEP55_FRIEND_COPY_OUTPUT_PATH,
  recap = null,
  repeatedLeaks = null,
} = {}) {
  const report = buildFriendFacingTrendCopySummary({
    recap: recap ?? (await readJson(recapPath)),
    repeatedLeaks: repeatedLeaks ?? (await readJson(repeatedLeaksPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildFriendFacingTrendCopy();
  console.log(JSON.stringify(report, null, 2));
}
