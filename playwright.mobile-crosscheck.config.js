import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "mobile-cash-mtt-crosscheck.spec.ts",
  timeout: 240000,
  workers: 1,
  retries: 0,
  outputDir: "reports/mobile-cash-mtt/artifacts",
  reporter: [
    ["list"],
    ["json", { outputFile: "reports/mobile-cash-mtt/results.json" }],
  ],
  use: {
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 15000,
  },
  projects: [
    {
      name: "android-chromium",
      use: { ...devices["Pixel 7"], viewport: { width: 844, height: 390 } },
    },
    {
      name: "iphone-webkit",
      use: { ...devices["iPhone 13"], viewport: { width: 844, height: 390 } },
    },
  ],
});
