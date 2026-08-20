import { expect, test, type Page, type Route } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 }
] as const;

interface Options { viewer?: boolean; empty?: boolean; failQR?: boolean; }
interface State { requests: string[]; creates: Array<Record<string, unknown>>; }
const image = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='white'/%3E%3Cpath d='M4 4h22v22H4zm34 0h22v22H38zM4 38h22v22H4zm34 4h6v6h-6zm12-4h10v10H50zm-8 16h18v6H42z' fill='black'/%3E%3C/svg%3E";

function qr(id = 7) { return { id, link_id: 10, name: id === 7 ? "Launch QR" : "New QR", image_url: image, foreground: "#10233f", background: "#ffffff", size: 1024, code: "launch", domain: "go.example.com", qr_visits: 15, created_at: "2026-08-18T04:00:00Z" }; }

async function fixture(page: Page, options: Options = {}): Promise<State> {
  const state: State = { requests: [], creates: [] };
  const items = options.empty ? [] : [qr()];
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/api/**", async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const method = request.method();
    state.requests.push(`${method} ${path}${url.search}`);
    if (method === "GET" && path === "/api/session") return json(route, { authenticated: true, identity: { id: 7, email: "owner@example.com", displayName: "P08 Owner", emailVerified: true }, csrfToken: "p08-csrf" });
    if (method === "GET" && path === "/api/workspaces") return json(route, { data: [{ id: 1, name: "P08 Workspace", type: "personal", role: options.viewer ? "viewer" : "owner" }] });
    if (method === "GET" && path === "/api/workspaces/1/links/presentation") return json(route, { data: [{ id: 10, workspace_id: 1, created_by: 1, code: "launch", domain: "go.example.com", destination: "https://example.com", title: "Launch", status: "active", redirect_status: 302, one_time: false }], total: 1, limit: 100, offset: 0 });
    if (method === "GET" && path === "/api/workspaces/1/link-risks") return json(route, { data: [{ link_id: 10, automatic_decision: "allow", effective_decision: "allow", score: 0, provider: "fixture", pending: false, manual: false }] });
    if (method === "GET" && path === "/api/workspaces/1/qr-codes") {
      if (options.failQR) return json(route, { error: "qr service temporarily unavailable" }, 503);
      return json(route, { data: items });
    }
    if (method === "POST" && path === "/api/workspaces/1/qr-codes") {
      const body = request.postDataJSON() as Record<string, unknown>; state.creates.push(body); items.unshift(qr(8)); return json(route, qr(8), 201);
    }
    if (method === "DELETE" && path === "/api/workspaces/1/qr-codes/7") { items.splice(0, 1); return route.fulfill({ status: 204, body: "" }); }
    if (method === "GET" && path === "/api/workspaces/1/links/10/qr") return route.fulfill({ status: 200, contentType: "image/svg+xml", body: "<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80'/></svg>" });
    return json(route, { error: `Unhandled P08 route: ${method} ${path}` }, 404);
  });
  return state;
}

function runtimeErrors(page: Page) { const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message)); page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); }); return errors; }
async function noOverflow(page: Page) { const d = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth })); expect(d.s).toBeLessThanOrEqual(d.c + 1); }

for (const viewport of viewports) {
  test(`P08 QR vertical slice · ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const errors = runtimeErrors(page); const state = await fixture(page);
    await page.goto("/app/qr?workspace=1");
    await expect(page.getByRole("heading", { name: "QR Codes" })).toBeVisible();
    await expect(page.getByText("Launch QR")).toBeVisible();
    await expect(page.getByText("15", { exact: true }).first()).toBeVisible();
    await page.getByText("Launch QR").click();
    await expect(page.locator("[data-qr-detail]")).toBeVisible();
    await expect(page.getByRole("link", { name: "Download PNG" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download SVG" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download PDF" })).toBeVisible();
    await page.getByRole("button", { name: "Create QR code" }).click();
    const sheet = page.locator(".gj-side-sheet-popup"); await expect(sheet).toBeVisible();
    const box = await sheet.boundingBox(); expect(box).not.toBeNull();
    if (viewport.name === "mobile") expect(Math.round(box!.width)).toBeGreaterThanOrEqual(viewport.width - 1); else { expect(box!.width).toBeGreaterThanOrEqual(520); expect(box!.width).toBeLessThanOrEqual(560); }
    await page.locator("#qr-link").selectOption("10");
    await page.locator("#qr-name").fill("New QR");
    await expect(page.getByAltText("QR code preview")).toBeVisible();
    await page.getByRole("button", { name: "Create QR code", exact: true }).last().click();
    await expect(page.getByText("QR code created")).toBeVisible();
    expect(state.creates).toHaveLength(1);
    await noOverflow(page); expect(errors).toEqual([]);
    await page.screenshot({ path: `test-results/p08-qr-${viewport.name}.png`, fullPage: true });
  });
}

test("P08 QR read-only RBAC", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await fixture(page, { viewer: true });
  await page.goto("/app/qr?workspace=1");
  await expect(page.getByText("QR codes are read-only")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create QR code" })).toHaveCount(0);
  await expect(page.getByText("Launch QR")).toBeVisible();
});

test("P08 QR empty state", async ({ page }) => {
  await fixture(page, { empty: true });
  await page.goto("/app/qr?workspace=1");
  await expect(page.getByText("No QR codes yet")).toBeVisible();
});

test("P08 QR disabled/error state", async ({ page }) => {
  await fixture(page, { failQR: true });
  await page.goto("/app/qr?workspace=1");
  await expect(page.getByText("QR-code service unavailable")).toBeVisible();
  await expect(page.getByText("qr service temporarily unavailable")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});
