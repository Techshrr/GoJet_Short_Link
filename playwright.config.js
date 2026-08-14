const {defineConfig, devices}=require('@playwright/test');

module.exports=defineConfig({
  testDir:'./tests/e2e',
  testIgnore:[
    '**/productsurface.spec.js',
    '**/fullsurfaceconsistency.spec.js',
    '**/paymentcallbackadmin.spec.js',
    '**/analyticsdashboard.spec.js',
    '**/announcementrotation.spec.js',
    '**/destinationriskadmin.spec.js'
  ],
  // These two legacy cases assert modal-era selectors and labels. Their current
  // page-workflow equivalents live in workflowmigration.spec.js.
  grepInvert:/link creator sends structured routing rules and stable A\/B weights|admin support queue provides WHMCS-style conversation and internal notes/,
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
    command:'python3 tests/e2e/browserfixtureserver.py',
    url:'http://127.0.0.1:4173/',
    reuseExistingServer:true,
    timeout:15000,
    stdout:'pipe',
    stderr:'pipe'
  }
});
