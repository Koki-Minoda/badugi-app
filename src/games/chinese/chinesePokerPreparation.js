export const CHINESE_POKER_PREPARATION = Object.freeze({
  id: "chinese_poker",
  label: "Chinese Poker",
  status: "prepared",
  aliases: ["chinese", "chaipo", "チャイポ"],
  requirements: Object.freeze([
    "13-card deal and 3-row hand arrangement",
    "front/middle/back high-hand comparison",
    "foul detection when rows are misordered",
    "classic Chinese Poker royalty scoring",
    "separate UI layout; not compatible with current ring-table betting flow",
  ]),
});

export default CHINESE_POKER_PREPARATION;
