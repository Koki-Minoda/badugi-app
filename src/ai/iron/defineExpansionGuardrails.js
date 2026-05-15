import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP22_EXPANSION_GUARDRAILS_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-expansion-guardrails-step22.json",
);

export function defineExpansionGuardrails({
  outputPath = DEFAULT_STEP22_EXPANSION_GUARDRAILS_OUTPUT_PATH,
} = {}) {
  return {
    requireDeterministicReplay: true,
    requireInvalidReplayZero: true,
    requireSameActionNeutrality: true,
    requireShadowSimulation: true,
    requireNoGameplayMutation: true,
    requireNoRoutingMutation: true,
    d01TeacherDatasetForbidden: true,
    promoted: false,
    routingChanged: false,
    outputPath,
  };
}

export async function writeExpansionGuardrails({
  outputPath = DEFAULT_STEP22_EXPANSION_GUARDRAILS_OUTPUT_PATH,
} = {}) {
  const guardrails = defineExpansionGuardrails({ outputPath });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(guardrails, null, 2), "utf8");
  return guardrails;
}
