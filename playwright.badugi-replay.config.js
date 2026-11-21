import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'hand-history-replay-fidelity.spec.ts',
  workers: 1,
  use: { screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: process.env.E2E_APP_URL ? undefined : {
    command: 'npm run preview -- --host 127.0.0.1 --port 3000 --strictPort --base /',
    url: 'http://127.0.0.1:3000/learn',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone-portrait', use: { ...devices['iPhone 13'], browserName: 'webkit', viewport: { width: 390, height: 844 } } },
    { name: 'iphone-landscape', use: { ...devices['iPhone 13 landscape'], browserName: 'webkit', viewport: { width: 844, height: 390 } } },
  ],
});
