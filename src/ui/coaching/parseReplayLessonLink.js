export function parseReplayLessonLink(input = "") {
  const errors = [];
  let url;
  try {
    url = new URL(String(input), "http://mgx.local");
  } catch {
    return {
      variantId: null,
      seed: null,
      handId: null,
      actionIndex: null,
      lessonId: null,
      valid: false,
      errors: ["invalid-url"],
    };
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  const variantFromPath = pathParts[0] === "replay" ? pathParts[1] : null;
  const seedFromPath = pathParts[0] === "replay" ? pathParts[2] : null;
  const handFromPath = pathParts[0] === "replay" ? pathParts[3] : null;
  const rawActionIndex = url.searchParams.get("actionIndex") ?? url.searchParams.get("decision");
  const actionIndex = rawActionIndex === null ? null : Number(rawActionIndex);

  const parsed = {
    variantId: url.searchParams.get("variant") ?? variantFromPath ?? null,
    seed: url.searchParams.get("seed") ?? seedFromPath ?? null,
    handId: url.searchParams.get("hand") ?? handFromPath ?? null,
    actionIndex: Number.isInteger(actionIndex) && actionIndex >= 0 ? actionIndex : null,
    lessonId: url.searchParams.get("lesson") ?? null,
    sourcePath: url.pathname,
  };

  if (!parsed.variantId) errors.push("missing-variant");
  if (!parsed.seed) errors.push("missing-seed");
  if (!parsed.handId) errors.push("missing-hand");
  if (parsed.actionIndex === null) errors.push("missing-action-index");
  if (!parsed.lessonId) errors.push("missing-lesson");

  return {
    ...parsed,
    valid: errors.length === 0,
    errors,
  };
}

