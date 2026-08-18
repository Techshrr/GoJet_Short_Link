import { expect, test } from "@playwright/test";

test("Docs home is static, task-first and bilingual-ready",async({page})=>{
  await page.goto("/docs/en/");
  await expect(page.getByRole("heading",{name:"GoJet Documentation",level:1}).first()).toBeVisible();
  await expect(page.getByText("Start here")).toBeVisible();
  await expect(page.getByText("Self-hosting",{exact:true}).first()).toBeVisible();
  await expect(page.locator("a.gojet-workspace-link")).toHaveAttribute("href","/app");
});

test("API reference exposes the frozen core fields and language examples",async({page})=>{
  await page.goto("/docs/en/developers/api-reference/");
  await expect(page.getByRole("heading",{name:"API Reference",level:1}).first()).toBeVisible();
  for(const text of["Authentication","Parameters","Body","Examples","Response","Errors","Rate limit"])await expect(page.getByText(text,{exact:true}).first()).toBeVisible();
  await expect(page.getByText("POST /api/links").first()).toBeVisible();
});

test("Chinese documentation carries product and self-hosting routes",async({page})=>{
  await page.goto("/docs/zh-CN/products/");
  await expect(page.getByRole("heading",{name:"产品",level:1}).first()).toBeVisible();
  await expect(page.getByText("Smart routing",{exact:true})).toBeVisible();
  await page.goto("/docs/zh-CN/self-hosting/");
  await expect(page.getByRole("heading",{name:"自托管",level:1}).first()).toBeVisible();
  await expect(page.getByText("PHP 8.3 Installer",{exact:true})).toBeVisible();
});
