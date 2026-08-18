import { expect, test, type Page, type Route } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 }
] as const;

type Role = "owner" | "admin" | "editor" | "analyst" | "viewer";

async function fixture(page: Page, role: Role = "owner") {
  let checkoutCount = 0;
  const billing = {
    plans: [{ id: 2, code: "pro", name: "Pro", monthly_price_cents: 1900, currency: "USD", description: "Professional plan", status: "active", is_public: true, display_order: 20, billing_periods: ["monthly","quarterly","semiannual","annual"], features: ["Analytics"], link_limit: 10000, qr_limit: 500, text_limit: 500, bio_limit: 20, file_storage_bytes: 10737418240, member_limit: 10, analytics_retention_days: 90 }],
    subscription: { workspace_id: 1, plan_id: 2, plan_code: "pro", plan_name: "Pro", status: "active", period_started_at: "2026-08-01T00:00:00Z", period_ends_at: "2026-09-01T00:00:00Z", cancel_at_period_end: false },
    usage: { plan_name: "Pro", plan_code: "pro", links: 120, link_limit: 10000, qr_codes: 12, qr_limit: 500, text_shares: 8, text_limit: 500, bio_pages: 2, bio_limit: 20, file_bytes: 2048, file_storage_bytes: 10737418240, members: 3, member_limit: 10, analytics_retention_days: 90 },
    invoices: [{ id: 91, workspace_id: 1, plan_id: 2, requested_by: 1, source_amount_cents: 1900, amount_cents: 2584, fx_markup_bps: 0, period_months: 1, period_days: 0, invoice_number: "GJ-202608-0091", plan_name: "Pro", plan_code: "pro", invoice_type: "renewal", billing_cycle: "monthly", source_currency: "USD", currency: "SGD", fx_rate: "1.360000000000", fx_provider: "ecb", fx_quoted_at: "2026-08-18T07:00:00Z", status: "pending", due_at: "2026-08-25T07:00:00Z", created_at: "2026-08-18T07:00:00Z" }]
  };
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/api/**", async (route) => {
    const req = route.request(); const path = new URL(req.url()).pathname; const method = req.method();
    if (method === "GET" && path === "/api/workspaces") return json(route, { data: [{ id: 1, name: "Commerce Workspace", type: "company", role }] });
    if (method === "GET" && path === "/api/workspaces/1/billing") return json(route, billing);
    if (method === "GET" && path === "/api/workspaces/1/billing/payment-methods") return json(route, { data: [{ code: "stripe", name: "Stripe", enabled: true, mode: "redirect" }] });
    if (method === "POST" && path === "/api/workspaces/1/billing/invoices/91/pay") { checkoutCount += 1; return json(route, { transaction_id: 501, provider: "stripe", provider_name: "Stripe", mode: "redirect", redirect_url: "https://payments.example.test/checkout", merchant_order_no: "GJP-501" }, 201); }
    if (method === "POST" && path === "/api/workspaces/1/billing/invoices") return json(route, billing.invoices[0], 201);
    if (method === "PATCH" && path === "/api/workspaces/1/billing/cancellation") return json(route, { cancel_at_period_end: true });
    return json(route, { error: `Unhandled P13 billing route: ${method} ${path}` }, 404);
  });
  return { get checkoutCount() { return checkoutCount; } };
}

function runtimeErrors(page: Page) { const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message)); page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); }); return errors; }
async function noOverflow(page: Page) { const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth })); expect(size.scroll).toBeLessThanOrEqual(size.client + 1); }

for (const viewport of viewports) {
  test(`P13 Workspace Billing · ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const errors = runtimeErrors(page); const state = await fixture(page); await page.goto("/app/billing?workspace=1");
    await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeVisible();
    await expect(page.getByText("Quota usage")).toBeVisible();
    await expect(page.getByText("GJ-202608-0091")).toBeVisible();
    await expect(page.getByText("ecb · 1.360000000000")).toBeVisible();
    await page.getByRole("button", { name: "Pay", exact: true }).click();
    const sheet = page.locator(".gj-side-sheet-popup"); await sheet.getByLabel("Payment method").selectOption("stripe"); await sheet.getByRole("button", { name: "Start payment" }).click();
    expect(state.checkoutCount).toBe(1);
    await expect(page.getByText("Payment started", { exact: true })).toBeVisible();
    await expect(page.getByText("The invoice is not shown as paid until the server confirms it.", { exact: false })).toBeVisible();
    await expect(page.getByText("pending", { exact: true })).toBeVisible();
    await noOverflow(page); expect(errors).toEqual([]); await page.screenshot({ path: `test-results/p13-billing-${viewport.name}.png`, fullPage: true });
  });
}

test("P13 Billing write controls are hidden from viewer", async ({ page }) => {
  await fixture(page, "viewer"); await page.goto("/app/billing?workspace=1");
  await expect(page.getByRole("button", { name: "Pay", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Renew", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel at period end" })).toHaveCount(0);
});
