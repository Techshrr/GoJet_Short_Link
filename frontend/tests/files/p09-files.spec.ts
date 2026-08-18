import { expect, test, type Page, type Route } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 }
] as const;

interface Options { viewer?: boolean; empty?: boolean; failFiles?: boolean; }
interface State { requests: string[]; uploads: number; deletes: number[]; }

type FixtureFile = {
  id: number; workspace_id: number; slug: string; original_name: string; mime_type: string; size_bytes: number;
  scan_status: string; scan_result?: string; status: string; expires_at: string | null; max_downloads: number | null;
  downloads: number; protected: boolean; created_at: string;
};

function safeFile(): FixtureFile { return { id: 11, workspace_id: 1, slug: "safe-doc", original_name: "launch-kit.pdf", mime_type: "application/pdf", size_bytes: 734003, scan_status: "clean", scan_result: "stream: OK", status: "active", expires_at: null, max_downloads: 25, downloads: 4, protected: false, created_at: "2026-08-18T05:00:00Z" }; }
function scanningFile(): FixtureFile { return { id: 12, workspace_id: 1, slug: "scan-doc", original_name: "brand-assets.zip", mime_type: "application/zip", size_bytes: 5242880, scan_status: "scanning", status: "quarantined", expires_at: "2026-09-18T05:00:00Z", max_downloads: null, downloads: 0, protected: true, created_at: "2026-08-18T05:03:00Z" }; }
function blockedFile(): FixtureFile { return { id: 13, workspace_id: 1, slug: "blocked-doc", original_name: "blocked.bin", mime_type: "application/octet-stream", size_bytes: 4096, scan_status: "infected", scan_result: "stream: Win.Test FOUND", status: "quarantined", expires_at: null, max_downloads: null, downloads: 0, protected: false, created_at: "2026-08-18T05:04:00Z" }; }

async function fixture(page: Page, options: Options = {}): Promise<State> {
  const state: State = { requests: [], uploads: 0, deletes: [] };
  const items: FixtureFile[] = options.empty ? [] : [safeFile(), scanningFile(), blockedFile()];
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    state.requests.push(`${method} ${path}${url.search}`);

    if (method === "GET" && path === "/api/workspaces") return json(route, { data: [{ id: 1, name: "P09 Workspace", type: "personal", role: options.viewer ? "viewer" : "owner" }] });
    if (method === "GET" && path === "/api/workspaces/1/fileshares") {
      if (options.failFiles) return json(route, { error: "file service temporarily unavailable" }, 503);
      return json(route, { data: items });
    }
    if (method === "POST" && path === "/api/workspaces/1/fileshares") {
      state.uploads += 1;
      const accepted: FixtureFile = { id: 20 + state.uploads, workspace_id: 1, slug: `queued-${state.uploads}`, original_name: "browser-upload.txt", mime_type: "text/plain; charset=utf-8", size_bytes: 16, scan_status: "pending", status: "quarantined", expires_at: null, max_downloads: null, downloads: 0, protected: false, created_at: "2026-08-18T05:10:00Z" };
      items.unshift(accepted);
      return json(route, accepted, 202);
    }
    if (method === "DELETE" && path.startsWith("/api/workspaces/1/fileshares/")) {
      const id = Number(path.split("/").pop());
      state.deletes.push(id);
      const index = items.findIndex((item) => item.id === id);
      if (index >= 0) items.splice(index, 1);
      return route.fulfill({ status: 204, body: "" });
    }
    return json(route, { error: `Unhandled P09 route: ${method} ${path}` }, 404);
  });
  return state;
}

function runtimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  return errors;
}

async function noOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
}

for (const viewport of viewports) {
  test(`P09 Files vertical slice · ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const errors = runtimeErrors(page);
    const state = await fixture(page);
    await page.goto("/app/files?workspace=1");

    await expect(page.getByRole("heading", { name: "Files" })).toBeVisible();
    await expect(page.getByText("launch-kit.pdf")).toBeVisible();
    await expect(page.locator('[data-file-id="11"]')).toHaveAttribute("data-file-state", "safe");
    await expect(page.locator('[data-file-id="12"]')).toHaveAttribute("data-file-state", "scanning");
    await expect(page.locator('[data-file-id="13"]')).toHaveAttribute("data-file-state", "blocked");
    await expect(page.getByRole("link", { name: "Open share" })).toHaveCount(1);
    await expect(page.locator('[data-file-id="12"]').getByText("Not public")).toBeVisible();
    await expect(page.locator('[data-file-id="13"]').getByText("Not public")).toBeVisible();
    await expect(page.getByText("Partial safety state")).toBeVisible();

    await page.getByRole("button", { name: "Upload file" }).click();
    const sheet = page.locator(".gj-side-sheet-popup");
    await expect(sheet).toBeVisible();
    const box = await sheet.boundingBox();
    expect(box).not.toBeNull();
    if (viewport.name === "mobile") expect(Math.round(box!.width)).toBeGreaterThanOrEqual(viewport.width - 1);
    else { expect(box!.width).toBeGreaterThanOrEqual(520); expect(box!.width).toBeLessThanOrEqual(560); }

    await expect(page.getByText("Maximum file size: 100 MB", { exact: false })).toBeVisible();
    await expect(page.getByText("Folder upload", { exact: true })).toBeVisible();
    await page.getByLabel("Browse file").setInputFiles({ name: "browser-upload.txt", mimeType: "text/plain", buffer: Buffer.from("secure test file") });
    await page.getByRole("button", { name: "Upload file", exact: true }).last().click();
    await expect(page.getByText("Processing").first()).toBeVisible();
    expect(state.uploads).toBe(1);

    await noOverflow(page);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `test-results/p09-files-${viewport.name}.png`, fullPage: true });
  });
}

test("P09 Files read-only RBAC", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await fixture(page, { viewer: true });
  await page.goto("/app/files?workspace=1");
  await expect(page.getByText("Read-only file access")).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload file" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open share" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
});

test("P09 Files empty state", async ({ page }) => {
  await fixture(page, { empty: true });
  await page.goto("/app/files?workspace=1");
  await expect(page.getByText("No files")).toBeVisible();
});

test("P09 Files disabled state", async ({ page }) => {
  await fixture(page, { failFiles: true });
  await page.goto("/app/files?workspace=1");
  await expect(page.getByText("File service disabled")).toBeVisible();
});
