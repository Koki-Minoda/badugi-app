import { defineConfig, devices } from '@playwright/test';
export default defineConfig({ testDir:'./tests/e2e', timeout:180000, workers:1, use:{ actionTimeout:15000, screenshot:'only-on-failure',trace:'retain-on-failure' }, projects:[
  {name:'completion-desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}},
  {name:'completion-android',use:{...devices['Pixel 7']}},
  {name:'completion-android-landscape',use:{...devices['Pixel 7 landscape']}},
  {name:'completion-iphone',use:{...devices['iPhone 13'],browserName:'webkit'}},
  {name:'completion-iphone-landscape',use:{...devices['iPhone 13 landscape'],browserName:'webkit'}},
] });
