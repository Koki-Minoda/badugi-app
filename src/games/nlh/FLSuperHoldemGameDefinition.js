import SuperHoldemGameDefinition from "./SuperHoldemGameDefinition.js";

const FLSuperHoldemGameDefinition = {
  ...SuperHoldemGameDefinition,
  id: "game-fl-super-holdem",
  label: "FL Super Hold'em",
  variant: "fl_super_holdem",
  betting: { structure: "fixed-limit", raiseCap: 4 },
};

export default FLSuperHoldemGameDefinition;
export { FLSuperHoldemGameDefinition };
