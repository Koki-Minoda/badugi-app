import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'../../tests/e2e',testMatch:/all-live-core5-cash-production\.spec\.ts/,workers:1,timeout:120000,use:{browserName:'webkit',headless:true,screenshot:'only-on-failure'},projects:[{name:'adoption-webkit'}]});
