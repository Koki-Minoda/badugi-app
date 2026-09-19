import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', workers: 1, timeout: 90000,
  use: { screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'iphone-device-audit', use: { ...devices['iPhone 13 landscape'], browserName: 'webkit' } }],
});
