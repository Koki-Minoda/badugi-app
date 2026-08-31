import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  timeout: 30000,
  workers: 1,
  use: {
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: process.env.E2E_APP_URL || process.env.LIVE_PREVIEW === '1'
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 3000',
        port: 3000,
        timeout: 120000,
        reuseExistingServer: true,
      },
  projects: [
    {
      name: 'legacy-e2e',
      testDir: './e2e',
    },
    {
      name: 'badugi-flow',
      testDir: './tests/e2e',
    },
    {
      name: 'badugi-regression',
      testDir: './tests/badugi-regression',
    },
    {
      name: 'tournament-pr-chromium',
      testDir: './tests/e2e',
      testMatch: /(?:tournament-(?:reconnect-ui|stage-blind-transition)|core5-real-action-champion)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'tournament-android-chromium',
      testDir: './tests/e2e',
      testMatch: /tournament-device-project-smoke\.spec\.ts/,
      use: {
        ...devices['Pixel 7 landscape'],
        browserName: 'chromium',
      },
    },
    {
      name: 'tournament-iphone-webkit',
      testDir: './tests/e2e',
      testMatch: /(?:tournament-device-project-smoke|iphone-safari-tournament-landscape-controls)\.spec\.ts/,
      use: {
        ...devices['iPhone 13 landscape'],
        browserName: 'webkit',
      },
    },
    {
      name: 'core5-soak-desktop-chromium',
      testDir: './tests/e2e',
      testMatch: /browser-gameplay-invariant-harness\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'core5-soak-android-chromium',
      testDir: './tests/e2e',
      testMatch: /browser-gameplay-invariant-harness\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
      },
    },
    {
      name: 'core5-soak-iphone-webkit',
      testDir: './tests/e2e',
      testMatch: /browser-gameplay-invariant-harness\.spec\.ts/,
      use: {
        ...devices['iPhone 13'],
        browserName: 'webkit',
      },
    },
  ],
});
