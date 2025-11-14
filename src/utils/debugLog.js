export const debugEnabled = true;

/**
 * Lightweight logging helper used throughout the app.
 * @param {string} tag - short category label
 * @param {string} msg - message body
 * @param {object} [obj] - optional payload to dump alongside the message
 */
export function debugLog(tag, msg, obj = null) {
  if (!debugEnabled) return;
  const time = new Date().toISOString().split("T")[1].slice(0, 8);

  // Simple color coding per category.
  const color =
    tag.includes("BET") ? "color: #00ffcc;" :
    tag.includes("DRAW") ? "color: #ffcc00;" :
    tag.includes("STACK") ? "color: #00ff00;" :
    tag.includes("FLOW") ? "color: #ffaaff;" :
    "color: #ffffff;";

  const full = `%c[${time}] ${tag} ${msg}`;
  if (obj !== null) console.log(full, color, obj);
  else console.log(full, color);
}
