import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config.js';

export default defineConfig({
  ...base,
  testDir: './tests/e2e',
  testMatch: 'opponent-portraits.spec.ts',
  timeout: 60000,
  outputDir: 'reports/production-release/portrait-artifacts',
  reporter: [['list'], ['json', { outputFile: 'reports/production-release/portraits.json' }]],
  projects: [
    { name: 'portraits-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'portraits-iphone', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
});
