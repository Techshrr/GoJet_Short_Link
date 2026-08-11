const {defineConfig,devices}=require('@playwright/test');

module.exports=defineConfig({
  testDir:'.',
  timeout:45000,
  expect:{timeout:10000},
  reporter:'line',
  use:{
    baseURL:process.env.GOJET_SURFACE_BASE||'http://127.0.0.1:4180',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'retain-on-failure'
  },
  projects:[{
    name:'chromium',
    use:{...devices['Desktop Chrome']}
  }]
});
