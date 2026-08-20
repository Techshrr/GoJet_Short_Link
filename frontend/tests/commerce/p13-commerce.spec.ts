import { expect, test, type Page, type Route } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 }
] as const;

async function fixture(page: Page) {
  let fxUpdates = 0;
  const plan = { id: 2, code: "pro", name: "Pro", monthly_price_cents: 1900, currency: "USD", description: "Professional plan", status: "active", is_public: true, display_order: 20, billing_periods: ["monthly","quarterly","semiannual","annual"], features: ["Analytics"], link_limit: 10000, qr_limit: 500, text_limit: 500, bio_limit: 20, file_storage_bytes: 10737418240, member_limit: 10, analytics_retention_days: 90 };
  const invoice = { id: 91, workspace_id: 1, plan_id: 2, requested_by: 1, source_amount_cents: 1900, amount_cents: 2584, fx_markup_bps: 0, period_months: 1, period_days: 0, invoice_number: "GJ-202608-0091", plan_name: "Pro", plan_code: "pro", invoice_type: "renewal", billing_cycle: "monthly", source_currency: "USD", currency: "SGD", fx_rate: "1.360000000000", fx_provider: "ecb", fx_quoted_at: "2026-08-18T07:00:00Z", status: "pending", due_at: "2026-08-25T07:00:00Z", created_at: "2026-08-18T07:00:00Z" };
  const payment = { id: 501, invoice_id: 91, workspace_id: 1, owner_email: "owner@gojet.cc", provider: "stripe", merchant_order_no: "GJP-501", provider_order_id: "pi_test_501", amount_cents: 2584, currency: "SGD", status: "pending", created_at: "2026-08-18T07:01:00Z", updated_at: "2026-08-18T07:02:00Z" };
  const callback = { id: 801, provider: "stripe", request_id: "req-801", merchant_order_no: "GJP-501", provider_reference: "evt-801", payload_sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", outcome: "accepted", response_status: 200, remote_ip: "203.0.113.9", created_at: "2026-08-18T07:03:00Z" };
  const fx = { settlement_currency: "SGD", provider: "ecb", markup_bps: 0, cache_hours: 24, manual_rates: { "USD/SGD": "1.360000000000" }, rates: [{ base_currency: "USD", quote_currency: "SGD", provider: "ecb", rate: "1.360000000000", observed_at: "2026-08-18T06:00:00Z", expires_at: "2026-08-19T06:00:00Z" }], history: [{ invoice_number: "GJ-202608-0091", source_currency: "USD", currency: "SGD", rate: "1.360000000000", provider: "ecb", markup_bps: 0, quoted_at: "2026-08-18T07:00:00Z", created_at: "2026-08-18T07:00:00Z" }] };
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/api/**", async (route) => {
    const req = route.request(); const path = new URL(req.url()).pathname; const method = req.method();
    if (method === "GET" && path === "/api/admin/auth/me") return json(route, { id: 1, email: "admin@gojet.cc", display_name: "Commerce Admin", role: "super_admin", permissions: ["*"] });
    if (path.includes("csrf")) return json(route, { csrf_token: "test-csrf" });
    if (method === "GET" && path === "/api/admin/settings") return json(route, { payments: { "payments.enabled": true, "payments.default_provider": "stripe", "payments.stripe.enabled": true, "payments.stripe.display_name": "Stripe", "payments.stripe.secret_key": "********", "payments.stripe.webhook_secret": "********" } });
    if (method === "GET" && path === "/api/admin/plans") return json(route, { data: [plan] });
    if (method === "GET" && path === "/api/admin/invoices") return json(route, { data: [invoice] });
    if (method === "GET" && path === "/api/admin/payments") return json(route, { data: [payment] });
    if (method === "GET" && path === "/api/admin/payments/501") return json(route, { payment, callbacks: [callback], payload_redacted: true });
    if (method === "GET" && path === "/api/admin/fx") return json(route, fx);
    if (method === "PUT" && path === "/api/admin/fx") { fxUpdates += 1; return json(route, { updated: true }); }
    if (method === "POST" && path === "/api/admin/invoices/91/settle") return json(route, { updated: true });
    if (method === "POST" && path === "/api/admin/plans") return json(route, { id: 3, created: true }, 201);
    if (method === "PUT" && path === "/api/admin/plans/2") return json(route, { updated: true });
    if (method === "POST" && path === "/api/admin/plans/2/archive") return json(route, { archived: true });
    return json(route, { error: `Unhandled P13 commerce route: ${method} ${path}` }, 404);
  });
  return { get fxUpdates() { return fxUpdates; } };
}

function runtimeErrors(page: Page) { const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message)); page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); }); return errors; }
async function noOverflow(page: Page) { const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth })); expect(size.scroll).toBeLessThanOrEqual(size.client + 1); }

for (const viewport of viewports) {
  test(`P13 Admin Commerce · ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height }); const errors = runtimeErrors(page); const state = await fixture(page);
    await page.goto("/admin/plans"); await expect(page.getByRole("heading", { name: "Plans", exact: true })).toBeVisible(); await expect(page.getByText("Public", { exact: true })).toBeVisible(); await expect(page.getByText(/Monthly.*Quarterly.*Semiannual.*Annual/)).toBeVisible(); await noOverflow(page);
    await page.goto("/admin/billing"); await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeVisible(); await expect(page.getByText("GJ-202608-0091")).toBeVisible(); await expect(page.getByText("ecb · 1.360000000000", { exact: false })).toBeVisible(); await noOverflow(page);
    await page.goto("/admin/payments"); await expect(page.getByRole("heading", { name: "Payments", exact: true })).toBeVisible(); await page.getByRole("button", { name: "View", exact: true }).click(); const sheet = page.locator(".gj-side-sheet-popup"); await expect(sheet.getByText("Sensitive callback data is protected", { exact: true })).toBeVisible(); await expect(sheet.getByText("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", { exact: true })).toBeVisible(); await expect(sheet.getByText("provider_payload")).toHaveCount(0); await noOverflow(page);
    await page.keyboard.press("Escape"); await page.goto("/admin/fx"); await expect(page.getByRole("heading", { name: "FX", exact: true })).toBeVisible(); const save = page.getByRole("button", { name: "Save audited FX override" }); await expect(save).toBeDisabled(); await page.getByLabel("Change reason").fill("P13 browser gate audited override"); await save.click(); expect(state.fxUpdates).toBe(1); await expect(page.getByText("GJ-202608-0091")).toBeVisible(); await noOverflow(page);
    expect(errors).toEqual([]); await page.screenshot({ path: `test-results/p13-commerce-${viewport.name}.png`, fullPage: true });
  });
}
