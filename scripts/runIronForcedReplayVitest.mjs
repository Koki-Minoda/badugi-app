import { spawnSync } from "node:child_process";

const forwardedArgs = process.argv.slice(2);
const env = {
  ...process.env,
  MGX_IRON_FORCED_REPLAY_ARGS: JSON.stringify(forwardedArgs),
};

const result = spawnSync(
  process.execPath,
  [
    "./node_modules/vitest/vitest.mjs",
    "run",
    "src/ai/iron/__tests__/forcedActionReplayHarness.test.js",
  ],
  {
    stdio: "inherit",
    env,
  },
);

process.exit(result.status ?? 1);
