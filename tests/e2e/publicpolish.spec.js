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
