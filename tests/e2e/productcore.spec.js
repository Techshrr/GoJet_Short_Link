const { test, expect } = require('@playwright/test');

const base='http://127.0.0.1:4173';

async function adminLogin(page){
  await page.goto(base+'/admin/');
  await page.getByLabel('管理员邮箱').fill('owner@example.test');
  await page.getByLabel('密码').fill('OwnerPassword!2026');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.getByText('平台概览',{exact:true}).first()).toBeVisible();
}

async function userLoginState(page){
  await page.goto(base+'/login');
  await page.evaluate(()=>localStorage.setItem('gojet_token','u'.repeat(64)));
}

test('admin login fails closed without JavaScript and never exposes credentials in URL',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});
  const page=await context.newPage();
  await page.goto(base+'/admin/');
  const form=page.locator('#loginForm');
  await expect(form).toHaveAttribute('method','post');
  await expect(form).toHaveAttribute('action','/api/admin/auth/login');
  await page.getByLabel('管理员邮箱').fill('fallback@example.test');
  await page.getByLabel('密码').fill('FallbackPassword!2026');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await page.waitForURL(/\/api\/admin\/auth\/login$/);
  expect(page.url()).not.toContain('email=');
  expect(page.url()).not.toContain('password=');
  await context.close();
});

test('public account routes are dedicated pages',async({page})=>{
  await page.goto(base+'/login');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading',{name:'欢迎回来'})).toBeVisible();
  await expect(page.getByRole('link',{name:'忘记密码？'})).toHaveAttribute('href','/forgotpassword');

  await page.goto(base+'/register');
  await expect(page.getByRole('heading',{name:'开始使用 GoJet'})).toBeVisible();

  await page.goto(base+'/forgotpassword');
  await expect(page.getByRole('heading',{name:'忘记密码？'})).toBeVisible();

  await page.goto(base+'/resetpassword?token=test-token');
  await expect(page.getByRole('heading',{name:'重置密码'})).toBeVisible();
});

test('marketing homepage and legal pages use the canonical customer-facing shell',async({page})=>{
  await page.goto(base+'/');
  await expect(page.getByRole('heading',{name:'让链接更短，让分享更有价值'})).toBeVisible();
  for(const text of ['短链接','访问分析','二维码','个人主页','文本分享','文件分享']){
    await expect(page.locator('main .mk-product').filter({hasText:text}).first()).toBeVisible();
  }
  await expect(page.locator('header.siteHeader .logo')).toBeVisible();
  await expect(page.getByRole('link',{name:'套餐价格'})).toBeVisible();
  await expect(page.getByRole('link',{name:'隐私政策'}).last()).toHaveAttribute('href','/privacy');
  await expect(page.getByRole('link',{name:'服务条款'}).last()).toHaveAttribute('href','/terms');
  const homeText=await page.locator('body').innerText();
  for(const forbidden of ['Fresh Install','Worker','Redis','MySQL','V4 产品重构基线','真实后端闭环'])expect(homeText).not.toContain(forbidden);

  await page.goto(base+'/privacy');
  await expect(page.getByRole('heading',{name:'隐私政策'})).toBeVisible();
  await expect(page.getByRole('heading',{name:/我们处理的信息/})).toBeVisible();
  await expect(page.locator('header.siteHeader .logo')).toBeVisible();
  await expect(page.getByRole('link',{name:'服务条款'}).last()).toBeVisible();

  await page.goto(base+'/terms');
  await expect(page.getByRole('heading',{name:'服务条款'})).toBeVisible();
  await expect(page.getByRole('heading',{name:/禁止行为/})).toBeVisible();
  await expect(page.locator('header.siteHeader .logo')).toBeVisible();
  await expect(page.getByRole('link',{name:'隐私政策'}).last()).toBeVisible();
});

test('/app is never the interactive login page',async({page})=>{
  await page.goto(base+'/app/dashboard');
  await page.waitForURL(/\/login\?redirect=/);
  await expect(page.getByRole('heading',{name:'欢迎回来'})).toBeVisible();
  expect(page.url()).toContain('redirect=%2Fapp%2Fdashboard');
});

test('admin users page exposes actual management actions',async({page})=>{
  await adminLogin(page);
  await page.getByRole('button',{name:'用户管理',exact:true}).click();
  await expect(page.getByRole('button',{name:'添加用户'})).toBeVisible();
  const manage=page.getByRole('button',{name:'管理',exact:true});
  await expect(manage).toBeVisible();
  await manage.click();
  for(const text of ['编辑资料','取消邮箱验证','发送密码重置','强制退出全部会话','封禁用户','删除用户']){
    await expect(page.locator('#modalBody')).toContainText(text);
  }
});

test('admin files and security pages expose operational actions',async({page})=>{
  await adminLogin(page);
  await page.getByRole('button',{name:'文件安全',exact:true}).click();
  await expect(page.getByRole('button',{name:'重新扫描'})).toBeVisible();
  await expect(page.getByRole('button',{name:'强制隔离'})).toBeVisible();

  await page.getByRole('button',{name:'安全事件',exact:true}).click();
  await expect(page.getByRole('button',{name:'标记已读'}).first()).toBeVisible();
});

test('admin system settings follows the final nested information architecture',async({page})=>{
  await adminLogin(page);
  await page.getByRole('button',{name:'系统设置',exact:true}).click();
  await expect(page.getByRole('heading',{name:'系统设置'})).toBeVisible();

  for(const label of ['网站名称','网站简称','联系邮箱','公司名称']){
    await expect(page.getByLabel(label)).toBeVisible();
  }

  await page.getByRole('button',{name:/^短链接/}).click();
  await expect(page.getByLabel('默认跳转方式')).toBeVisible();

  await page.getByRole('button',{name:/^支付方式/}).click();
  await expect(page.getByText('Stripe',{exact:true})).toBeVisible();

  await page.getByRole('button',{name:/^邮件服务/}).click();
  await expect(page.getByRole('heading',{name:'邮件服务',exact:true})).toBeVisible();
  await expect(page.getByLabel('SMTP Host')).toBeVisible();

  await page.getByRole('button',{name:/^人机验证/}).click();
  await expect(page.getByRole('heading',{name:'人机验证',exact:true})).toBeVisible();
  await expect(page.getByLabel('Site Key')).toBeVisible();
  await expect(page.getByLabel('Secret Key')).toBeVisible();
});

test('admin action does not rely on backend placeholder responses',async({page})=>{
  await adminLogin(page);
  const responses=[];
  page.on('response',async r=>{if(r.url().includes('/api/admin/')){try{responses.push({url:r.url(),text:await r.text()})}catch{}}});
  await page.getByRole('button',{name:'系统状态',exact:true}).click();
  await page.waitForTimeout(150);
  for(const item of responses){
    expect(item.text.toLowerCase()).not.toContain('not implemented');
    expect(item.text.toLowerCase()).not.toContain('placeholder');
  }
});
