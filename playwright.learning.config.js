import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'learning-entry.spec.ts',
  timeout: 30000,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'reports/learning-entry/e2e-results.json' }]],
  outputDir: 'reports/learning-entry/browser-artifacts',
  use: { baseURL: 'http://127.0.0.1:4177', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4177 --strictPort --base /', url: 'http://127.0.0.1:4177/learn', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
  ],
});
