import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP22_SHADOW_TELEMETRY_POLICY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/shadow-telemetry-policy-step22.json",
);

export function defineShadowTelemetryPolicy({
  sourceModes = {
    isolated: "active",
    relaxed: "shadow-only",
  },
  priorityFrozen = true,
  outputPath = DEFAULT_STEP22_SHADOW_TELEMETRY_POLICY_OUTPUT_PATH,
} = {}) {
  return {
    sourceModes,
    shadowTelemetryEnabled: true,
    relaxedSourceSelectable: false,
    relaxedSourceShadowOnly: true,
    priorityFrozen: Boolean(priorityFrozen),
    promoted: false,
    routingChanged: false,
    outputPath,
  };
}

export async function writeShadowTelemetryPolicy({
  sourceModes = {
    isolated: "active",
    relaxed: "shadow-only",
  },
  priorityFrozen = true,
  outputPath = DEFAULT_STEP22_SHADOW_TELEMETRY_POLICY_OUTPUT_PATH,
} = {}) {
  const policy = defineShadowTelemetryPolicy({ sourceModes, priorityFrozen, outputPath });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(policy, null, 2), "utf8");
  return policy;
}
