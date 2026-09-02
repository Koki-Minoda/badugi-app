import FiveCardPLOGameDefinition from "./FiveCardPLOGameDefinition.js";

const BigOGameDefinition = {
  ...FiveCardPLOGameDefinition,
  id: "game-big-o",
  label: "Big-O",
  variant: "big_o",
  evaluators: ["high", "hi-lo-8-split"],
  features: ["must-use-two", "hi-lo"],
};

export default BigOGameDefinition;
export { BigOGameDefinition };
