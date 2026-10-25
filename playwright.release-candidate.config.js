import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /(?:release-candidate-mix-smoke|mobile-phase-tone)\.spec\.ts/,
  timeout: 120_000,
  workers: 1,
  outputDir: 'test-results/release-candidate',
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3000/' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 3000 --base /',
    url: 'http://127.0.0.1:3000/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    {
      name: 'iphone-landscape-webkit',
      testMatch: /release-candidate-mix-smoke\.spec\.ts/,
      use: { ...devices['iPhone 13 landscape'], browserName: 'webkit' },
    },
  ],
});
