import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig, { artifactDependentTests } from "./vitest.config.js";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: artifactDependentTests,
      exclude: ["node_modules", "dist"],
    },
  }),
);
