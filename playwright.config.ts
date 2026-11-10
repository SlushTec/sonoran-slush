import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e', fullyParallel:false, workers:2, timeout:30000,
 use:{baseURL:'http://127.0.0.1:3137',trace:'retain-on-failure'},
 reporter:[['list'],['json',{outputFile:'artifacts/playwright-results.json'}]],
 webServer:{command:'npm run start --workspace @sonoran/storefront -- --hostname 127.0.0.1 --port 3137',url:'http://127.0.0.1:3137/api/health',reuseExistingServer:false,timeout:120000},
});
