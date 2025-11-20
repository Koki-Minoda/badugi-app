// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    headless: true,
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'npm start',
    port: 3000,
    reuseExistingServer: true,
  },
});
