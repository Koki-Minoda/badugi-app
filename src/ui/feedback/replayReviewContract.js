export const REPLAY_REVIEW_CONTRACT_TYPE = "mgx.replay-review";
export const REPLAY_REVIEW_SCHEMA_VERSION = 1;

const VALID_MODES = new Set(["tournament", "cash"]);

function asText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeMode(value) {
  const mode = String(value ?? "").toLowerCase();
  return VALID_MODES.has(mode) ? mode : "cash";
}

function normalizeSeverity(reason) {
  const value = String(reason ?? "").toLowerCase();
  if (["bust-hand", "biggest-loss", "hero-all-in"].includes(value)) return "high";
  if (["draw-decision", "showdown", "large-pot"].includes(value)) return "medium";
  return "low";
}

function variantFamily(variantId) {
  const value = String(variantId ?? "").toLowerCase();
  if (value === "badugi") return "badugi";
  if (["d01", "s01"].includes(value) || value.includes("2-7") || value.includes("deuce")) return "two-seven";
  if (["d02", "s02"].includes(value) || value.includes("a-5") || value.includes("ace")) return "ace-five";
  return "generic";
}

function variantLanguage({ variantId, reason, heroAction, locale }) {
  const family = variantFamily(variantId);
  const action = String(heroAction ?? "").toLowerCase();
  const copy = (ja, en) => locale === "en" ? en : ja;
  if (family === "badugi") {
    if (reason === "draw-decision" || action === "draw") {
      return {
        positives: [copy("このハンドの交換枚数と、その後の手札を確認できます。", "Review the cards drawn and the hand that followed.")],
        improvements: [copy("交換前に残したカードと、次のベット判断を見比べてください。", "Compare the cards you kept with the next betting decision.")],
        tags: ["badugi", "duplicate-suit", "pat-timing"],
      };
    }
    return {
      positives: [copy("このハンドの操作を順番に確認できます。", "Review the actions in this hand in order.")],
      improvements: [copy("カードの強さとベット額を一緒に振り返ってください。", "Compare the hand strength with each bet size.")],
      tags: ["badugi", "rough-badugi"],
    };
  }
  if (family === "two-seven") {
    return {
      positives: [copy("2-7の交換とベットの順序を確認できます。", "Review the draw and betting sequence in 2-7.")],
      improvements: [copy("交換前後の手札とショーダウン結果を見比べてください。", "Compare the hand before and after the draw with the showdown.")],
      tags: ["2-7", "pair-penalty", "straight-trap", "rough-draw"],
    };
  }
  if (family === "ace-five") {
    return {
      positives: [copy("A-5の交換とベットの順序を確認できます。", "Review the draw and betting sequence in A-5.")],
      improvements: [copy("交換前後の手札とベット額を見比べてください。", "Compare the hand before and after the draw with each bet size.")],
      tags: ["a-5", "wheel-pressure", "smooth-low", "draw-pressure"],
    };
  }
  return {
    positives: [copy("このハンドの操作を順番に確認できます。", "Review the actions in this hand in order.")],
    improvements: [copy("チップが動いた前後の操作を見比べてください。", "Compare the actions before and after the chip change.")],
    tags: ["review"],
  };
}

function reasonTitle(reason, locale) {
  if (locale !== "en") {
    return {
      "bust-hand": "脱落したハンド",
      "biggest-loss": "最大の損失",
      "biggest-win": "最大の獲得",
      "hero-all-in": "オールイン",
      showdown: "ショーダウン",
      "draw-decision": "交換の判断",
      "large-pot": "大きなポット",
    }[reason] ?? "注目ハンド";
  }
  switch (reason) {
    case "bust-hand":
      return "Bust hand review";
    case "biggest-loss":
      return "Biggest loss review";
    case "biggest-win":
      return "Biggest win review";
    case "hero-all-in":
      return "All-in review";
    case "showdown":
      return "Showdown review";
    case "draw-decision":
      return "Draw decision review";
    case "large-pot":
      return "Large pot review";
    default:
      return "Key hand review";
  }
}

function reasonSummary({ reviewMode, reason, title, description, locale }) {
  if (description) return description;
  if (locale === "en") {
    const mode = reviewMode === "tournament" ? "tournament" : "cash session";
    if (reason === "bust-hand") return "This hand ended your tournament. Review the actions leading to the final pot.";
    if (reason === "biggest-loss") return `This hand had your largest recorded chip loss in the ${mode}.`;
    if (reason === "biggest-win") return `This hand had your largest recorded chip gain in the ${mode}.`;
    if (reason === "hero-all-in") return "Review the actions leading up to your all-in.";
    if (reason === "showdown") return "Review the actions and cards shown at showdown.";
    if (reason === "draw-decision") return "Review the cards you kept and drew.";
    return title ? `Review the actions in ${title}.` : "Review the actions in this hand.";
  }
  const modeLabel = reviewMode === "tournament" ? "トーナメント" : "キャッシュセッション";
  switch (reason) {
    case "bust-hand":
      return `${modeLabel}終了につながったハンドです。最後のポットまでの操作を確認できます。`;
    case "biggest-loss":
      return `${modeLabel}で最も多くチップを失ったハンドです。`;
    case "biggest-win":
      return `${modeLabel}で最も多くチップを獲得したハンドです。`;
    case "hero-all-in":
      return "オールインまでの操作を順番に確認できます。";
    case "showdown":
      return "ショーダウンまでの操作と公開されたカードを確認できます。";
    case "draw-decision":
      return "交換前後のカードを確認できます。";
    default:
      return "このハンドの操作を順番に確認できます。";
  }
}

export function buildReplayReviewContract({
  reviewMode = "cash",
  keyHand = {},
  replayRef = null,
  variantId = null,
  title = null,
  summary = null,
  locale = "ja",
} = {}) {
  const mode = normalizeMode(reviewMode);
  const reason = asText(keyHand.reason ?? keyHand.situationId, "key-hand");
  const resolvedVariantId = asText(keyHand.variantId ?? variantId, "unknown");
  const heroAction = asText(keyHand.heroAction ?? keyHand.action ?? keyHand.type, "");
  const phase = asText(keyHand.phase ?? keyHand.street, "");
  const variantCopy = variantLanguage({ variantId: resolvedVariantId, reason, heroAction, locale });
  const resolvedReplayRef =
    replayRef ??
    keyHand.replayRef ??
    (keyHand.replayTarget
      ? {
          handId: keyHand.handId ?? keyHand.replayTarget.handId ?? null,
          variantId: resolvedVariantId,
          target: keyHand.replayTarget,
          available: true,
        }
      : null);
  const positives = [
    ...(Array.isArray(keyHand.positives) ? keyHand.positives : []),
    ...variantCopy.positives,
  ];
  const improvements = [
    ...(Array.isArray(keyHand.improvements) ? keyHand.improvements : []),
    ...variantCopy.improvements,
  ];
  const tags = [
    mode,
    reason,
    ...(Array.isArray(keyHand.tags) ? keyHand.tags : []),
    ...variantCopy.tags,
  ].filter(Boolean);
  return {
    contractType: REPLAY_REVIEW_CONTRACT_TYPE,
    schemaVersion: REPLAY_REVIEW_SCHEMA_VERSION,
    handId: keyHand.handId ?? resolvedReplayRef?.handId ?? resolvedReplayRef?.target?.handId ?? null,
    replayRef: resolvedReplayRef,
    reviewMode: mode,
    reason,
    title: asText(title ?? keyHand.title ?? keyHand.label, reasonTitle(reason, locale)),
    summary: asText(summary ?? keyHand.summary ?? keyHand.description, reasonSummary({
      reviewMode: mode,
      reason,
      title: keyHand.title ?? keyHand.label,
      description: keyHand.description,
      locale,
    })),
    positives: [...new Set(positives)].slice(0, 4),
    improvements: [...new Set(improvements)].slice(0, 4),
    heroAction: heroAction || null,
    phase: phase || null,
    street: phase || null,
    variantId: resolvedVariantId,
    tags: [...new Set(tags)].slice(0, 8),
    severity: keyHand.severity ?? normalizeSeverity(reason),
  };
}

export function isReplayReviewContract(value) {
  return Boolean(
    value?.contractType === REPLAY_REVIEW_CONTRACT_TYPE &&
      value?.schemaVersion === REPLAY_REVIEW_SCHEMA_VERSION &&
      VALID_MODES.has(value?.reviewMode) &&
      value?.handId &&
      value?.title &&
      Array.isArray(value?.positives) &&
      Array.isArray(value?.improvements) &&
      Array.isArray(value?.tags),
  );
}
