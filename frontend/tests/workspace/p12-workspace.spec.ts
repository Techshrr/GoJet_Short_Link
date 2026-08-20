import { expect, test, type Page, type Route } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 }
] as const;

type Role = "owner" | "admin" | "editor" | "analyst" | "viewer";
interface Options { role?: Role; }
interface State { requests: string[]; invites: number; roleChanges: number; campaignCreates: number; folderCreates: number; tagCreates: number; lastTagColor?: string; }

async function fixture(page: Page, options: Options = {}): Promise<State> {
  const role = options.role ?? "owner";
  const state: State = { requests: [], invites: 0, roleChanges: 0, campaignCreates: 0, folderCreates: 0, tagCreates: 0 };
  const members = [
    { user_id: 1, Email: "owner@gojet.cc", DisplayName: "Owner", Role: "owner", Status: "active", joined_at: "2026-08-18T07:00:00Z" },
    { user_id: 2, Email: "editor@gojet.cc", DisplayName: "Editor", Role: "editor", Status: "active", joined_at: "2026-08-18T07:10:00Z" }
  ];
  const invitations = [{ id: 7, Email: "invitee@gojet.cc", Role: "viewer", Status: "pending", ExpiresAt: "2026-08-25T07:00:00Z", CreatedAt: "2026-08-18T07:00:00Z" }];
  const organization = { campaigns: [{ id: 11, name: "Launch", status: "active", conversions: 3, links: 4, clicks: 120 }], folders: [{ id: 21, name: "Product", links: 8 }], tags: [{ id: 31, name: "Priority", color: "#4f46e5", links: 5 }] };
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/api/**", async (route) => {
    const req = route.request(); const path = new URL(req.url()).pathname; const method = req.method(); state.requests.push(`${method} ${path}`);
    if (method === "GET" && path === "/api/session") return json(route, { authenticated: true, identity: { id: 7, email: "owner@example.com", displayName: "P12 Owner", emailVerified: true }, csrfToken: "p12-csrf" });
    if (method === "GET" && path === "/api/workspaces") return json(route, { data: [{ id: 1, name: "P12 Workspace", type: "company", role }] });
    if (method === "GET" && path === "/api/workspaces/1/members") return json(route, { members, invitations });
    if (method === "POST" && path === "/api/workspaces/1/invitations") { state.invites += 1; return json(route, { queued: true }, 201); }
    if (method === "PATCH" && path === "/api/workspaces/1/members/2") { state.roleChanges += 1; return json(route, { updated: true }); }
    if (method === "DELETE" && path === "/api/workspaces/1/members/2") return route.fulfill({ status: 204, body: "" });
    if (method === "POST" && path === "/api/workspaces/1/invitations/7/resend") return json(route, { queued: true }, 202);
    if (method === "DELETE" && path === "/api/workspaces/1/invitations/7") return route.fulfill({ status: 204, body: "" });
    if (method === "GET" && path === "/api/workspaces/1/organization") return json(route, organization);
    if (method === "POST" && path === "/api/workspaces/1/campaigns") { state.campaignCreates += 1; return json(route, { id: 12, name: "Campaign", status: "active", conversions: 0, links: 0, clicks: 0 }, 201); }
    if (method === "PATCH" && path === "/api/workspaces/1/campaigns/11") return json(route, { updated: true });
    if (method === "POST" && path === "/api/workspaces/1/folders") { state.folderCreates += 1; return json(route, { id: 22, name: "Folder", links: 0 }, 201); }
    if (method === "POST" && path === "/api/workspaces/1/tags") { const body = req.postDataJSON() as { color?: string }; state.tagCreates += 1; state.lastTagColor = body.color; return json(route, { id: 32, name: "Tag", color: body.color ?? "#2563eb", links: 0 }, 201); }
    return json(route, { error: `Unhandled P12 route: ${method} ${path}` }, 404);
  });
  return state;
}

function runtimeErrors(page: Page) { const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message)); page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); }); return errors; }
async function noOverflow(page: Page) { const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth })); expect(size.scroll).toBeLessThanOrEqual(size.client + 1); }

for (const viewport of viewports) {
  test(`P12 members · ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height }); const errors = runtimeErrors(page); const state = await fixture(page); await page.goto("/app/members?workspace=1");
    await expect(page.getByRole("heading", { name: "Members", exact: true })).toBeVisible(); await expect(page.getByText("owner@gojet.cc")).toBeVisible(); await expect(page.getByText("invitee@gojet.cc")).toBeVisible();
    await page.getByRole("button", { name: "Invite member" }).click(); const sheet = page.locator(".gj-side-sheet-popup"); await sheet.getByLabel("Email").fill("new@gojet.cc"); await sheet.getByRole("button", { name: "Send invitation" }).click(); expect(state.invites).toBe(1);
    const roleSelect = page.getByLabel("Role for editor@gojet.cc"); await roleSelect.selectOption("analyst"); expect(state.roleChanges).toBe(1);
    await noOverflow(page); expect(errors).toEqual([]); await page.screenshot({ path: `test-results/p12-members-${viewport.name}.png`, fullPage: true });
  });

  test(`P12 organization · ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height }); const errors = runtimeErrors(page); await fixture(page); await page.goto("/app/campaigns?workspace=1");
    await expect(page.getByRole("heading", { name: "Organization", exact: true })).toBeVisible(); await expect(page.getByText("Launch", { exact: true })).toBeVisible(); await expect(page.getByText("Product", { exact: true })).toBeVisible(); await expect(page.getByText("Priority", { exact: true })).toBeVisible();
    await noOverflow(page); expect(errors).toEqual([]); await page.screenshot({ path: `test-results/p12-organization-${viewport.name}.png`, fullPage: true });
  });
}

test("P12 tag creation uses only the frozen token palette", async ({ page }) => {
  const state = await fixture(page); await page.goto("/app/tags?workspace=1"); await page.getByRole("button", { name: "New tag" }).click();
  const sheet = page.locator(".gj-side-sheet-popup"); const palette = sheet.getByRole("radiogroup", { name: "Tag color token palette" }); await expect(palette).toBeVisible(); await expect(palette.getByRole("radio")).toHaveCount(7); await expect(sheet.locator('input[type="color"]')).toHaveCount(0);
  await palette.getByRole("radio", { name: "Cyan" }).click(); await sheet.getByLabel("Name").fill("Docs"); await sheet.getByRole("button", { name: "Create tag" }).click();
  expect(state.tagCreates).toBe(1); expect(state.lastTagColor).toBe("#06b6d4");
});

test("P12 member RBAC is read-only for viewer", async ({ page }) => { await fixture(page, { role: "viewer" }); await page.goto("/app/members?workspace=1"); await expect(page.getByText("Read-only member access")).toBeVisible(); await expect(page.getByRole("button", { name: "Invite member" })).toHaveCount(0); await expect(page.getByLabel("Role for editor@gojet.cc")).toHaveCount(0); });
test("P12 organization RBAC is read-only for analyst", async ({ page }) => { await fixture(page, { role: "analyst" }); await page.goto("/app/tags?workspace=1"); await expect(page.getByText("Read-only organization access")).toBeVisible(); await expect(page.getByRole("button", { name: "New campaign" })).toHaveCount(0); await expect(page.getByRole("button", { name: "New tag" })).toHaveCount(0); });
