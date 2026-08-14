const{test,expect}=require('@playwright/test');
const products=['urlshortener','biopages','textsharing','filesharing','analytics','qrcode','abtesting','customdomains','smartlinks','qrcampaigns'];
const genericRoutes=['about','contact','resources','developers','blog','solutions/marketing','solutions/creators','solutions/teams','browserextension','apps','changelog'];
const authRoutes=['login','register','forgotpassword','resetpassword?token=acceptancetoken','verifyemail?token=acceptancetoken'];
const publicPlans=[
  {id:1,code:'starter',name:'基础版',description:'适合个人试用与轻量分享',currency:'CNY',monthly_price_cents:0,link_limit:100,analytics_retention_days:30,member_limit:3,file_storage_bytes:1073741824,features:['100 条短链接','30 天分析数据','3 位团队成员']},
  {id:2,code:'pro',name:'专业版',description:'适合持续运营和专业使用',currency:'CNY',monthly_price_cents:5900,link_limit:5000,analytics_retention_days:180,member_limit:10,file_storage_bytes:10737418240,features:['100 条短链接','30 天分析数据','3 位团队成员','智能路由与 A/B 测试']},
  {id:3,code:'business',name:'商业版',description:'适合多人团队与业务协作',currency:'CNY',monthly_price_cents:19900,link_limit:50000,analytics_retention_days:730,member_limit:50,file_storage_bytes:53687091200,features:['100 条短链接','30 天分析数据','3 位团队成员','智能路由与 A/B 测试','优先支持']}
];
test.beforeEach(async({page})=>{
  await page.route('**/api/public/settings',route=>route.fulfill({contentType:'application/json',body:'{}'}));
  await page.route('**/api/public/plans',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({data:publicPlans})}));
  await page.route('**/api/public/announcement-bar',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({enabled:false})}));
});

for(const product of products)test(`${product} has complete product narrative`,async({page})=>{
  await page.goto(`/products/${product}`);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.hero .productVisual')).toBeVisible();
  await expect(page.locator('.productBenefits .productBenefit')).toHaveCount(3);
  await expect(page.locator('.productFeatureGrid .productFeature')).toHaveCount(3);
  await expect(page.locator('.productSteps .productStep')).toHaveCount(3);
  await expect(page.locator('.mk-faq details')).toHaveCount(3);
  await expect(page.getByRole('link',{name:'查看使用文档'})).toHaveAttribute('href','/docs/');
  await expect(page.locator('.ctaBox')).toBeVisible();
  await expect(page.locator('footer[data-gojet-shell]')).toBeVisible();
});

for(const width of [1440,768,390])test(`homepage responsive at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBeTruthy();
});

for(const width of [1440,768,390])test(`all product pages are responsive at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  for(const product of products){
    await page.goto(`/products/${product}`);
    await expect(page.locator('h1')).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
    expect(overflow,`${product} overflow at ${width}px`).toBeFalsy();
  }
});

for(const width of [1440,768,390])test(`authentication pages are responsive and branded at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900});
  for(const route of authRoutes){
    await page.goto(`/${route}`);
    await expect(page.getByText('GoJet',{exact:false}).first()).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
    expect(overflow,`${route} overflow at ${width}px`).toBeFalsy();
    await expect(page.locator('body')).not.toContainText(/PRODUCT|DEMO|DEBUG|FRESH INSTALL|CONTROL CENTER/i);
  }
});

test('saved brand and SEO settings apply without rebuilding pages',async({page})=>{
  await page.unroute('**/api/public/settings');
  await page.route('**/api/public/settings',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({'site.name':'Acme GoJet','brand.logo_url':'/assets/testlogo.png','brand.primary_color':'#9b2c2c','seo.default_title':'Acme Links','seo.meta_description':'Saved description'})}));
  await page.route('**/assets/testlogo.png',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="32"><rect width="120" height="32" rx="6" fill="#9b2c2c"/></svg>'}));
  await page.goto('/');
  await expect(page).toHaveTitle('Acme Links');
  await expect(page.locator('.logo img').first()).toHaveAttribute('src','/assets/testlogo.png');
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--blue').trim())).toBe('#9b2c2c');
  await expect(page.locator('meta[name=description]')).toHaveAttribute('content','Saved description');
});

for(const route of genericRoutes)test(`${route} public route is complete`,async({page})=>{
  await page.goto(`/${route}`);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.section .cards .card')).toHaveCount(3);
  await expect(page.locator('.ctaBox')).toBeVisible();
  await expect(page.locator('footer[data-gojet-shell]')).toBeVisible();
});

test('documentation center is searchable and task oriented',async({page})=>{
  await page.goto('/docs');
  await expect(page.getByRole('heading',{name:'从第一次创建，到日常运营'})).toBeVisible();
  await expect(page.locator('#docsNav')).toBeVisible();
  expect(await page.locator('.docsArticle').count()).toBeGreaterThanOrEqual(16);
  await expect(page.locator('#docsSearch')).toBeVisible();
  await expect(page.getByRole('heading',{name:'文本分享',exact:true})).toBeVisible();
  await expect(page.getByText('纯文本',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('Markdown',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('代码',{exact:true}).first()).toBeVisible();
  await page.locator('#docsSearch').fill('自定义域名');
  await expect(page.locator('#docsSearchResults')).toContainText('自定义域名');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBeTruthy();
});

test('pricing public route is driven by the active plan catalog',async({page})=>{
  await page.goto('/pricing');
  await expect(page.getByRole('heading',{name:'从个人使用，到团队协作'})).toBeVisible();
  await expect(page.locator('.pricing .livePlanCard')).toHaveCount(3);
  await expect(page.getByRole('heading',{name:'基础版'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'专业版'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'商业版'})).toBeVisible();
  await expect(page.locator('.planCompareList').first()).toBeVisible();
  await expect(page.locator('.planQuota').first()).toBeVisible();
  await expect(page.locator('footer[data-gojet-shell]')).toBeVisible();
});

test('signed-in pricing never shows guest login or registration CTAs',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('gojet_token','signed-in-test-token'));
  await page.route('**/api/me',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({id:7,email:'owner@example.test',display_name:'TechShr'})}));
  await page.goto('/pricing');
  await expect(page.locator('.pricing .livePlanCard')).toHaveCount(3);
  await expect(page.getByRole('link',{name:'登录账户'})).toHaveCount(0);
  await expect(page.locator('main a[href="/register"]')).toHaveCount(0);
  await expect(page.locator('[data-plan-cta]')).toHaveCount(3);
  await expect(page.locator('[data-plan-cta]').first()).toHaveAttribute('href','/app/billing');
  await expect(page.locator('[data-account-nav]')).toContainText('TechShr');
});

test('register public route is complete',async({page})=>{
  await page.goto('/register');
  await expect(page.getByRole('heading',{name:'开始使用 GoJet'})).toBeVisible();
  await expect(page.locator('form')).toBeVisible();
  await expect(page.locator('.auth-foot')).toBeVisible();
});

test('Markdown announcement center safely renders published content',async({page})=>{
  const unsafe='<scr'+'ipt>window.__announcement_xss=1</scr'+'ipt>';
  await page.route('**/api/public/announcements',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({data:[{id:1,title:'计划维护通知',body_markdown:'# 维护安排\n\n**影响范围**\n\n- 管理控制台\n- 账单中心\n\n[查看状态](https://status.example.test)\n\n'+unsafe,published_at:'2026-08-10T10:00:00Z'}]})}));
  await page.goto('/announcements');
  await expect(page.getByRole('heading',{name:'平台公告'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'计划维护通知'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'维护安排'})).toBeVisible();
  await expect(page.getByText('影响范围',{exact:true})).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await expect(page.getByRole('link',{name:'查看状态'})).toHaveAttribute('href','https://status.example.test');
  expect(await page.evaluate(()=>window.__announcement_xss)).toBeUndefined();
  await expect(page.locator('.announcement-body script')).toHaveCount(0);
  await expect(page.locator('.announcement-body')).toContainText(unsafe);
  await expect(page.locator('body')).not.toContainText('ANNOUNCEMENTS');
});

test('status page renders real component response',async({page})=>{
  await page.route('**/api/public/status',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({status:'degraded',checked_at:'2026-08-02T12:00:00Z',components:{database:{status:'operational'},redirect_analytics:{status:'operational',stream_events:12},mail:{status:'degraded',failed:2,queued:3}}})}));
  await page.goto('/status');
  await expect(page.getByText('MySQL 数据库')).toBeVisible();
  await expect(page.getByText('性能下降').first()).toBeVisible();
  await expect(page.getByText('失败 2 · 队列 3')).toBeVisible();
});