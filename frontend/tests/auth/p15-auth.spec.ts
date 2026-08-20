import { expect, test, type Page, type Route } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
] as const;

async function fixture(page: Page) {
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === "GET" && path === "/api/public/turnstile") {
      return json(route, { enabled: false, surface: url.searchParams.get("surface") || "" });
    }
    if (method === "GET" && path === "/api/public/auth/providers") {
      return json(route, { providers: [{ id: "github", label: "GitHub" }, { id: "google", label: "Google" }] });
    }
    if (method === "POST" && path === "/api/auth/login") {
      const body = request.postDataJSON() as { remember_session?: boolean; turnstile_token?: string };
      expect(body.remember_session).toBe(true);
      expect(body).toHaveProperty("turnstile_token");
      return json(route, { two_factor_required: true, challenge: "challenge-123" }, 202);
    }
    if (method === "POST" && path === "/api/auth/login/2fa") {
      return json(route, { user: { id: 1, email: "user@example.test" }, csrfToken: "csrf" });
    }
    return json(route, { error: `Unhandled auth route ${method} ${path}` }, 404);
  });
}

async function noOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
}

for (const viewport of viewports) {
  test(`P15 Auth Shell · ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await fixture(page);

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in to GoJet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "GitHub" })).toBeVisible();
    await expect(page.getByText("Keep me signed in on this device for 30 days", { exact: true })).toBeVisible();
    await expect(page.getByRole("checkbox")).toBeChecked();
    await page.getByLabel("Email").fill("user@example.test");
    await page.getByLabel("Password").fill("correct-horse-battery");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Two-step verification" })).toBeVisible();
    await expect(page.getByLabel("Authenticator or backup code")).toBeVisible();
    await noOverflow(page);

    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Create your GoJet account" })).toBeVisible();
    await expect(page.getByText("I agree to the Terms of Service and Privacy Policy.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm password")).toBeVisible();
    await noOverflow(page);
    await page.screenshot({ path: `test-results/p15-auth-${viewport.name}.png`, fullPage: true });
  });
}
