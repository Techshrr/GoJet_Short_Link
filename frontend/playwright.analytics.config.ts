import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/analytics",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["line"]],
  use: {
    baseURL: "http://127.0.0.1:4186/app",
    browserName: "chromium",
    headless: true,
    reducedMotion: "reduce",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "pnpm --filter @gojet/workspace exec vite --host 127.0.0.1 --port 4186",
    url: "http://127.0.0.1:4186/app/",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
