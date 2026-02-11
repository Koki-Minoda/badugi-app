export function normalizeTokenType(tokenType) {
  if (!tokenType) return "Bearer";
  const trimmed = String(tokenType).trim();
  if (!trimmed) return "Bearer";
  return trimmed.toLowerCase() === "bearer" ? "Bearer" : trimmed;
}
