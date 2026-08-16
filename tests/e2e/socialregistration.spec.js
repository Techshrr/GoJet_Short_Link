const {test,expect}=require('@playwright/test');

const base=process.env.GOJET_SURFACE_BASE||'http://127.0.0.1:4173';

test('registration social buttons declare the registration flow',async({page})=>{
  await page.route('**/api/public/auth/providers',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({providers:[{id:'github',label:'GitHub'}]})}));
  await page.route('**/api/public/settings',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({registration:{enabled:true}})}));
  await page.route('**/api/public/turnstile',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({enabled:false,surfaces:{}})}));
  await page.goto(base+'/register');
  const github=page.locator('#socialProviders a[data-provider="github"]');
  await expect(github).toBeVisible();
  const href=await github.getAttribute('href');
  expect(href).toContain('/api/public/auth/github/start?');
  expect(href).toContain('flow=register');
});

test('social registration completion always requires GoJet email verification and password',async({page})=>{
  const pending='abcdefghijklmnopqrstuvwxyzABCDEFGH123456789';
  await page.route('**/api/public/settings',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({registration:{enabled:true}})}));
  await page.route('**/api/public/turnstile',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({enabled:false,surfaces:{}})}));
  await page.route('**/api/public/auth/social-registration?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({provider:'github',provider_label:'GitHub',suggested_display_name:'Octo User',provider_email:'octo@example.test',password_min_length:12})}));
  await page.goto(base+'/register#social_registration='+pending);
  await expect(page.locator('#authTitle')).toHaveText('完成 GoJet 注册');
  await expect(page.locator('#socialAuth')).toHaveClass(/hidden/);
  await expect(page.locator('input[name="display_name"]')).toHaveValue('Octo User');
  await expect(page.locator('input[name="email"]')).toHaveValue('octo@example.test');
  await expect(page.locator('#socialRegisterEmailCode')).toBeVisible();
  await expect(page.locator('#socialRegisterEmailCode')).toHaveAttribute('required','');
  await expect(page.locator('input[name="password"]')).toHaveAttribute('minlength','12');
  await expect(page.getByRole('button',{name:'验证邮箱并完成注册'})).toBeVisible();
  await expect(page.locator('.auth-heading p')).toContainText('自动绑定');
});
