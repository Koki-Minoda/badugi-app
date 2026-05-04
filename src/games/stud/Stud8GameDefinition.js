import StudGameDefinition from "./StudGameDefinition.js";

const Stud8GameDefinition = {
  ...StudGameDefinition,
  id: "game-stud8",
  label: "Stud 8",
  variant: "stud8",
  evaluators: ["high", "hi-lo-8-split"],
};

export default Stud8GameDefinition;
export { Stud8GameDefinition };
