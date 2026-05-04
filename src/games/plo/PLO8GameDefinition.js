import PLOGameDefinition from "./PLOGameDefinition.js";

const PLO8GameDefinition = {
  ...PLOGameDefinition,
  id: "game-plo8",
  label: "PLO8",
  variant: "plo8",
  evaluators: ["high", "hi-lo-8-split"],
  features: ["must-use-two", "hi-lo"],
};

export default PLO8GameDefinition;
export { PLO8GameDefinition };
