import { expect, test, type Page, type Route } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 }
] as const;

interface FixtureOptions { viewer?: boolean; failOverview?: boolean; partialResources?: boolean; emptyAnalytics?: boolean; }
interface FixtureState { requests: string[]; analyticsCalls: number; }

const link = { id: 11, workspace_id: 1, created_by: 1, code: "summer", domain: "go.gt", destination: "https://example.com/summer", title: "Summer campaign", status: "active", redirect_status: 302, one_time: false, campaign_id: 7, campaign_name: "Launch", clicks: 120, visitors: 90 };
const currentAnalytics = {
  clicks: 120,
  unique_visitors: 88,
  bot_visits: 12,
  sources: [{ name: "direct", count: 70 }, { name: "referral", count: 50 }],
  countries: [{ name: "SG", count: 65 }, { name: "US", count: 55 }],
  regions: [{ name: "Singapore", count: 65 }],
  cities: [{ name: "Singapore", count: 65 }],
  devices: [{ name: "mobile", count: 80 }, { name: "desktop", count: 40 }],
  browsers: [{ name: "Chrome", count: 90 }, { name: "Safari", count: 30 }],
  operating_systems: [{ name: "Windows", count: 50 }, { name: "iOS", count: 40 }],
  languages: [{ name: "en", count: 120 }],
  utm_sources: [{ name: "newsletter", count: 45 }],
  destinations: [{ name: "primary", count: 120 }],
  recent: [{ timestamp: "2026-08-18T04:00:00Z", source: "direct", country: "SG", device: "mobile" }]
};
const previousAnalytics = { ...currentAnalytics, clicks: 80, unique_visitors: 60, bot_visits: 10 };

async function installApiFixture(page: Page, options: FixtureOptions = {}): Promise<FixtureState> {
  const state: FixtureState = { requests: [], analyticsCalls: 0 };
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    state.requests.push(`${method} ${path}${url.search}`);

    if (method === "GET" && path === "/api/session") return json(route, { authenticated: true, identity: { id: 7, email: "owner@example.com", displayName: "P07 Owner", emailVerified: true }, csrfToken: "p07-csrf" });
    if (method === "GET" && path === "/api/workspaces") return json(route, { data: [{ id: 1, name: "P07 Workspace", type: "personal", role: options.viewer ? "viewer" : "owner" }] });
    if (method === "GET" && path === "/api/workspaces/1/links/capabilities") return json(route, { role: options.viewer ? "viewer" : "owner", can_view: true, can_edit: !options.viewer, can_analytics: !options.viewer, can_manage: !options.viewer });
    if (method === "GET" && path === "/api/workspaces/1/link-domains") return json(route, { data: [{ hostname: "go.gt", label: "GoJet", source: "official", is_default: true }] });
    if (method === "GET" && path === "/api/workspaces/1/organization") return json(route, { campaigns: [{ id: 7, name: "Launch", status: "active", conversions: 4, links: 1, clicks: 120 }], folders: [], tags: [] });
    if (method === "GET" && path === "/api/workspaces/1/links/presentation") return json(route, { data: [link], total: 1, limit: 100, offset: 0 });
    if (method === "GET" && path === "/api/workspaces/1/overview") {
      if (options.failOverview) return json(route, { error: "analytics rate limited" }, 429);
      return json(route, { today_clicks: 31, month_clicks: 640, unique_visitors: 420, active_links: 9, usage: {}, trend: [{ date: "2026-08-16", clicks: 18 }, { date: "2026-08-17", clicks: 23 }, { date: "2026-08-18", clicks: 31 }], recent: [], anomalies: [], generated_at: "2026-08-18T04:00:00Z", source: "redis-realtime+mysql-history" });
    }
    if (method === "GET" && path === "/api/workspaces/1/qr-codes") return json(route, { data: [{ qr_visits: 15 }] });
    if (method === "GET" && path === "/api/workspaces/1/fileshares") {
      if (options.partialResources) return json(route, { error: "file counters unavailable" }, 503);
      return json(route, { data: [{ downloads: 8 }] });
    }
    if (method === "GET" && path === "/api/workspaces/1/text-shares") return json(route, { data: [{ views: 21 }] });
    if (method === "GET" && path === "/api/workspaces/1/bio-pages") return json(route, { data: [{ views: 34 }] });
    if (method === "GET" && path === "/api/workspaces/1/links/11/analytics") {
      state.analyticsCalls += 1;
      if (options.emptyAnalytics) return json(route, { ...currentAnalytics, clicks: 0, unique_visitors: 0, bot_visits: 0, sources: [], countries: [], devices: [], browsers: [], operating_systems: [], utm_sources: [] });
      return json(route, state.analyticsCalls === 1 ? currentAnalytics : previousAnalytics);
    }
    return json(route, { error: `Unhandled P07 fixture route: ${method} ${path}` }, 404);
  });
  return state;
}

function observeRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

for (const viewport of viewports) {
  test(`P07 workspace analytics · ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const runtimeErrors = observeRuntimeErrors(page);
    const state = await installApiFixture(page);
    await page.goto("/app/analytics?workspace=1");

    await expect(page.getByRole("heading", { name: "Analytics", exact: true })).toBeVisible();
    await expect(page.getByText("Today clicks")).toBeVisible();
    await expect(page.getByText("redis-realtime+mysql-history")).toBeVisible();
    await expect(page.getByText("QR visits")).toBeVisible();
    await expect(page.getByText("15", { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel("Resource filter")).toBeVisible();
    await expect(page.getByLabel("Domain filter")).toBeVisible();
    await expect(page.getByLabel("Campaign filter")).toBeVisible();
    await expect(page.getByLabel("Country filter")).toBeDisabled();
    await expect(page.getByLabel("Device filter")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeEnabled();

    await expectNoHorizontalOverflow(page);
    expect(runtimeErrors).toEqual([]);
    expect(state.requests.some((entry) => entry === "GET /api/workspaces/1/overview")).toBe(true);
    await page.screenshot({ path: `test-results/p07-analytics-overview-${viewport.name}.png`, fullPage: true });
  });
}

test("P07 resource analytics, compare, domain/campaign resource filtering and dimension focus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const state = await installApiFixture(page);
  await page.goto("/app/analytics?workspace=1");
  await page.getByLabel("Domain filter").selectOption("go.gt");
  await expect.poll(() => state.requests.some((entry) => entry.includes("GET /api/workspaces/1/links/presentation") && entry.includes("domain=go.gt"))).toBe(true);
  await page.getByLabel("Campaign filter").selectOption("7");
  await expect.poll(() => state.requests.some((entry) => entry.includes("campaign=7"))).toBe(true);
  await page.getByLabel("Resource filter").selectOption("11");
  await expect(page.getByText("Unique visitors")).toBeVisible();
  await expect(page.getByLabel("Country filter")).toBeEnabled();
  await expect(page.getByLabel("Device filter")).toBeEnabled();
  await page.getByLabel("Country filter").selectOption("SG");
  await page.getByLabel("Device filter").selectOption("mobile");
  const countriesSection = page.locator('.analytics-dimension[aria-label="Countries"]');
  const devicesSection = page.locator('.analytics-dimension[aria-label="Devices"]');
  await expect(countriesSection.getByText("SG", { exact: true })).toBeVisible();
  await expect(devicesSection.getByText("mobile", { exact: true })).toBeVisible();
  await page.locator(".analytics-compare input").check();
  await expect.poll(() => state.analyticsCalls).toBeGreaterThanOrEqual(2);
  await expect(page.getByText("+50.0% vs previous")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("P07 analytics RBAC denies data-plane requests", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const state = await installApiFixture(page, { viewer: true });
  await page.goto("/app/analytics?workspace=1");
  await expect(page.getByText("Analytics permission required")).toBeVisible();
  await expect(page.getByText("Analytics unavailable")).toBeVisible();
  expect(state.requests.some((entry) => entry.includes("/overview"))).toBe(false);
  expect(state.requests.some((entry) => entry.includes("/links/11/analytics"))).toBe(false);
});

test("P07 partial resource error preserves healthy counters", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await installApiFixture(page, { partialResources: true });
  await page.goto("/app/analytics?workspace=1");
  await expect(page.getByText("Partial resource data")).toBeVisible();
  await expect(page.getByText("QR visits")).toBeVisible();
  await expect(page.getByText("15", { exact: true }).first()).toBeVisible();
});

test("P07 rate-limited overview becomes explicit error state", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await installApiFixture(page, { failOverview: true });
  await page.goto("/app/analytics?workspace=1");
  await expect(page.getByText("无法加载工作区分析")).toBeVisible();
  await expect(page.getByText("analytics rate limited")).toBeVisible();
  await expect(page.getByRole("button", { name: "重试" })).toBeVisible();
});

test("P07 empty link analytics state", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await installApiFixture(page, { emptyAnalytics: true });
  await page.goto("/app/analytics?workspace=1");
  await page.getByLabel("Resource filter").selectOption("11");
  await expect(page.getByText("No countries data")).toBeVisible();
  await expect(page.getByText("No devices data")).toBeVisible();
});
