import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir:"./tests/docs",timeout:30000,retries:1,reporter:"html",
  use:{baseURL:"http://127.0.0.1:4321",trace:"retain-on-failure"},
  projects:[
    {name:"desktop",use:{...devices["Desktop Chrome"],viewport:{width:1440,height:900}}},
    {name:"tablet",use:{...devices["Desktop Chrome"],viewport:{width:1024,height:768}}},
    {name:"mobile",use:{...devices["Desktop Chrome"],viewport:{width:390,height:844}}}
  ],
  webServer:{command:"pnpm --filter @gojet/docs build && pnpm --filter @gojet/docs exec astro preview --host 127.0.0.1 --port 4321",url:"http://127.0.0.1:4321/docs/en/",reuseExistingServer:false,timeout:120000}
});
