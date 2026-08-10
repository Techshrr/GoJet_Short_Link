const {defineConfig, devices}=require('@playwright/test');

module.exports=defineConfig({
  testDir:'./tests/e2e',
  timeout:30000,
  reporter:'line',
  use:{
    baseURL:'http://127.0.0.1:4173',
    trace:'retain-on-failure'
  },
  projects:[
    {
      name:'chromium',
      use:{...devices['Desktop Chrome']}
    }
  ],
  webServer:{
    command:'python3 tests/e2e/rebuild_server.py',
    url:'http://127.0.0.1:4173/',
    reuseExistingServer:false,
    timeout:15000,
    stdout:'pipe',
    stderr:'pipe'
  }
});
