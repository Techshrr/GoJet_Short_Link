const {test,expect}=require('@playwright/test');
const base=process.env.GOJET_SURFACE_BASE||'http://127.0.0.1:4180';

async function adminLogin(page){await page.goto(base+'/admin/');await page.getByLabel('管理员邮箱').fill('owner@example.test');await page.getByLabel('密码').fill('OwnerPassword!2026');await expect(page.locator('.social-provider')).toHaveCount(0);await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.locator('#adminView')).toBeVisible();}
async function openSocialSettings(page){await page.locator('#nav [data-view="settings"]').click();const tab=page.locator('[data-socialauth-tab]');await expect(tab).toContainText('客户快捷登录');await tab.click();await expect(page.locator('[data-socialauth-form]')).toBeVisible();await expect(page.locator('[data-socialauth-pane]')).toContainText('管理后台不会使用这些快捷登录方式');}
async function choose(page,id,enabled=true){
  for(let attempt=0;attempt<4;attempt++){
    const picker=page.locator('[data-socialauth-picker]');
    await expect(picker).toBeVisible();
    if(!(await picker.evaluate(el=>el.open).catch(()=>false)))await picker.locator('summary').click();
    const input=picker.locator(`[data-social-enable="${id}"]`);
    try{
      await expect(input).toBeVisible({timeout:3000});
      if(enabled)await input.check({timeout:3000});else await input.uncheck({timeout:3000});
      await expect(input).toBeChecked({checked:enabled,timeout:3000});
      const card=page.locator(`[data-social-provider="${id}"]`);
      if(enabled)await expect(card).toBeVisible();else await expect(card).toBeHidden();
      return;
    }catch(err){
      if(attempt===3)throw err;
      await page.waitForTimeout(100);
    }
  }
}
async function configure(page,id,{clientID,secret,baseURL}={}){const card=page.locator(`[data-social-provider="${id}"]`);if(!(await card.evaluate(el=>el.open)))await card.locator('summary').click();if(clientID!==undefined)await card.locator('input[name$="client_id"]').fill(clientID);if(secret!==undefined)await card.locator('input[name$="client_secret"]').fill(secret);if(baseURL!==undefined)await card.locator('input[name$="base_url"]').fill(baseURL);}
async function saveSettings(page){const response=page.waitForResponse(res=>res.request().method()==='PUT'&&res.url().endsWith('/api/admin/settings/socialauth'));await page.getByRole('button',{name:'保存设置',exact:true}).click();expect((await response).status()).toBe(200);await expect(page.locator('[data-socialauth-form]')).toBeVisible();}
async function expectNativeLaunchRoutes(page){
  const expected={
    google:'https://accounts.google.com/o/oauth2/v2/auth?',
    facebook:'https://www.facebook.com/dialog/oauth?',
    github:'https://github.com/login/oauth/authorize?',
    qq:'https://graph.qq.com/oauth2.0/authorize?',
    wechat:'https://open.weixin.qq.com/connect/qrconnect?'
  };
  for(const [provider,prefix] of Object.entries(expected)){
    const response=await page.request.get(`${base}/api/public/auth/${provider}/start?redirect=%2Fapp%2Fdashboard`,{maxRedirects:0});
    expect(response.status(),`${provider} social start status`).toBe(302);
    expect(response.headers().location||'',`${provider} social start location`).toMatch(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`));
  }
}

async function expectSixCustomerProviders(page){
  const native=page.locator('.social-provider[data-provider]');
  await expect(native).toHaveCount(5);
  await expect(native).toHaveText(['继续使用 Google','继续使用 Facebook','继续使用 GitHub','继续使用 QQ','继续使用 微信']);
  const rainbow=page.locator('.social-provider-group');
  await expect(rainbow).toHaveCount(1);
  await expect(rainbow.locator('summary')).toHaveText('继续使用 彩虹聚合登录');
  await rainbow.locator('summary').click();
  const choices=rainbow.locator('.social-provider-sub');
  await expect(choices).toHaveCount(10);
  await expect(choices.nth(0)).toHaveText('QQ');
  await expect(choices.nth(1)).toHaveText('微信');
  await expect(choices.nth(2)).toHaveText('支付宝');
  await expect(choices.nth(0)).toHaveAttribute('href',/\/api\/public\/auth\/rainbow\/start\?.*type=qq/);
  await expect(choices.nth(1)).toHaveAttribute('href',/\/api\/public\/auth\/rainbow\/start\?.*type=wx/);
}

test('customer social login settings use compact multi-select and never change admin authentication',async({page})=>{
  await adminLogin(page);await openSocialSettings(page);
  for(const id of ['google','facebook','github','qq','wechat','rainbow'])await expect(page.locator(`[data-social-enable="${id}"]`)).toHaveCount(1);
  await choose(page,'google');await choose(page,'facebook');await choose(page,'github');await choose(page,'qq');await choose(page,'wechat');await choose(page,'rainbow');
  await expect(page.locator('[data-socialauth-picker-summary]')).toHaveText('已选择 6 个方式');
  await configure(page,'google',{clientID:'surface-google-client',secret:'SurfaceGoogleSecret!2026'});
  await configure(page,'facebook',{clientID:'surface-facebook-client',secret:'SurfaceFacebookSecret!2026'});
  await configure(page,'github',{clientID:'surface-github-client',secret:'SurfaceGitHubSecret!2026'});
  await configure(page,'qq',{clientID:'surface-qq-client',secret:'SurfaceQQSecret!2026'});
  await configure(page,'wechat',{clientID:'surface-wechat-client',secret:'SurfaceWechatSecret!2026'});
  await configure(page,'rainbow',{clientID:'surface-rainbow-client',secret:'SurfaceRainbowSecret!2026',baseURL:'https://login.example.com/connect.php'});
  const rainbowCard=page.locator('[data-social-provider="rainbow"]');
  await expect(rainbowCard.locator('input[name="auth.social.rainbow.base_url"]')).toHaveCount(1);
  await expect(rainbowCard.locator('input[name="auth.social.rainbow.client_id"]')).toHaveCount(1);
  await expect(rainbowCard.locator('input[name="auth.social.rainbow.client_secret"]')).toHaveCount(1);
  await expect(rainbowCard.locator('[name$="login_type"]')).toHaveCount(0);
  await expect(rainbowCard.getByText('开放平台回调地址')).toHaveCount(0);
  await saveSettings(page);
  await expect(page.locator('[data-socialauth-picker-summary]')).toHaveText('已选择 6 个方式');
  await expect(page.locator('[data-social-provider="github"] input[name="auth.social.github.client_secret"]')).toHaveAttribute('placeholder','已配置，留空保持不变');
  await expect(page.locator('[data-social-provider="rainbow"] input[name="auth.social.rainbow.client_secret"]')).toHaveAttribute('placeholder','已配置，留空保持不变');
  await expectNativeLaunchRoutes(page);
  await page.goto(base+'/login');await expectSixCustomerProviders(page);
  await page.goto(base+'/admin/');await expect(page.locator('#adminView')).toBeVisible();await expect(page.locator('.social-provider')).toHaveCount(0);await openSocialSettings(page);await choose(page,'facebook',false);await choose(page,'qq',false);await choose(page,'wechat',false);await choose(page,'rainbow',false);await saveSettings(page);
  await expect(page.locator('[data-socialauth-picker-summary]')).toHaveText('已选择 2 个方式');
  await page.goto(base+'/login');const remaining=page.locator('.social-provider[data-provider]');await expect(remaining).toHaveCount(2);await expect(remaining).toHaveText(['继续使用 Google','继续使用 GitHub']);await expect(page.locator('.social-provider-group')).toHaveCount(0);
});