const { test, expect } = require('@playwright/test');

const base='http://127.0.0.1:4173';

async function adminLogin(page){
  await page.goto(base+'/admin/');
  await page.getByLabel('管理员邮箱').fill('owner@example.test');
  await page.getByLabel('密码').fill('OwnerPassword!2026');
  await page.getByRole('button',{name:'登录后台'}).click();
  await expect(page.getByText('平台概览',{exact:true}).first()).toBeVisible();
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
  await page.getByRole('button',{name:'登录后台'}).click();
  await page.waitForURL(/\/api\/admin\/auth\/login$/);
  expect(page.url()).not.toContain('email=');
  expect(page.url()).not.toContain('password=');
  await context.close();
});

test('public account routes are dedicated pages',async({page})=>{
  await page.goto(base+'/login');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading',{name:'欢迎回来'})).toBeVisible();
  await expect(page.getByRole('link',{name:'忘记密码？'})).toHaveAttribute('href','/forgot-password');

  await page.goto(base+'/register');
  await expect(page.getByRole('heading',{name:'创建 GoJet 账户'})).toBeVisible();

  await page.goto(base+'/forgot-password');
  await expect(page.getByRole('heading',{name:'找回密码'})).toBeVisible();

  await page.goto(base+'/reset-password?token=test-token');
  await expect(page.getByRole('heading',{name:'设置新密码'})).toBeVisible();
});

test('marketing homepage is product-first and shortener is a real entry flow',async({page})=>{
  await page.goto(base+'/');
  await expect(page.getByRole('heading',{name:/一个链接/})).toBeVisible();
  for(const text of ['URL Shortener','Link Analytics','QR Codes','Link in Bio','Text Sharing','File Sharing']){
    await expect(page.getByText(text,{exact:true}).first()).toBeVisible();
  }
  await page.getByPlaceholder(/粘贴一个长链接/).fill('https://example.com/landing');
  await page.getByRole('button',{name:'立即缩短'}).click();
  await expect(page.locator('#shortResult')).toContainText('创建 GoJet 账户');
  await page.waitForURL(/\/register$/);
  const pending=await page.evaluate(()=>localStorage.getItem('gojet_pending_url'));
  expect(pending).toBe('https://example.com/landing');
});

test('/app is never the interactive login page',async({page})=>{
  await page.goto(base+'/app/dashboard');
  await page.waitForURL(/\/login\?redirect=/);
  await expect(page.getByRole('heading',{name:'欢迎回来'})).toBeVisible();
  expect(page.url()).toContain('redirect=%2Fapp%2Fdashboard');
});

test('admin users page exposes actual management actions',async({page})=>{
  await adminLogin(page);
  await page.getByRole('button',{name:'用户管理'}).click();
  await expect(page.getByRole('button',{name:'添加用户'})).toBeVisible();
  const manage=page.getByRole('button',{name:'管理',exact:true});
  await expect(manage).toBeVisible();
  await manage.click();
  for(const text of ['编辑资料','取消邮箱验证','发送密码重置','强制退出全部会话','封禁用户','删除用户']){
    await expect(page.getByRole('button',{name:text})).toBeVisible();
  }
});

test('administrator permissions are explicit and super admin is all-powerful',async({page})=>{
  await adminLogin(page);
  await page.getByRole('button',{name:'管理员与权限'}).click();
  await expect(page.getByText('全部权限',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'添加管理员'}).click();
  await expect(page.getByText('权限',{exact:true})).toBeVisible();
  await expect(page.getByText('用户管理',{exact:true}).last()).toBeVisible();
  await expect(page.getByText('工作区管理',{exact:true}).last()).toBeVisible();
  await expect(page.getByText('域名管理',{exact:true}).last()).toBeVisible();
});

test('announcement editing is Markdown UI, never prompt boxes',async({page})=>{
  await adminLogin(page);
  await page.getByRole('button',{name:'公告运营'}).click();
  await page.getByRole('button',{name:'创建公告'}).click();
  await expect(page.getByText('Markdown 正文',{exact:true})).toBeVisible();
  await page.locator('#announcementBody').fill('# 系统公告\n\n**Markdown** 内容。');
  await expect(page.locator('#announcementPreview h1')).toHaveText('系统公告');
  await expect(page.locator('#announcementPreview strong')).toHaveText('Markdown');
});

test('operations page has direct actions without mandatory reason fields',async({page})=>{
  await adminLogin(page);
  await page.getByRole('button',{name:'系统运维'}).click();
  await expect(page.getByRole('button',{name:'执行平台对账'})).toBeVisible();
  await expect(page.getByRole('button',{name:'清理应用缓存'})).toBeVisible();
  await expect(page.getByRole('button',{name:'开启维护模式'})).toBeVisible();
  await expect(page.getByText('执行原因')).toHaveCount(0);
  await expect(page.getByText('变更原因')).toHaveCount(0);
  await page.getByRole('button',{name:'开启维护模式'}).click();
  await expect(page.getByText('维护说明（可选）')).toBeVisible();
  await expect(page.getByText('预计恢复时间（可选）')).toBeVisible();
});

test('mail templates and SMTP save are ordinary admin operations',async({page})=>{
  await adminLogin(page);
  await page.getByRole('button',{name:'邮件中心'}).click();
  await page.getByLabel('SMTP Host').fill('smtp.example.test');
  await page.getByLabel('发件邮箱').fill('noreply@example.test');
  await page.getByRole('button',{name:'保存 SMTP'}).click();
  await expect(page.locator('#toast')).toContainText('SMTP 设置已保存');
  await expect(page.locator('#modal')).toHaveClass(/hidden/);
});

test('system settings expose the full editable policy surface',async({page})=>{
  await adminLogin(page);
  await page.getByRole('button',{name:'系统设置'}).click();
  await expect(page.getByText('短链接默认策略',{exact:true})).toBeVisible();
  await expect(page.getByText('Analytics 与隐私',{exact:true})).toBeVisible();
  await expect(page.getByText('注册、登录与安全',{exact:true})).toBeVisible();
  await expect(page.getByText('API 与缓存',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'保存短链接默认策略'})).toBeVisible();
});