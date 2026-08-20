import { expect, test, type Page, type Route, type TestInfo } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
] as const;
const targets = [
  { name: "website", url: "http://127.0.0.1:4173/", shell: ".gj-website-shell" },
  { name: "auth", url: "http://127.0.0.1:4173/login", shell: ".gj-auth-shell" },
  { name: "workspace", url: "http://127.0.0.1:4174/app/", shell: ".gj-product-shell[data-shell='workspace']" },
  { name: "admin", url: "http://127.0.0.1:4175/admin/", shell: ".gj-product-shell[data-shell='admin']" },
  { name: "docs", url: "http://127.0.0.1:4176/docs/", shell: "body" },
] as const;

function attachRuntimeGuards(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return { consoleErrors, pageErrors };
}
async function assertNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(dimensions.scrollWidth, `page-level horizontal overflow: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}
async function expectDimension(page: Page, selector: string, dimension: "width" | "height", expected: number) {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, `${selector} must have a browser layout box`).not.toBeNull();
  const actual = box?.[dimension] ?? 0;
  expect(Math.abs(actual - expected), `${selector} ${dimension} expected ${expected}, got ${actual}`).toBeLessThanOrEqual(1);
}
async function screenshot(page: Page, testInfo: TestInfo, target: string, viewport: string) { await page.screenshot({ path: testInfo.outputPath(`${target}-${viewport}.png`), fullPage: true }); }
async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

for (const target of targets) {
  for (const viewport of viewports) {
    test(`${target.name} shell @ ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const runtime = attachRuntimeGuards(page);
      if (target.name === "auth") {
        await page.route("**/api/public/auth/providers", (route) => fulfillJson(route, { providers: [] }));
        await page.route("**/api/public/turnstile**", (route) => fulfillJson(route, { enabled: false, surface: "login" }));
      }
      if (target.name === "workspace") {
        await page.route("**/api/session", (route) => fulfillJson(route, {
          authenticated: true,
          identity: { id: 1, email: "shell@example.test", displayName: "Shell User", emailVerified: true },
          csrfToken: "shell-csrf",
        }));
        await page.route("**/api/workspaces", (route) => fulfillJson(route, { data: [{ id: 1, name: "Shell Workspace" }] }));
        await page.route("**/api/workspaces/1/overview", (route) => fulfillJson(route, {
          today_clicks: 0, month_clicks: 0, unique_visitors: 0, active_links: 0,
          usage: { plan_name: "Starter", links: 0, link_limit: 100, qr_codes: 0, qr_limit: 25, members: 1, member_limit: 3, file_bytes: 0, file_storage_bytes: 1073741824 },
          trend: [], recent: [], anomalies: [], generated_at: "2026-08-20T00:00:00Z",
        }));
      }
      if (target.name === "admin") {
        await page.route("**/api/admin/auth/me", (route) => fulfillJson(route, {
          id: 1, email: "admin@example.test", display_name: "Shell Admin", role: "super_admin", permissions: ["*"],
        }));
        await page.route("**/api/admin/overview", (route) => fulfillJson(route, {
          users: 0, workspaces: 0, active_links: 0, today_clicks: 0, mail_failures: 0, abuse_reports: 0, domain_errors: 0, file_scan_backlog: 0,
        }));
        await page.route("**/api/admin/analytics/overview", (route) => fulfillJson(route, {
          today_clicks: 0, visits_30d: 0, unique_visitors_30d: 0, trend: [], sources: [], countries: [], devices: [], browsers: [], pipeline: {},
        }));
      }
      await page.goto(target.url, { waitUntil: "networkidle" });
      await expect(page.locator(target.shell).first()).toBeVisible();
      await assertNoPageOverflow(page);

      if (target.name === "website") {
        await expect(page.locator(".gj-website-header")).toBeVisible();
        await expectDimension(page, ".gj-website-header", "height", viewport.name === "mobile" ? 60 : 64);
        if (viewport.name === "desktop") await expect(page.locator(".gj-website-nav")).toBeVisible();
        else await expect(page.locator(".gj-website-mobile-menu")).toBeVisible();
        await page.evaluate(() => window.scrollTo(0, 100));
        await expect(page.locator(".gj-website-header")).toHaveAttribute("data-sticky", "true");
        await expect.poll(() => page.locator(".gj-website-header").evaluate((element) => getComputedStyle(element).position)).toBe("sticky");
      }

      if (target.name === "auth") {
        await expect(page.locator(".gj-auth-panel")).toBeVisible();
        await expect(page.locator("#shell-login-email")).toBeVisible();
        if (viewport.name === "desktop") {
          await expect(page.locator(".gj-auth-visual")).toBeVisible();
          const shellBox = await page.locator(".gj-auth-shell").boundingBox();
          const visualBox = await page.locator(".gj-auth-visual").boundingBox();
          expect(shellBox).not.toBeNull();
          expect(visualBox).not.toBeNull();
          const ratio = (visualBox?.width ?? 0) / (shellBox?.width ?? 1);
          expect(Math.abs(ratio - 0.46), `Auth desktop visual ratio expected 0.46, got ${ratio}`).toBeLessThanOrEqual(0.01);
        }
      }

      if (target.name === "workspace" || target.name === "admin") {
        const desktopSidebar = page.locator(".gj-product-sidebar");
        const mobileTrigger = page.locator(".gj-product-mobile-trigger");
        await expectDimension(page, ".gj-product-header", "height", target.name === "workspace" ? 58 : 56);
        if (viewport.name === "desktop") {
          await expect(desktopSidebar).toBeVisible();
          await expectDimension(page, ".gj-product-sidebar", "width", target.name === "workspace" ? 248 : 256);
          await expect(mobileTrigger).toBeHidden();
        } else {
          await expect(desktopSidebar).toBeHidden();
          await expect(mobileTrigger).toBeVisible();
          await mobileTrigger.getByRole("button", { name: "Menu" }).click();
          await expect(page.locator(".gj-drawer-popup")).toBeVisible();
          await assertNoPageOverflow(page);
          await page.keyboard.press("Escape");
          await expect(page.locator(".gj-drawer-popup")).toBeHidden();
        }
      }

      if (target.name === "docs") {
        await expect(page.locator("header.header")).toBeVisible();
        await expectDimension(page, "header.header", "height", 56);
        const workspaceLink = page.getByRole("link", { name: "Go to Workspace" });
        if (viewport.name === "mobile") await expect(workspaceLink).toBeHidden();
        else await expect(workspaceLink).toBeVisible();
        if (viewport.name === "desktop") {
          await expect(page.locator(".sidebar-pane")).toBeVisible();
          await expectDimension(page, ".sidebar-pane", "width", 260);
        }
      }

      await screenshot(page, testInfo, target.name, viewport.name);
      expect(runtime.pageErrors, `pageerror on ${target.name}`).toEqual([]);
      expect(runtime.consoleErrors, `console errors on ${target.name}`).toEqual([]);
    });
  }
}
