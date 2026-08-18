import { expect, test, type Page, type Route } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 }
] as const;

interface FixtureOptions { viewer?: boolean; empty?: boolean; failDomains?: boolean; }
interface FixtureState { requests: string[]; createdHostname: string | null; }

const existingDomain = {
  id: 5,
  workspace_id: 1,
  hostname: "go.example.com",
  status: "pending",
  https_status: "pending",
  last_error: null,
  last_checked_at: "2026-08-18T03:00:00Z",
  created_at: "2026-08-18T02:00:00Z"
};
const dnsRecord = { type: "TXT", name: "_gojet.go.example.com", value: "gojet-verification=fixture-token" };

async function installApiFixture(page: Page, options: FixtureOptions = {}): Promise<FixtureState> {
  const state: FixtureState = { requests: [], createdHostname: null };
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    state.requests.push(`${method} ${path}${url.search}`);

    if (method === "GET" && path === "/api/workspaces") return json(route, { data: [{ id: 1, name: "P06 Workspace", type: "personal", role: options.viewer ? "viewer" : "owner" }] });
    if (method === "GET" && path === "/api/workspaces/1/links/capabilities") return json(route, { role: options.viewer ? "viewer" : "owner", can_view: true, can_edit: !options.viewer, can_analytics: !options.viewer, can_manage: !options.viewer });
    if (method === "GET" && path === "/api/workspaces/1/link-domains") return json(route, { data: [{ hostname: "go.gt", label: "GoJet", source: "official", is_default: true }, ...(options.empty ? [] : [{ hostname: "ready.example.com", label: "Custom", source: "custom", is_default: false }])] });
    if (method === "GET" && path === "/api/workspaces/1/domains") {
      if (options.failDomains) return json(route, { error: "domains temporarily unavailable" }, 503);
      return json(route, { data: options.empty ? [] : [existingDomain] });
    }
    if (method === "POST" && path === "/api/workspaces/1/domains") {
      const body = request.postDataJSON() as { hostname?: string };
      state.createdHostname = body.hostname ?? null;
      return json(route, { domain: { ...existingDomain, id: 6, hostname: body.hostname }, dns_record: { ...dnsRecord, name: `_gojet.${body.hostname}` } }, 201);
    }
    if (method === "POST" && path === "/api/workspaces/1/domains/5/verify" && url.searchParams.get("rotate") === "1") return json(route, { domain: existingDomain, dns_record: dnsRecord });
    if (method === "POST" && path === "/api/workspaces/1/domains/5/verify") return json(route, { checked: true });

    return json(route, { error: `Unhandled P06 fixture route: ${method} ${path}` }, 404);
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
  test(`P06 Domains control plane · ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const runtimeErrors = observeRuntimeErrors(page);
    const state = await installApiFixture(page);
    await page.goto("/domains?workspace=1");

    await expect(page.getByRole("heading", { name: "Domains" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Available short-link domains" })).toBeVisible();
    await expect(page.getByText("go.gt")).toBeVisible();
    await expect(page.getByRole("heading", { name: "go.example.com" })).toBeVisible();
    await expect(page.getByText("DNS ownership")).toBeVisible();
    await expect(page.getByText("HTTPS")).toBeVisible();
    await expect(page.getByRole("button", { name: "Verify now" })).toBeVisible();

    await page.getByRole("button", { name: "Add domain" }).click();
    const sheet = page.locator(".gj-side-sheet-popup");
    await expect(sheet).toBeVisible();
    const box = await sheet.boundingBox();
    expect(box).not.toBeNull();
    if (viewport.name === "mobile") expect(Math.round(box!.width)).toBeGreaterThanOrEqual(viewport.width - 1);
    else {
      expect(box!.width).toBeGreaterThanOrEqual(520);
      expect(box!.width).toBeLessThanOrEqual(560);
    }
    await page.locator("#domain-hostname").fill("brand.example.com");
    await page.getByRole("button", { name: "Generate verification record" }).click();
    await expect(page.getByText("_gojet.brand.example.com")).toBeVisible();
    expect(state.createdHostname).toBe("brand.example.com");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Regenerate TXT" }).click();
    await expect(page.getByRole("heading", { name: "Current verification record" })).toBeVisible();
    await expect(page.getByText("gojet-verification=fixture-token")).toBeVisible();
    await page.getByRole("button", { name: "Verify now" }).click();
    await expect.poll(() => state.requests.some((entry) => entry === "POST /api/workspaces/1/domains/5/verify")).toBe(true);

    await expectNoHorizontalOverflow(page);
    expect(runtimeErrors).toEqual([]);
    expect(state.requests.some((entry) => entry === "GET /api/workspaces/1/link-domains")).toBe(true);
    await page.screenshot({ path: `test-results/p06-domains-${viewport.name}.png`, fullPage: true });
  });
}

test("P06 Domains read-only RBAC", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await installApiFixture(page, { viewer: true });
  await page.goto("/domains?workspace=1");
  await expect(page.getByText("Read-only domain access")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add domain" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Verify now" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "go.example.com" })).toBeVisible();
});

test("P06 Domains empty state", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await installApiFixture(page, { empty: true });
  await page.goto("/domains?workspace=1");
  await expect(page.getByText("No custom domains")).toBeVisible();
  await expect(page.getByText("go.gt")).toBeVisible();
});

test("P06 Domains API error state", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await installApiFixture(page, { failDomains: true });
  await page.goto("/domains?workspace=1");
  await expect(page.getByText("无法加载自定义域名")).toBeVisible();
  await expect(page.getByText("domains temporarily unavailable")).toBeVisible();
  await expect(page.getByRole("button", { name: "重试" })).toBeVisible();
});
