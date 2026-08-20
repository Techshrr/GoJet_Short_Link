import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/shells",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["line"]],
  use: {
    browserName: "chromium",
    headless: true,
    reducedMotion: "reduce",
    trace: "retain-on-failure"
  },
  webServer: [
    { command: "pnpm --filter @gojet/site exec vite --host 127.0.0.1 --port 4173", url: "http://127.0.0.1:4173/", reuseExistingServer: !process.env.CI, timeout: 60_000 },
    { command: "pnpm --filter @gojet/workspace exec vite --host 127.0.0.1 --port 4174", url: "http://127.0.0.1:4174/app/", reuseExistingServer: !process.env.CI, timeout: 60_000 },
    { command: "pnpm --filter @gojet/admin exec vite --host 127.0.0.1 --port 4175", url: "http://127.0.0.1:4175/admin/", reuseExistingServer: !process.env.CI, timeout: 60_000 },
    { command: "pnpm --filter @gojet/docs exec astro dev --host 127.0.0.1 --port 4176", url: "http://127.0.0.1:4176/docs/", reuseExistingServer: !process.env.CI, timeout: 60_000 }
  ]
});
