export const debugEnabled = true;

/**
 * 邨ｱ荳繝・ヰ繝・げ繝ｭ繧ｰ蜃ｺ蜉幃未謨ｰ・郁牡莉倥″・・
 * @param {string} tag 繝ｭ繧ｰ繧ｫ繝・ざ繝ｪ
 * @param {string} msg 繝｡繝・そ繝ｼ繧ｸ
 * @param {object} [obj] 霑ｽ蜉繝・・繧ｿ
 */
export function debugLog(tag, msg, obj = null) {
  if (!debugEnabled) return;
  const time = new Date().toISOString().split("T")[1].slice(0, 8);

  // 濶ｲ險ｭ螳・
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