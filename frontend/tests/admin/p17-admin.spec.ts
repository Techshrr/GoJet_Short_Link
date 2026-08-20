import { expect, test, type Page } from "@playwright/test";

const resourceRows = ["link", "qr", "file", "text", "bio"].map((resource_type, index) => ({
  resource_type,
  resource_id: index + 1,
  title: `${resource_type} resource`,
  workspace: "Acme",
  owner: "owner@example.com",
  visibility: "public",
  status: "active",
  created_at: "2026-08-18T12:00:00Z",
}));

const runtimeServices = ["platformapi", "redirectengine", "analyticsworker", "analyticsreconciler", "fileworker", "mailworker", "operationsmonitor", "logreceiver"].map((service, index) => ({
  service,
  display_name: service,
  status: index === 0 ? "healthy" : "unknown",
  heartbeat_state: index === 0 ? "current" : "missing",
  last_seen_at: index === 0 ? "2026-08-18T12:00:00Z" : null,
  started_at: index === 0 ? "2026-08-18T10:00:00Z" : null,
  uptime_seconds: index === 0 ? 7200 : 0,
  version: "unknown",
}));

const getFixtures: Record<string, unknown> = {
  "/api/admin/auth/me": { id: 2, email: "admin@example.com", display_name: "Admin", role: "super_admin", permissions: ["*"] },
  "/api/admin/overview": { users: 12, workspaces: 4, links: 38 },
  "/api/admin/diagnostics": { alert_count: 1, jobs: [{ name: "analytics-rollup", status: "completed", started_at: "2026-08-18T11:00:00Z", finished_at: "2026-08-18T11:01:00Z" }] },
  "/api/admin/users": { data: [{ id: 1, email: "user@example.com", display_name: "User", status: "active", email_verified: true, created_at: "2026-08-18T12:00:00Z" }] },
  "/api/admin/workspaces": { data: [{ id: 7, name: "Acme", owner_email: "owner@example.com", plan: "pro", status: "active", created_at: "2026-08-18T12:00:00Z" }] },
  "/api/admin/memberships": { data: [{ workspace_id: 7, workspace: "Acme", user_id: 1, email: "user@example.com", role: "owner", status: "active", joined_at: "2026-08-18T12:00:00Z" }] },
  "/api/admin/resource-inventory": { data: resourceRows },
  "/api/admin/domains": { data: [{ id: 4, hostname: "links.example.com", workspace: "Acme", status: "active", verification_status: "verified", created_at: "2026-08-18T12:00:00Z" }] },
  "/api/admin/administrators": { data: [{ administrator: { id: 2, email: "admin@example.com", display_name: "Admin", role: "super_admin", status: "active" } }], role_templates: { super_admin: ["platform.read", "admins.manage"], operator: ["platform.read"] }, permission_catalog: ["platform.read", "admins.manage", "users.manage", "settings.manage"] },
  "/api/admin/settings": { basic: { "site.name": "GoJet", "site.timezone": "Asia/Singapore", "site.support_email": "support@example.com" }, brand: {}, announcementbar: { "announcementbar.enabled": true, "announcementbar.rotation_seconds": 8, "announcementbar.items": [{ id: "ann-1", enabled: true, title: "Notice", message: "Maintenance window", tone: "info", dismissible: true, sort_order: 0 }] } },
  "/api/admin/official-domains": { data: [{ id: 1, hostname: "go.example.com", label: "Primary", status: "active", is_default: true, sort_order: 0 }] },
  "/api/admin/bot-protection": { "turnstile.enabled": true, "turnstile.site_key": "site-key", "turnstile.secret_configured": true, "turnstile.fail_open": false, "turnstile.allowed_hostnames": ["gojet.cc"], "turnstile.registration": true, "turnstile.login": true },
  "/api/admin/storage": { backend: "s3", health: "startup-validated", bucket: "gojet", region: "sg", access_key_configured: true, secret_key_configured: true, namespaces: { files: "files/", quarantine: "quarantine/", temporary: "temporary/" } },
  "/api/admin/runtime-services": { data: runtimeServices, expected_services: 8, generated_at: "2026-08-18T12:00:00Z" },
  "/api/admin/integrations/api-keys": { data: [{ id: 1, name: "Read API", prefix: "gjk_12345678", scopes: ["read"], status: "active", last_used_at: null }] },
  "/api/admin/integrations/webhooks": { data: [{ id: 1, name: "Deploy hook", url: "https://hooks.example.com/gojet", events: ["link.updated"], status: "active", secret_configured: true, last_delivery_status: 200 }] },
};

async function mock(page: Page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET") {
      const key = Object.keys(getFixtures).find((candidate) => url.pathname === candidate);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(key ? getFixtures[key] : { data: [] }) });
    }
    if (url.pathname === "/api/admin/integrations/api-keys" && request.method() === "POST") return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: 2, name: "CI key", token: "gjk_once_only_test_value", shown_once: true }) });
    if (url.pathname === "/api/admin/integrations/webhooks" && request.method() === "POST") return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: 2, name: "CI hook", secret: "gwh_once_only_test_value", shown_once: true }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ updated: true, saved: true, revoked: true, delivered: true, status_code: 200 }) });
  });
}

const pages = [
  ["/admin/", "Overview"], ["/admin/users", "Users"], ["/admin/workspaces", "Workspaces"], ["/admin/memberships", "Memberships"],
  ["/admin/links", "Links"], ["/admin/domains", "Domains"], ["/admin/qr", "QR Codes"], ["/admin/files", "Files"], ["/admin/text", "Text"], ["/admin/bio", "Bio Pages"],
  ["/admin/announcements", "Announcements"], ["/admin/jobs", "Background tasks"], ["/admin/services", "Service status"],
  ["/admin/administrators", "Administrators"], ["/admin/roles", "Roles"], ["/admin/permissions", "Permissions"],
  ["/admin/general", "General settings"], ["/admin/official-domains", "Official Domains"], ["/admin/turnstile", "Turnstile"], ["/admin/storage", "Storage"], ["/admin/integrations", "Integrations"],
] as const;

for (const view of [{ name: "desktop", width: 1440, height: 1000 }, { name: "tablet", width: 900, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
  test.describe(view.name, () => {
    test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: view.width, height: view.height }); await mock(page); });
    for (const [path, title] of pages) test(`${title} renders without document overflow`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)).toBeFalsy();
    });
  });
}

test("user suspension is gated by an explicit administrator reason", async ({ page }) => {
  await mock(page);
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Change status" }).click();
  await expect(page.getByRole("button", { name: "Save status" })).toBeDisabled();
  await page.getByLabel("Administrator reason").fill("Policy violation reviewed by operations");
  await expect(page.getByRole("button", { name: "Save status" })).toBeEnabled();
});

test("API key plaintext is shown only after creation and is never browser-persisted", async ({ page }) => {
  await mock(page);
  await page.goto("/admin/integrations");
  await page.getByLabel("Name").first().fill("CI key");
  await page.getByLabel("Administrator reason").first().fill("CI acceptance");
  await page.getByRole("button", { name: "Create API key" }).click();
  await expect(page.getByText("gjk_once_only_test_value")).toBeVisible();
  expect(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }))).toEqual({ local: [], session: [] });
});

test("webhook secret is shown once and service/storage views do not expose credentials", async ({ page }) => {
  await mock(page);
  await page.goto("/admin/integrations");
  await page.getByLabel("Name").nth(1).fill("CI hook");
  await page.getByLabel("Receiving URL").fill("https://hooks.example.com/gojet");
  await page.getByLabel("Administrator reason").nth(1).fill("CI acceptance");
  await page.getByRole("button", { name: "Create webhook" }).click();
  await expect(page.getByText("gwh_once_only_test_value")).toBeVisible();
  await page.goto("/admin/storage");
  await expect(page.getByText("access_key_configured")).toBeVisible();
  await expect(page.getByText(/supersecret/i)).toHaveCount(0);
  await page.goto("/admin/services");
  await expect(page.getByText("redirectengine")).toBeVisible();
  await expect(page.getByText("Unknown").first()).toBeVisible();
});
