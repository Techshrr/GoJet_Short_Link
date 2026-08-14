const {test,expect}=require('@playwright/test');
const base=process.env.GOJET_SURFACE_BASE||'http://127.0.0.1:4180';

async function adminLogin(page){
  await page.goto(base+'/admin/');
  await page.getByLabel('管理员邮箱').fill('owner@example.test');
  await page.getByLabel('密码').fill('OwnerPassword!2026');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.locator('#adminView')).toBeVisible();
}

async function openSocialSettings(page){
  await page.locator('#nav [data-view="settings"]').click();
  const tab=page.locator('[data-socialauth-tab]');
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(page.locator('[data-socialauth-form]')).toBeVisible();
}

async function configureProvider(card,{enabled=true,clientID,secret}){
  const isOpen=await card.evaluate(element=>element.open);
  if(!isOpen)await card.locator('summary').click();
  const enabledInput=card.locator('input[type="checkbox"]');
  if(enabled)await enabledInput.check();else await enabledInput.uncheck();
  if(clientID!==undefined)await card.locator('input[name$="client_id"]').fill(clientID);
  if(secret!==undefined)await card.locator('input[name$="client_secret"]').fill(secret);
}

test('social login settings expose implemented Google and GitHub providers only when complete and enabled',async({page})=>{
  await adminLogin(page);
  await openSocialSettings(page);

  const github=page.locator('[data-social-provider="github"]');
  const google=page.locator('[data-social-provider="google"]');
  const facebook=page.locator('[data-social-provider="facebook"]');
  await expect(github).toContainText('适配器已启用');
  await expect(google).toContainText('适配器已启用');
  await expect(facebook).toContainText('适配器待接入');

  await configureProvider(github,{clientID:'surface-github-client',secret:'SurfaceGitHubSecret!2026'});
  await configureProvider(google,{clientID:'surface-google-client',secret:'SurfaceGoogleSecret!2026'});
  await page.getByRole('button',{name:'保存设置',exact:true}).click();

  await expect(page.locator('[data-social-provider="github"]')).toContainText('前台可用');
  await expect(page.locator('[data-social-provider="google"]')).toContainText('前台可用');
  await expect(page.locator('[data-social-provider="github"] input[name="auth.social.github.client_secret"]')).toHaveAttribute('placeholder','已配置，留空保持不变');
  await expect(page.locator('[data-social-provider="google"] input[name="auth.social.google.client_secret"]')).toHaveAttribute('placeholder','已配置，留空保持不变');

  await page.evaluate(()=>localStorage.setItem('gojet_post_auth_path','/app/links'));
  await page.goto(base+'/login');
  const socialButtons=page.locator('.social-provider');
  await expect(socialButtons).toHaveCount(2);
  await expect(socialButtons).toHaveText(['继续使用 Google','继续使用 GitHub']);
  const targets=await socialButtons.evaluateAll(nodes=>nodes.map(node=>{const target=new URL(node.href);return{path:target.pathname,redirect:target.searchParams.get('redirect')}}));
  expect(targets).toEqual([
    {path:'/api/public/auth/google/start',redirect:'/app/links'},
    {path:'/api/public/auth/github/start',redirect:'/app/links'},
  ]);

  await page.goto(base+'/admin/');
  await expect(page.locator('#adminView')).toBeVisible();
  await openSocialSettings(page);
  await configureProvider(page.locator('[data-social-provider="github"]'),{enabled:false});
  await page.getByRole('button',{name:'保存设置',exact:true}).click();
  await page.goto(base+'/login');
  await expect(page.locator('.social-provider')).toHaveCount(1);
  await expect(page.locator('.social-provider')).toHaveText('继续使用 Google');

  await page.goto(base+'/admin/');
  await expect(page.locator('#adminView')).toBeVisible();
  await openSocialSettings(page);
  await configureProvider(page.locator('[data-social-provider="google"]'),{enabled:false});
  await page.getByRole('button',{name:'保存设置',exact:true}).click();
  await page.goto(base+'/login');
  await expect(page.locator('.social-provider')).toHaveCount(0,{timeout:5000});
  await expect(page.locator('#socialAuth')).toHaveClass(/hidden/);
});
