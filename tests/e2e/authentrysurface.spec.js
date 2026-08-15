const {test,expect}=require('@playwright/test');
const base=process.env.GOJET_SURFACE_BASE||'http://127.0.0.1:4173';

async function noOverflow(page){const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));expect(size.scroll).toBeLessThanOrEqual(size.client+2)}

async function expectSplitEntry(page,path,title){
  await page.setViewportSize({width:1440,height:900});
  await page.goto(base+path);
  await expect(page.locator('.auth-brand')).toHaveText('GoJet.');
  await expect(page.getByRole('link',{name:'返回网站'})).toBeVisible();
  await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
  await expect(page.locator('.auth-shell')).toBeVisible();
  await expect(page.locator('.auth-showcase')).toBeVisible();
  await expect(page.locator('.auth-form-panel')).toBeVisible();
  const geometry=await page.evaluate(()=>{
    const showcase=document.querySelector('.auth-showcase').getBoundingClientRect();
    const form=document.querySelector('.auth-form-panel').getBoundingClientRect();
    const panel=document.querySelector('.auth-panel').getBoundingClientRect();
    const back=document.querySelector('.auth-return').getBoundingClientRect();
    const formStyle=getComputedStyle(document.querySelector('.auth-form-panel'));
    return{showcase:{x:showcase.x,width:showcase.width,right:showcase.right},form:{x:form.x,width:form.width,radius:parseFloat(formStyle.borderRadius)||0},panel:{width:panel.width},back:{left:back.left,right:back.right,top:back.top},viewport:innerWidth};
  });
  expect(geometry.showcase.width).toBeGreaterThan(600);
  expect(geometry.form.width).toBeGreaterThan(650);
  expect(geometry.form.x).toBeGreaterThanOrEqual(geometry.showcase.right-2);
  expect(geometry.form.radius).toBeGreaterThanOrEqual(16);
  expect(geometry.panel.width).toBeGreaterThan(440);
  expect(geometry.panel.width).toBeLessThanOrEqual(660);
  expect(geometry.showcase.width+geometry.form.width).toBeGreaterThan(geometry.viewport*.96);
  expect(geometry.back.right).toBeLessThanOrEqual(geometry.showcase.right-20);
  expect(geometry.back.right).toBeGreaterThanOrEqual(geometry.showcase.right-170);
  expect(geometry.back.left).toBeGreaterThan(geometry.showcase.x+120);
  expect(geometry.back.top).toBeGreaterThanOrEqual(20);
  expect(geometry.back.top).toBeLessThanOrEqual(55);
  await noOverflow(page);
}

test.describe('customer account entry surface',()=>{
  test('login uses a full-height split branded entry layout',async({page})=>{await expectSplitEntry(page,'/login','欢迎回来')});
  test('registration uses the same split layout',async({page})=>{await expectSplitEntry(page,'/register','开始使用 GoJet')});
  test('forgot password uses the same split layout',async({page})=>{await expectSplitEntry(page,'/forgotpassword','忘记密码？')});
  test('reset password continues the same split account journey',async({page})=>{await expectSplitEntry(page,'/resetpassword?token=surface-test','重置密码')});

  test('email verification remains a clean lightweight account surface',async({page})=>{
    await page.goto(base+'/verifyemail?token=surface-test');
    await expect(page.locator('.auth-brand')).toHaveText('GoJet.');
    await expect(page.getByRole('heading',{name:'验证邮箱',exact:true})).toBeVisible();
    const surface=await page.locator('.auth-panel').evaluate(node=>{const style=getComputedStyle(node),rect=node.getBoundingClientRect();return{width:rect.width,radius:parseFloat(style.borderRadius)||0,border:parseFloat(style.borderTopWidth)||0,shadow:style.boxShadow};});
    expect(surface.width).toBeLessThanOrEqual(440);
    expect(surface.radius).toBe(0);
    expect(surface.border).toBe(0);
    expect(surface.shadow).toBe('none');
    await noOverflow(page);
  });

  test('split entry layout collapses cleanly on mobile',async({page})=>{
    await page.setViewportSize({width:390,height:844});
    await page.goto(base+'/login');
    await expect(page.locator('.auth-showcase')).toBeHidden();
    await expect(page.locator('.auth-form-panel')).toBeVisible();
    await expect(page.getByRole('link',{name:'返回网站'})).toBeVisible();
    const geometry=await page.evaluate(()=>{const panel=document.querySelector('.auth-form-panel').getBoundingClientRect(),style=getComputedStyle(document.querySelector('.auth-form-panel')),back=document.querySelector('.auth-return').getBoundingClientRect();return{panel:{x:panel.x,width:panel.width,radius:parseFloat(style.borderRadius)||0},back:{left:back.left,right:back.right,top:back.top}}});
    expect(geometry.panel.x).toBe(0);expect(geometry.panel.width).toBe(390);expect(geometry.panel.radius).toBe(0);
    expect(geometry.back.right).toBeLessThanOrEqual(370);expect(geometry.back.left).toBeGreaterThan(200);expect(geometry.back.top).toBeGreaterThanOrEqual(18);expect(geometry.back.top).toBeLessThanOrEqual(38);
    await noOverflow(page);
  });

  test('login preserves password and email-code modes without layout duplication',async({page})=>{await page.route('**/api/public/account-policy',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({email_code_login_available:true})}));await page.route('**/api/public/auth/providers',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({providers:[]})}));await page.goto(base+'/login');const tabs=page.locator('.auth-mode-tabs');await expect(tabs).toBeVisible();await expect(tabs.getByRole('button')).toHaveCount(2);await tabs.getByRole('button',{name:'验证码登录'}).click();await expect(page.locator('#loginEmailCodeField')).toBeVisible();await expect(page.locator('input[name="password"]')).toBeHidden();await expect(page.getByRole('button',{name:'使用验证码登录'})).toBeVisible();await noOverflow(page)});
  test('customer registration can expose configured social adapters without hiding email registration',async({page})=>{await page.route('**/api/public/auth/providers',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({providers:[{id:'google',label:'Google'},{id:'facebook',label:'Facebook'},{id:'github',label:'GitHub'},{id:'qq',label:'QQ'},{id:'wechat',label:'微信'},{id:'rainbow',label:'企业快捷登录',login_types:[{id:'qq',label:'QQ'}]}]})}));await page.route('**/api/public/settings',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({registration:{enabled:true}})}));await page.goto(base+'/register');await expect(page.locator('.social-provider')).toHaveCount(6);await expect(page.locator('.social-provider').last()).toHaveText('继续使用 企业快捷登录');await expect(page.locator('#registerForm input[name="email"]')).toBeVisible();await expect(page.locator('#registerForm input[name="password"]')).toBeVisible();await noOverflow(page)});
  test('administrator sign-in never exposes customer social login',async({page})=>{await page.goto(base+'/admin/');await expect(page.getByLabel('管理员邮箱')).toBeVisible();await expect(page.getByLabel('密码')).toBeVisible();await expect(page.locator('.social-provider')).toHaveCount(0);await expect(page.locator('#socialAuth')).toHaveCount(0);await noOverflow(page)});
});