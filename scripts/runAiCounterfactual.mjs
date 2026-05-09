import { spawnSync } from "node:child_process";

const forwardedArgs = process.argv.slice(2);
const env = {
  ...process.env,
  MGX_AI_COUNTERFACTUAL_ARGS: JSON.stringify(forwardedArgs),
};

const result = spawnSync(
  process.execPath,
  [
    "./node_modules/vitest/vitest.mjs",
    "run",
    "src/ai/evaluation/__tests__/runCounterfactualDivergenceScoreCliRunner.test.js",
  ],
  {
    stdio: "inherit",
    env,
  },
);

process.exit(result.status ?? 1);
