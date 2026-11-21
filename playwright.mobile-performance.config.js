import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "mobile-switch-performance.spec.ts",
  timeout: 1800000,
  workers: 1,
  retries: 0,
  outputDir: "reports/mobile-performance/artifacts",
  reporter: [["list"]],
  use: {
    headless: true,
    actionTimeout: 15000,
    screenshot: "only-on-failure",
    trace: "off",
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
