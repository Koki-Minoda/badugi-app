const envFlag =
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.VITE_DEBUG_TOURNAMENT ?? process.env.DEBUG_TOURNAMENT)) ??
  (typeof window !== "undefined" && window.__BADUGI_DEBUG_TOURNAMENT__);

const normalized =
  typeof envFlag === "string"
    ? envFlag.trim().toLowerCase()
    : envFlag ?? null;

export const DEBUG_TOURNAMENT =
  normalized == null
    ? true
    : normalized === true ||
      normalized === "true" ||
      normalized === "1";

export function logMTT(tag, ...args) {
  if (!DEBUG_TOURNAMENT) return;
  if (args.length === 0) {
    console.log(`[MTT][${tag}]`);
    return;
  }
  console.log(`[MTT][${tag}]`, ...args);
}
