import { defineConfig, devices } from '@playwright/test';

const port = process.env.MGX_CANDIDATE_QA_PORT ?? '3000';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /mobile-phase-tone\.spec\.ts/,
  timeout: 120_000,
  workers: 1,
  outputDir: 'test-results/release-candidate-phase',
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${port}/` },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort --base /`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
});
