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

function variantLanguage({ variantId, reason, heroAction }) {
  const family = variantFamily(variantId);
  const action = String(heroAction ?? "").toLowerCase();
  if (family === "badugi") {
    if (reason === "draw-decision" || action === "draw") {
      return {
        positives: ["Badugiではスート重複とペアを減らす判断が重要です。"],
        improvements: ["rough badugiや早すぎるpat維持は、次回の見直し候補です。"],
        tags: ["badugi", "duplicate-suit", "pat-timing"],
      };
    }
    return {
      positives: ["Badugiの大きな変動ハンドとして振り返る価値があります。"],
      improvements: ["rough badugiで押し切った局面がないか確認しましょう。"],
      tags: ["badugi", "rough-badugi"],
    };
  }
  if (family === "two-seven") {
    return {
      positives: ["2-7ではペア回避とストレート罠への注意が結果に直結します。"],
      improvements: ["rough draw継続やstraight trapに入った局面がないか確認しましょう。"],
      tags: ["2-7", "pair-penalty", "straight-trap", "rough-draw"],
    };
  }
  if (family === "ace-five") {
    return {
      positives: ["A-5ではwheel pressureとsmooth lowへの寄せ方が重要です。"],
      improvements: ["強いドロー圧力をかける場面と受ける場面を分けて確認しましょう。"],
      tags: ["a-5", "wheel-pressure", "smooth-low", "draw-pressure"],
    };
  }
  return {
    positives: ["重要局面としてリプレイで確認できます。"],
    improvements: ["大きくチップが動いた理由を手順ごとに確認しましょう。"],
    tags: ["review"],
  };
}

function reasonTitle(reason) {
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

function reasonSummary({ reviewMode, reason, title, description }) {
  if (description) return description;
  const modeLabel = reviewMode === "tournament" ? "トーナメント" : "キャッシュセッション";
  switch (reason) {
    case "bust-hand":
      return `${modeLabel}終了につながった局面です。判断の流れをリプレイで確認します。`;
    case "biggest-loss":
      return `${modeLabel}内でチップ減少が大きかった局面です。改善余地を確認します。`;
    case "biggest-win":
      return `${modeLabel}内で成果が大きかった局面です。良い判断を再現できるよう確認します。`;
    case "hero-all-in":
      return "全チップ投入に至った局面です。リスク量と直前判断を確認します。";
    case "showdown":
      return "ショーダウンまで進んだ局面です。value不足や強さの見積もりを確認します。";
    case "draw-decision":
      return "ドロー判断の局面です。pat維持やdraw継続の余地を確認します。";
    default:
      return title ? `${title}をリプレイで確認します。` : "重要局面をリプレイで確認します。";
  }
}

export function buildReplayReviewContract({
  reviewMode = "cash",
  keyHand = {},
  replayRef = null,
  variantId = null,
  title = null,
  summary = null,
} = {}) {
  const mode = normalizeMode(reviewMode);
  const reason = asText(keyHand.reason ?? keyHand.situationId, "key-hand");
  const resolvedVariantId = asText(keyHand.variantId ?? variantId, "unknown");
  const heroAction = asText(keyHand.heroAction ?? keyHand.action ?? keyHand.type, "");
  const phase = asText(keyHand.phase ?? keyHand.street, "");
  const language = variantLanguage({ variantId: resolvedVariantId, reason, heroAction });
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
    ...language.positives,
  ];
  const improvements = [
    ...(Array.isArray(keyHand.improvements) ? keyHand.improvements : []),
    ...language.improvements,
  ];
  const tags = [
    mode,
    reason,
    ...(Array.isArray(keyHand.tags) ? keyHand.tags : []),
    ...language.tags,
  ].filter(Boolean);
  return {
    contractType: REPLAY_REVIEW_CONTRACT_TYPE,
    schemaVersion: REPLAY_REVIEW_SCHEMA_VERSION,
    handId: keyHand.handId ?? resolvedReplayRef?.handId ?? resolvedReplayRef?.target?.handId ?? null,
    replayRef: resolvedReplayRef,
    reviewMode: mode,
    reason,
    title: asText(title ?? keyHand.title ?? keyHand.label, reasonTitle(reason)),
    summary: asText(summary ?? keyHand.summary ?? keyHand.description, reasonSummary({
      reviewMode: mode,
      reason,
      title: keyHand.title ?? keyHand.label,
      description: keyHand.description,
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
