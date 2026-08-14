const {test,expect}=require('@playwright/test');
const base=process.env.GOJET_SURFACE_BASE||'http://127.0.0.1:4180';
test.skip(!process.env.GOJET_SURFACE_BASE,'requires the full product runtime used by Product Surface Gate');

async function json(request,method,path,body,token){
  const headers={'Content-Type':'application/json'};
  if(token)headers.Authorization=`Bearer ${token}`;
  const response=await request.fetch(base+path,{method,headers,data:body});
  const data=await response.json().catch(()=>({}));
  if(!response.ok())throw new Error(`${method} ${path}: ${response.status()} ${JSON.stringify(data)}`);
  return data;
}
async function user(request){
  const stamp=Date.now()+Math.floor(Math.random()*100000);
  const result=await json(request,'POST','/api/auth/register',{email:`social-ui-${stamp}@example.test`,display_name:'Social Identity UI',password:'SocialIdentityUI!2026'});
  return result.token;
}
async function adminToken(request){
  return (await json(request,'POST','/api/admin/auth/login',{email:'owner@example.test',password:'OwnerPassword!2026'})).token;
}
async function setSession(page,token){await page.addInitScript(value=>localStorage.setItem('gojet_token',value),token)}

test.describe.serial('customer social identity settings',()=>{
  test('configured provider offers an authenticated PKCE bind launch from account settings',async({page,request})=>{
    const admin=await adminToken(request);
    await json(request,'PUT','/api/admin/settings/registration',{'registration.enabled':true,'registration.require_email_verification':false,'registration.password_min_length':10},admin);
    await json(request,'PUT','/api/admin/settings/socialauth',{'auth.social.github.enabled':true,'auth.social.github.client_id':'surface-bind-client','auth.social.github.client_secret':'SurfaceBindSecret!2026','auth.social.google.enabled':false},admin);
    const token=await user(request);
    await setSession(page,token);
    let authorize='';
    await page.route('https://github.com/login/oauth/authorize**',async route=>{authorize=route.request().url();await route.fulfill({status:200,contentType:'text/html',body:'<title>Provider fixture</title><p>provider fixture</p>'})});
    await page.goto(base+'/app/settings');
    const panel=page.locator('[data-social-identity-mount]');
    await expect(panel.getByRole('heading',{name:'第三方账户'})).toBeVisible();
    const github=panel.locator('[data-social-provider="github"]');
    await expect(github).toContainText('未绑定');
    await expect(github).toContainText('尚未绑定');
    const google=panel.locator('[data-social-provider="google"]');
    await expect(google).toContainText('管理员尚未启用此登录方式');
    await github.getByRole('button',{name:'绑定',exact:true}).click();
    await expect.poll(()=>authorize,{timeout:10000}).toContain('github.com/login/oauth/authorize');
    const parsed=new URL(authorize),query=parsed.searchParams;
    expect(query.get('client_id')).toBe('surface-bind-client');
    expect(query.get('code_challenge_method')).toBe('S256');
    expect(query.get('code_challenge')).toHaveLength(43);
    expect(query.get('state').length).toBeGreaterThanOrEqual(40);
  });

  test('last-login-credential failure is surfaced without silently unlinking identity',async({page,request})=>{
    const token=await user(request);
    await setSession(page,token);
    await page.route('**/api/me/social-identities',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({password_login_enabled:false,identities:[{provider:'github',provider_email:'linked@example.test',email_verified:true,display_name:'Linked Account'}],providers:[{id:'github',label:'GitHub',configured:true,linked:true}]})}));
    await page.route('**/api/me/social/github',route=>{
      if(route.request().method()==='DELETE')return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'不能解除最后一个可用登录凭据，请先设置密码或绑定另一种第三方登录方式'})});
      return route.continue();
    });
    page.on('dialog',dialog=>dialog.accept());
    await page.goto(base+'/app/settings');
    const panel=page.locator('[data-social-identity-mount]');
    await expect(panel).toContainText('当前账户还没有可用的密码登录凭据');
    await expect(page.locator('#passwordSettings')).toContainText('通过邮箱设置密码');
    await panel.getByRole('button',{name:'解除绑定'}).click();
    await expect(panel.locator('[data-social-error]')).toContainText('不能解除最后一个可用登录凭据');
    await expect(panel.locator('[data-social-provider="github"]')).toContainText('已绑定');
  });
});
