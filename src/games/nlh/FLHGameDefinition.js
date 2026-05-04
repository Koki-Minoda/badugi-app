import NLHGameDefinition from "./NLHGameDefinition.js";

const FLHGameDefinition = {
  ...NLHGameDefinition,
  id: "game-flh",
  label: "Fixed-Limit Hold'em",
  variant: "flh",
  betting: { structure: "fixed-limit", raiseCap: 4 },
};

export default FLHGameDefinition;
export { FLHGameDefinition };
