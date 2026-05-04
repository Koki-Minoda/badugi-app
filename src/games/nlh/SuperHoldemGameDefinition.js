import NLHGameDefinition from "./NLHGameDefinition.js";

const SuperHoldemGameDefinition = {
  ...NLHGameDefinition,
  id: "game-super-holdem",
  label: "NL Super Hold'em",
  variant: "super_holdem",
  handStructure: { hole: 3, community: 5 },
  rules: {
    ...(NLHGameDefinition.rules ?? {}),
    bestFiveFromThreeHole: true,
    note: "Three hole cards; showdown chooses the best five-card poker hand from all hole and board cards.",
  },
};

export default SuperHoldemGameDefinition;
export { SuperHoldemGameDefinition };
