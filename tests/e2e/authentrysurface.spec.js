const {test,expect}=require('@playwright/test');
const base=process.env.GOJET_SURFACE_BASE||'http://127.0.0.1:4173';

async function noOverflow(page){const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));expect(size.scroll).toBeLessThanOrEqual(size.client+2)}

test.describe('focused customer account entry surface',()=>{
  for(const [path,title] of [['/login','欢迎回来'],['/register','开始使用 GoJet'],['/forgotpassword','重置登录密码'],['/resetpassword?token=surface-test','重置密码'],['/verifyemail?token=surface-test','验证邮箱']]){
    test(`${path} stays focused and compact`,async({page})=>{
      await page.goto(base+path);
      await expect(page.locator('.auth-brand')).toHaveText('GoJet.');
      await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
      await expect(page.locator('.auth-panel')).toBeVisible();
      const surface=await page.locator('.auth-panel').evaluate(node=>{
        const style=getComputedStyle(node),rect=node.getBoundingClientRect();
        return{width:rect.width,radius:parseFloat(style.borderRadius)||0,bg:style.backgroundColor,border:parseFloat(style.borderTopWidth)||0,shadow:style.boxShadow};
      });
      expect(surface.width).toBeLessThanOrEqual(400);
      // The requested S.EE-style account surface is intentionally page-level,
      // not a rounded SaaS card floating inside another marketing shell.
      expect(surface.radius).toBe(0);
      expect(surface.border).toBe(0);
      expect(surface.shadow).toBe('none');
      expect(['rgba(0, 0, 0, 0)','transparent']).toContain(surface.bg);
      const layout=await page.locator('.auth-page').evaluate(node=>{const style=getComputedStyle(node);return{bg:style.backgroundColor,paddingTop:parseFloat(style.paddingTop)}});
      expect(['rgba(0, 0, 0, 0)','transparent','rgb(255, 255, 255)']).toContain(layout.bg);
      expect(layout.paddingTop).toBeGreaterThanOrEqual(40);
      const documentSurface=await page.locator('body').evaluate(node=>getComputedStyle(node).backgroundColor);
      expect(documentSurface).toBe('rgb(255, 255, 255)');
      await noOverflow(page);
    })
  }
  test('login preserves password and email-code modes without layout duplication',async({page})=>{await page.route('**/api/public/account-policy',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({email_code_login_available:true})}));await page.route('**/api/public/auth/providers',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({providers:[]})}));await page.goto(base+'/login');const tabs=page.locator('.auth-mode-tabs');await expect(tabs).toBeVisible();await expect(tabs.getByRole('button')).toHaveCount(2);await tabs.getByRole('button',{name:'验证码登录'}).click();await expect(page.locator('#loginEmailCodeField')).toBeVisible();await expect(page.locator('input[name="password"]')).toBeHidden();await expect(page.getByRole('button',{name:'使用验证码登录'})).toBeVisible();await noOverflow(page)});
  test('customer registration can expose configured social adapters without hiding email registration',async({page})=>{await page.route('**/api/public/auth/providers',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({providers:[{id:'google',label:'Google'},{id:'facebook',label:'Facebook'},{id:'github',label:'GitHub'},{id:'qq',label:'QQ'},{id:'wechat',label:'微信'},{id:'rainbow',label:'彩虹聚合登录'}]})}));await page.route('**/api/public/settings',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({registration:{enabled:true}})}));await page.goto(base+'/register');await expect(page.locator('.social-provider')).toHaveCount(6);await expect(page.locator('#registerForm input[name="email"]')).toBeVisible();await expect(page.locator('#registerForm input[name="password"]')).toBeVisible();await noOverflow(page)});
  test('administrator sign-in never exposes customer social login',async({page})=>{await page.goto(base+'/admin/');await expect(page.getByLabel('管理员邮箱')).toBeVisible();await expect(page.getByLabel('密码')).toBeVisible();await expect(page.locator('.social-provider')).toHaveCount(0);await expect(page.locator('#socialAuth')).toHaveCount(0);await noOverflow(page)});
});