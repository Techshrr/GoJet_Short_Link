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
  await expect(page.getByRole('link',{name:'忘记密码？'})).toHaveAttribute('href','/forgot-password');

  await page.goto(base+'/register');
  await expect(page.getByRole('heading',{name:'开始使用 GoJet'})).toBeVisible();

  await page.goto(base+'/forgot-password');
  await expect(page.getByRole('heading',{name:'重置登录密码'})).toBeVisible();

  await page.goto(base+'/reset-password?token=test-token');
  await expect(page.getByRole('heading',{name:'重置密码'})).toBeVisible();
});

test('marketing homepage is product-first and shortener keeps the pending URL',async({page})=>{
  await page.goto(base+'/');
  await expect(page.getByRole('heading',{name:/管理每一个链接/})).toBeVisible();
  for(const text of ['短链接','访问分析','二维码','个人主页','文本分享','文件分享']){
    await expect(page.getByText(text,{exact:true}).first()).toBeVisible();
  }
  await page.getByPlaceholder(/粘贴需要缩短的网址/).fill('https://example.com/landing');
  await page.getByRole('button',{name:/创建短链接/}).click();
  await expect(page.locator('#shortResult')).toContainText('创建账户后会自动带入刚才的长网址');
  await page.waitForURL(/\/register\?redirect=/);
  expect(new URL(page.url()).searchParams.get('redirect')).toBe('/app/links');
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
  await page.getByRole('button',{name:'用户管理',exact:true}).click();
  await expect(page.getByRole('button',{name:'添加用户'})).toBeVisible();
  const manage=page.getByRole('button',{name:'管理',exact:true});
  await expect(manage).toBeVisible();
  await manage.click();
  for(const text of ['编辑资料','取消邮箱验证','发送密码重置','强制退出全部会话','封禁用户','删除用户']){
    await expect(page.getByRole('button',{name:text})).toBeVisible();
  }
});

test('administrator permissions include explicit ticket management and super admin remains all-powerful',async({page})=>{
  await adminLogin(page);
  await page.getByRole('button',{name:'管理员与权限'}).click();
  await expect(page.getByText('全部权限',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'添加管理员'}).click();
  await expect(page.getByText('权限',{exact:true})).toBeVisible();
  await expect(page.getByText('用户管理',{exact:true}).last()).toBeVisible();
  await expect(page.getByText('工单管理',{exact:true}).last()).toBeVisible();
});

test('announcement editing is Markdown UI, never prompt boxes',async({page})=>{
  await adminLogin(page);
  await page.getByRole('button',{name:'公告管理',exact:true}).click();
  await page.getByRole('button',{name:'创建公告'}).click();
  await expect(page.getByText('Markdown 正文',{exact:true})).toBeVisible();
  await page.locator('#announcementBody').fill('# 系统公告\n\n**Markdown** 内容。');
  await expect(page.locator('#announcementPreview h1')).toHaveText('系统公告');
  await expect(page.locator('#announcementPreview strong')).toHaveText('Markdown');
});

test('operations page has direct actions without mandatory reason fields',async({page})=>{
  await adminLogin(page);
  await page.getByRole('button',{name:'系统状态',exact:true}).click();
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
  await page.getByRole('button',{name:'邮件服务',exact:true}).click();
  await page.getByLabel('SMTP Host').fill('smtp.example.test');
  await page.getByLabel('发件邮箱').fill('noreply@example.test');
  await page.getByRole('button',{name:'保存 SMTP'}).click();
  await expect(page.locator('#toast')).toContainText('SMTP 设置已保存');
  await expect(page.locator('#modal')).toHaveClass(/hidden/);
});

test('system settings expose the current editable policy surface',async({page})=>{
  await adminLogin(page);
  await page.getByRole('button',{name:'系统设置',exact:true}).click();
  for(const text of ['站点信息','搜索与分享','注册与账户','短链接','支付方式','品牌与视觉']){
    await expect(page.getByRole('button',{name:new RegExp(text)})).toBeVisible();
  }
  await page.getByRole('button',{name:/注册与账户/}).click();
  await expect(page.getByText('允许新用户注册',{exact:true})).toBeVisible();
  await expect(page.getByText('注册后验证邮箱',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'保存设置'}).filter({visible:true})).toBeVisible();
});

test('admin support queue provides WHMCS-style conversation and internal notes',async({page})=>{
  await adminLogin(page);
  await page.getByRole('button',{name:'客户工单',exact:true}).click();
  await expect(page.getByText('GJ-260811-A1B2C3D4',{exact:true})).toBeVisible();
  await expect(page.getByText('短链接跳转问题',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'查看'}).click();
  await expect(page.getByRole('heading',{name:/GJ-260811-A1B2C3D4/})).toBeVisible();
  await expect(page.getByText('仅管理员可见的内部备注',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'发送'})).toBeVisible();
});

test('Turnstile control center masks secret and exposes per-surface switches',async({page})=>{
  await adminLogin(page);
  await page.getByRole('button',{name:'人机验证',exact:true}).click();
  const form=page.locator('#botProtectionForm');
  await expect(form.getByText('统一控制 Cloudflare Turnstile',{exact:false})).toBeVisible();
  await expect(form.getByLabel('Secret Key')).toHaveValue('');
  for(const text of ['注册','登录','忘记密码','重置密码','创建工单','工单回复','滥用举报']){
    await expect(form.getByText(text,{exact:true})).toBeVisible();
  }
  await form.getByLabel('Site Key').fill('1x00000000000000000000AA');
  await form.getByRole('button',{name:'保存人机验证设置'}).click();
  await expect(page.locator('#toast')).toContainText('人机验证设置已保存');
});

test('customer console has ticket list, new ticket and threaded detail',async({page})=>{
  await userLoginState(page);
  await page.goto(base+'/app/support');
  await expect(page.getByRole('heading',{name:'支持工单'})).toBeVisible();
  await expect(page.getByText('GJ-260811-A1B2C3D4',{exact:true})).toBeVisible();
  await page.getByText('GJ-260811-A1B2C3D4',{exact:true}).click();
  await expect(page.getByRole('heading',{name:/GJ-260811-A1B2C3D4/})).toBeVisible();
  await expect(page.getByText('访问短链接时出现异常，请协助检查。',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'关闭工单'})).toBeVisible();
  await page.getByRole('button',{name:'返回列表'}).click();
  await page.getByRole('button',{name:'新建工单'}).click();
  await expect(page.getByRole('heading',{name:'新建支持工单'})).toBeVisible();
  await expect(page.getByLabel('支持部门')).toBeVisible();
});