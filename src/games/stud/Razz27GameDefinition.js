import StudGameDefinition from "./StudGameDefinition.js";

const Razz27GameDefinition = {
  ...StudGameDefinition,
  id: "game-razz-27",
  label: "2-7 Razz",
  variant: "razz27",
  evaluators: ["low-27"],
};

export default Razz27GameDefinition;
export { Razz27GameDefinition };
