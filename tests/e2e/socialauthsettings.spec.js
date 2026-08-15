const {test,expect}=require('@playwright/test');
const base=process.env.GOJET_SURFACE_BASE||'http://127.0.0.1:4180';

async function adminLogin(page){await page.goto(base+'/admin/');await page.getByLabel('管理员邮箱').fill('owner@example.test');await page.getByLabel('密码').fill('OwnerPassword!2026');await expect(page.locator('.social-provider')).toHaveCount(0);await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.locator('#adminView')).toBeVisible();}
async function openSocialSettings(page){await page.locator('#nav [data-view="settings"]').click();const tab=page.locator('[data-socialauth-tab]');await expect(tab).toContainText('客户快捷登录');await tab.click();await expect(page.locator('[data-socialauth-form]')).toBeVisible();await expect(page.locator('[data-socialauth-pane]')).toContainText('管理后台不会使用这些快捷登录方式');}
async function choose(page,id,enabled=true){const picker=page.locator('[data-socialauth-picker]');if(!(await picker.evaluate(el=>el.open)))await picker.locator('summary').click();const input=picker.locator(`[data-social-enable="${id}"]`);if(enabled)await input.check();else await input.uncheck();const card=page.locator(`[data-social-provider="${id}"]`);if(enabled)await expect(card).toBeVisible();else await expect(card).toBeHidden();}
async function configure(page,id,{clientID,secret,baseURL,loginType}={}){const card=page.locator(`[data-social-provider="${id}"]`);if(!(await card.evaluate(el=>el.open)))await card.locator('summary').click();if(clientID!==undefined)await card.locator('input[name$="client_id"]').fill(clientID);if(secret!==undefined)await card.locator('input[name$="client_secret"]').fill(secret);if(baseURL!==undefined)await card.locator('input[name$="base_url"]').fill(baseURL);if(loginType!==undefined)await card.locator('select[name$="login_type"]').selectOption(loginType);}

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
  await configure(page,'rainbow',{clientID:'surface-rainbow-client',secret:'SurfaceRainbowSecret!2026',baseURL:'https://u.cccyun.cc',loginType:'qq'});
  await page.getByRole('button',{name:'保存设置',exact:true}).click();
  await expect(page.locator('[data-socialauth-picker-summary]')).toHaveText('已选择 6 个方式');
  await expect(page.locator('[data-social-provider="github"] input[name="auth.social.github.client_secret"]')).toHaveAttribute('placeholder','已配置，留空保持不变');
  await page.goto(base+'/login');await expect(page.locator('.social-provider')).toHaveCount(6);await expect(page.locator('.social-provider')).toHaveText(['继续使用 Google','继续使用 Facebook','继续使用 GitHub','继续使用 QQ','继续使用 微信','继续使用 彩虹聚合登录']);
  await page.goto(base+'/admin/');await expect(page.locator('#adminView')).toBeVisible();await expect(page.locator('.social-provider')).toHaveCount(0);await openSocialSettings(page);await choose(page,'facebook',false);await choose(page,'qq',false);await choose(page,'wechat',false);await choose(page,'rainbow',false);await page.getByRole('button',{name:'保存设置',exact:true}).click();
  await page.goto(base+'/login');await expect(page.locator('.social-provider')).toHaveCount(2);await expect(page.locator('.social-provider')).toHaveText(['继续使用 Google','继续使用 GitHub']);
});
