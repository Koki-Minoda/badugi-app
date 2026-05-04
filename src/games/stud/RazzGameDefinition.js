import StudGameDefinition from "./StudGameDefinition.js";

const RazzGameDefinition = {
  ...StudGameDefinition,
  id: "game-razz",
  label: "Razz",
  variant: "razz",
  evaluators: ["low-a5"],
};

export default RazzGameDefinition;
export { RazzGameDefinition };
