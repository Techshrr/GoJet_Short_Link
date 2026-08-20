import { expect, test, type Page, type Route } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 }
] as const;

const link = {
  id: 11,
  workspace_id: 1,
  created_by: 7,
  code: "summer",
  domain: "go.gt",
  destination: "https://example.com/summer",
  title: "Summer campaign",
  status: "active",
  redirect_status: 302,
  password_protected: true,
  expires_at: null,
  max_clicks: null,
  one_time: false,
  folder_id: null,
  campaign_id: 21,
  tag_ids: [31],
  folder_name: "",
  campaign_name: "Launch",
  tag_names: ["paid"],
  utm: { utm_source: "newsletter" },
  routing_rules: [],
  ab_destinations: [],
  created_at: "2026-08-18T01:00:00Z",
  updated_at: "2026-08-18T02:00:00Z",
  clicks: 123,
  visitors: 98
};

interface FixtureOptions {
  viewer?: boolean;
  empty?: boolean;
  failList?: boolean;
}

interface FixtureState {
  putBody: Record<string, unknown> | null;
  requests: string[];
}

async function installApiFixture(page: Page, options: FixtureOptions = {}): Promise<FixtureState> {
  const state: FixtureState = { putBody: null, requests: [] };
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    state.requests.push(`${method} ${path}${url.search}`);

    if (method === "GET" && path === "/api/session") return json(route, { authenticated: true, identity: { id: 7, email: "owner@example.com", displayName: "P05 Owner", emailVerified: true }, csrfToken: "p05-csrf" });
    if (method === "GET" && path === "/api/workspaces") return json(route, { data: [{ id: 1, name: "P05 Workspace", type: "personal", role: options.viewer ? "viewer" : "owner" }] });
    if (method === "GET" && path === "/api/workspaces/1/links/capabilities") return json(route, { role: options.viewer ? "viewer" : "owner", can_view: true, can_edit: !options.viewer, can_analytics: !options.viewer, can_manage: !options.viewer });
    if (method === "GET" && path === "/api/workspaces/1/link-domains") return json(route, { data: [{ hostname: "go.gt", label: "GoJet", source: "official", is_default: true }, { hostname: "s.example.com", label: "Custom", source: "custom", is_default: false }] });
    if (method === "GET" && path === "/api/workspaces/1/organization") return json(route, { campaigns: [{ id: 21, name: "Launch", status: "active", conversions: 0, links: 1, clicks: 123 }], folders: [], tags: [{ id: 31, name: "paid", color: "brand", links: 1 }] });
    if (method === "GET" && path === "/api/workspaces/1/links/presentation") {
      if (options.failList) return json(route, { error: "links temporarily unavailable" }, 503);
      return json(route, { data: options.empty ? [] : [link], total: options.empty ? 0 : 1, limit: 25, offset: 0 });
    }
    if (method === "GET" && path === "/api/workspaces/1/links/11/presentation") return json(route, link);
    if (method === "GET" && path === "/api/workspaces/1/link-risks") return json(route, { data: [{ link_id: 11, automatic_decision: "allow", effective_decision: "allow", score: 2, provider: "fixture", pending: false, manual: false }] });
    if (method === "GET" && path === "/api/workspaces/1/links/11/analytics") return json(route, { clicks: 123, unique_visitors: 98, bot_visits: 3, sources: [{ name: "Direct", count: 80 }], countries: [{ name: "SG", count: 50 }], regions: [], cities: [], devices: [{ name: "Desktop", count: 70 }], browsers: [{ name: "Chrome", count: 66 }], operating_systems: [], languages: [], utm_sources: [{ name: "newsletter", count: 20 }], destinations: [{ name: link.destination, count: 123 }], recent: [] });
    if (method === "GET" && path === "/api/workspaces/1/links/11/versions") return json(route, { data: [{ id: 91, link_id: 11, revision: 1, snapshot: { destination: link.destination }, change_reason: "initial", created_by: 7, created_at: "2026-08-18T01:00:00Z" }] });
    if (method === "GET" && path === "/api/workspaces/1/links/11/qr") {
      const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
      return route.fulfill({ status: 200, contentType: "image/png", body: png });
    }
    if (method === "POST" && path === "/api/workspaces/1/links/official") return json(route, link, 201);
    if (method === "PUT" && path === "/api/workspaces/1/links/11") {
      state.putBody = request.postDataJSON() as Record<string, unknown>;
      return json(route, link);
    }
    if (method === "PATCH" && path.startsWith("/api/workspaces/1/links/bulk-")) return json(route, { affected: 1 });
    if (method === "DELETE" && path === "/api/workspaces/1/links/bulk") return json(route, { affected: 1 });
    if (method === "POST" && path.includes("/versions/") && path.endsWith("/restore")) return json(route, link);

    return json(route, { error: `Unhandled P05 fixture route: ${method} ${path}` }, 404);
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
  test(`P05 Links list/create · ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const runtimeErrors = observeRuntimeErrors(page);
    const state = await installApiFixture(page);
    await page.goto("/app/links?workspace=1");

    await expect(page.getByRole("heading", { name: "Links" })).toBeVisible();
    const listSurface = viewport.name === "mobile" ? page.locator(".links-mobile-list") : page.locator(".links-desktop-table");
    await expect(listSurface.getByText("Summer campaign").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Create link" })).toBeVisible();
    await expect(page.getByLabel("Search links")).toBeVisible();
    await expect(page.getByLabel("Status filter")).toBeVisible();

    if (viewport.name === "mobile") {
      await expect(page.locator(".links-desktop-table")).toBeHidden();
      await expect(page.locator(".links-mobile-card")).toBeVisible();
    } else {
      await expect(page.locator(".links-desktop-table")).toBeVisible();
      await expect(page.getByRole("table", { name: "Links" })).toBeVisible();
    }

    await page.getByRole("button", { name: "Create link" }).click();
    const sheet = page.locator(".gj-side-sheet-popup");
    await expect(sheet).toBeVisible();
    const box = await sheet.boundingBox();
    expect(box).not.toBeNull();
    if (viewport.name === "mobile") expect(Math.round(box!.width)).toBeGreaterThanOrEqual(viewport.width - 1);
    else {
      expect(box!.width).toBeGreaterThanOrEqual(520);
      expect(box!.width).toBeLessThanOrEqual(560);
    }
    await expect(page.getByRole("textbox", { name: "Destination *" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Domain" })).toBeVisible();
    await page.getByText("Advanced settings").click();
    await expect(page.getByLabel("Access password")).toBeVisible();

    await expectNoHorizontalOverflow(page);
    expect(runtimeErrors).toEqual([]);
    expect(state.requests.some((entry) => entry.includes("GET /api/workspaces/1/links/presentation"))).toBe(true);
    await page.screenshot({ path: `test-results/p05-links-list-${viewport.name}.png`, fullPage: true });
  });

  test(`P05 Link detail · ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const runtimeErrors = observeRuntimeErrors(page);
    const state = await installApiFixture(page);
    await page.goto("/app/links/11?workspace=1");

    await expect(page.getByRole("heading", { name: "https://go.gt/summer" })).toBeVisible();
    for (const label of ["Overview", "Analytics", "Routing", "A/B Test", "UTM", "Access", "QR", "Settings", "History"]) await expect(page.getByRole("tab", { name: label })).toBeVisible();

    await page.getByRole("tab", { name: "Analytics" }).click();
    await expect(page.getByText("Unique visitors")).toBeVisible();
    await page.getByRole("tab", { name: "QR" }).click();
    await expect(page.getByAltText("QR code for https://go.gt/summer")).toBeVisible();
    await expect(page.getByRole("link", { name: "PDF" })).toBeVisible();
    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByText("Revision 1")).toBeVisible();

    if (viewport.name === "desktop") {
      await page.getByRole("button", { name: "Edit" }).click();
      const settingsPanel = page.getByRole("tabpanel", { name: "Settings" });
      await expect(settingsPanel.getByText("Link settings")).toBeVisible();
      await settingsPanel.getByLabel("Reason for change").fill("P05 browser gate update");
      await settingsPanel.getByRole("button", { name: "Save settings" }).click();
      await expect.poll(() => state.putBody).not.toBeNull();
      const body = state.putBody as { reason?: string; link?: { destination?: string; redirect_status?: number } };
      expect(body.reason).toBe("P05 browser gate update");
      expect(body.link?.destination).toBe(link.destination);
      expect(body.link?.redirect_status).toBe(302);
    }

    await expectNoHorizontalOverflow(page);
    expect(runtimeErrors).toEqual([]);
    await page.screenshot({ path: `test-results/p05-link-detail-${viewport.name}.png`, fullPage: true });
  });
}

test("P05 Links read-only + empty state", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await installApiFixture(page, { viewer: true, empty: true });
  await page.goto("/app/links?workspace=1");
  await expect(page.getByText("Read-only workspace")).toBeVisible();
  await expect(page.getByText("No links found")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create link" })).toHaveCount(0);
});

test("P05 Links API error state", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await installApiFixture(page, { failList: true });
  await page.goto("/app/links?workspace=1");
  await expect(page.getByText("Unable to load links")).toBeVisible();
  await expect(page.getByText("links temporarily unavailable")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});
