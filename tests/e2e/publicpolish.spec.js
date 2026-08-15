const {test,expect}=require('@playwright/test');

test.beforeEach(async({page})=>{
  await page.route('**/api/public/settings',route=>route.fulfill({
    contentType:'application/json',
    body:JSON.stringify({
      'site.name':'GoJet',
      'site.description':'统一管理短链接、二维码、内容分享与访问分析。',
      'site.support_email':'support@example.test',
      'site.company_name':'GoJet Test Company',
      'site.company_address':'Singapore',
      'site.copyright':'© 2026 GoJet Test Company'
    })
  }));
});

test('public home uses Chinese taxonomy and readable navigation/footer',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/');
  const sectionLabels=page.locator('.mk-section-head>span');
  await expect(sectionLabels).toContainText(['核心产品','个人主页','套餐价格','常见问题']);
  await expect(page.locator('body')).not.toContainText(/GOJET PRODUCTS|ONE PROFILE, MANY DESTINATIONS|PRICING|FAQ/);
  const navFont=await page.locator('.navLinks>a').first().evaluate(node=>parseFloat(getComputedStyle(node).fontSize));
  expect(navFont).toBeGreaterThanOrEqual(14);
  const footer=page.locator('footer[data-gojet-shell]');
  await expect(footer).toContainText('统一管理短链接、二维码、内容分享与访问分析。');
  await expect(footer).toContainText('GoJet Test Company');
  await expect(footer).toContainText('Singapore');
  await expect(footer.getByRole('link',{name:'support@example.test'})).toHaveAttribute('href','mailto:support@example.test');
  await expect(footer.getByText('隐私政策',{exact:true})).toHaveCount(1);
  await expect(footer.getByText('服务条款',{exact:true})).toHaveCount(1);
});

test('safety interstitial carries only safe resource context into the appeal flow',async({page})=>{
  await page.goto('/linkunavailable?reason=blocked&kind=link&code=gj-safe-42&target=https%3A%2F%2Fshould-never-leak.example%2Fprivate');
  await expect(page.getByRole('heading',{name:'此链接已被安全阻止'})).toBeVisible();
  await expect(page.locator('#safetyCode')).toHaveText('gj-safe-42');
  const appeal=page.locator('#safetyAppeal');
  await expect(appeal).toBeVisible();
  const href=await appeal.getAttribute('href');
  expect(href).toContain('/app/support?');
  expect(href).toContain('mode=appeal');
  expect(href).toContain('resource_kind=link');
  expect(href).toContain('resource_ref=gj-safe-42');
  expect(href).toContain('safety_state=blocked');
  expect(href).not.toContain('should-never-leak');
  expect(href).not.toContain('target=');
});

for(const route of ['privacy','terms'])test(`${route} is a readable responsive legal document`,async({page})=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/'+route);
  const legalDocument=page.locator('.legalDocument');
  await expect(legalDocument).toBeVisible();
  const desktop=await legalDocument.boundingBox();
  expect(desktop.width).toBeGreaterThan(850);
  expect(await legalDocument.locator('section').count()).toBeGreaterThanOrEqual(13);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBeTruthy();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBeTruthy();
  const first=page.locator('.legalDocument section').first();
  const grid=await first.evaluate(node=>getComputedStyle(node).gridTemplateColumns);
  expect(grid.split(' ').length).toBe(1);
});