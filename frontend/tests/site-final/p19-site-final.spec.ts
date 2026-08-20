import { expect, test } from '@playwright/test';

const staticRoutes = [
  '/', '/products/', '/products/links/', '/products/qr-codes/', '/products/files/',
  '/products/text-sharing/', '/products/link-in-bio/', '/products/analytics/',
  '/products/smart-routing/', '/products/custom-domains/', '/solutions/',
  '/solutions/marketing/', '/solutions/creators/', '/solutions/teams/',
  '/solutions/developers/', '/developers/', '/pricing/', '/security/', '/about/',
  '/contact/', '/status/', '/changelog/', '/legal/privacy/', '/legal/terms/',
  '/legal/acceptable-use/', '/report-abuse/'
];
const bannedVisible = [
  'GOJET WORKSPACE', 'WORKFLOW', 'USE CASES', 'DEVELOPER PLATFORM',
  'SERVER-OWNED PRICING', 'control plane', 'server-authoritative', 'server authority',
  'redirect layer', 'exact-head', 'frozen shell', 'visit_type = qr'
];

test('homepage uses bilingual product copy, current product preview and complete footer', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.gj-website-shell')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Create, publish and keep control of everything you share.', level: 1 })).toBeVisible();
  await expect(page.locator('[data-product-source="workspace-current-ui"]')).toBeVisible();
  for (const label of ['Destination', 'Domain', 'Short code', 'Title']) await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('More options', { exact: true })).toBeVisible();
  await expect(page.getByText('QR preview', { exact: true })).toBeVisible();
  await expect(page.getByText('Export CSV', { exact: true })).toBeVisible();
  await expect(page.locator('.footer-columns')).toBeVisible();
  for (const group of ['Products', 'Solutions', 'Integrations', 'Company', 'Legal']) await expect(page.locator('.footer-column h2', { hasText: group })).toBeVisible();
  for (const label of ['Privacy Policy', 'Terms of Service', 'Acceptable Use Policy', 'Report Abuse']) await expect(page.getByRole('link', { name: label }).first()).toBeVisible();
  for (const phrase of bannedVisible) await expect(page.locator('body')).not.toContainText(phrase);
  const width = page.viewportSize()?.width ?? 1440;
  const header = await page.locator('.gj-website-header').boundingBox();
  expect(Math.abs((header?.height ?? 0) - (width <= 767 ? 60 : 64))).toBeLessThanOrEqual(1);
  await page.evaluate(() => scrollTo(0, 100));
  await expect(page.locator('.gj-website-header')).toHaveAttribute('data-sticky', 'true');
  const dims = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  expect(dims.s).toBeLessThanOrEqual(dims.c + 1);
});

test('all static routes and zh-CN counterparts are prerendered with locale SEO', async ({ page }) => {
  for (const route of staticRoutes) {
    const response = await page.goto(route);
    expect(response?.ok(), route).toBeTruthy();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(route.replaceAll('/', '\\/')));
    await expect(page.locator('link[rel="alternate"]')).toHaveCount(2);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
    await expect(page.locator('.footer-columns')).toBeVisible();

    const zhRoute = route === '/' ? '/zh-CN/' : `/zh-CN${route}`;
    const zhResponse = await page.goto(zhRoute);
    expect(zhResponse?.ok(), zhRoute).toBeTruthy();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(zhRoute.replaceAll('/', '\\/')));
    await expect(page.locator('.footer-columns')).toBeVisible();
    for (const phrase of bannedVisible) await expect(page.locator('body')).not.toContainText(phrase);
  }
});

test('legal pages contain detailed content instead of placeholder copy', async ({ page }) => {
  for (const route of ['/legal/privacy/', '/legal/terms/', '/legal/acceptable-use/']) {
    await page.goto(route);
    await expect(page.locator('.legal-section')).toHaveCount(await page.locator('.legal-section').count());
    expect(await page.locator('.legal-section').count()).toBeGreaterThanOrEqual(7);
    const related = page.locator('.legal-note');
    await expect(related).toBeVisible();
    await expect(related.getByRole('link', { name: 'Report Abuse', exact: true })).toBeVisible();

    await page.goto(`/zh-CN${route}`);
    expect(await page.locator('.legal-section').count()).toBeGreaterThanOrEqual(7);
    const relatedZh = page.locator('.legal-note');
    await expect(relatedZh).toBeVisible();
    await expect(relatedZh.getByRole('link', { name: '举报滥用', exact: true })).toBeVisible();
  }
});

test('pricing points to live account billing instead of inventing static amounts', async ({ page }) => {
  await page.goto('/pricing/');
  await expect(page.locator('[data-pricing-source="account"]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Billing & Plans' })).toHaveAttribute('href', '/app/billing');
  await page.goto('/zh-CN/pricing/');
  await expect(page.getByRole('link', { name: '进入账单与套餐' })).toHaveAttribute('href', '/app/billing');
});

test('reduced motion disables continuous homepage animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const selector of ['.ambient-halo', '.product-float', '.product-float-delayed', '.jet-path span']) {
    await expect.poll(() => page.locator(selector).first().evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  }
});
