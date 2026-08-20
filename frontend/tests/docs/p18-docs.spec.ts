import { expect, test } from "@playwright/test";

test("Docs home is static, task-first and bilingual-ready", async ({ page }) => {
  await page.goto("/docs/");
  await expect(page.getByRole("heading", { name: "GoJet Help & Documentation", level: 1 }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Start with your account and workspace", level: 2 }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Maintain a self-hosted installation", level: 2 }).first()).toBeVisible();
  await expect(page.locator("a.gojet-workspace-link").first()).toHaveAttribute("href", "/app");
});

test("API reference exposes the current core request and language examples", async ({ page }) => {
  await page.goto("/docs/developers/api-reference/");
  await expect(page.getByRole("heading", { name: "API Reference", level: 1 }).first()).toBeVisible();
  await expect(page.getByText(/^Authentication:/).first()).toBeVisible();
  for (const text of ["Request body", "curl example", "JavaScript example", "PHP example", "Go example", "Successful response", "Common errors"])
    await expect(page.getByRole("heading", { name: text }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "POST /api/links" }).first()).toBeVisible();
});

test("Chinese documentation carries product and self-hosting routes", async ({ page }) => {
  await page.goto("/docs/zh-CN/products/");
  await expect(page.getByRole("heading", { name: "创建与管理内容", level: 1 }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "条件跳转", level: 2 }).first()).toBeVisible();
  await page.goto("/docs/zh-CN/self-hosting/");
  await expect(page.getByRole("heading", { name: "自托管安装", level: 1 }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "运行浏览器安装器", level: 2 }).first()).toBeVisible();
});
