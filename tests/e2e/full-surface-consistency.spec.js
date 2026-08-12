const {test,expect}=require('@playwright/test');
const base=process.env.GOJET_SURFACE_BASE||'http://127.0.0.1:4180';
const engineering=/Fresh Install|GoJet V4|system-images|SYSTEM_IMAGE_PATH|product-hardening|hardening-release|GoJetProductHardening|Redis Worker|file-worker|真实业务接口|后端业务闭环/i;
const publicRoutes=['/','/about/','/contact/','/resources/','/docs/','/developers/','/blog/','/browser-extension/','/apps/','/changelog/','/solutions/marketing/','/solutions/creators/','/solutions/teams/','/pricing/','/announcements/','/privacy/','/terms/','/report-abuse/','/status/','/products/url-shortener/','/products/qr-code/','/products/analytics/','/products/bio-pages/','/products/text-sharing/','/products/file-sharing/','/products/custom-domains/','/products/smart-links/','/products/ab-testing/','/products/qr-campaigns/'];
const authRoutes=['/login','/register','/forgot-password','/reset-password?token=surface-test','/verify-email?token=surface-test'];
const consoleRoutes=['/app/dashboard','/app/links','/app/team','/app/campaigns','/app/domains','/app/bio','/app/text','/app/files','/app/qr','/app/billing','/app/analytics','/app/support','/app/account'];
const adminViews=['overview','users','administrators','links','workspaces','announcements','mail','billing','files','abuse','domains','security','diagnostics','settings','audit'];
async function json(request,method,path,body,token){const options={method,headers:{'Content-Type':'application/json'}};if(token)options.headers.Authorization=`Bearer ${token}`;if(body!==undefined)options.data=body;const r=await request.fetch(base+path,options);const data=await r.json().catch(()=>({}));if(!r.ok())throw new Error(`${method} ${path}: ${r.status()} ${JSON.stringify(data)}`);return data;}
async function user(request){const stamp=Date.now();const reg=await json(request,'POST','/api/auth/register',{email:`crawl-${stamp}@example.test`,display_name:'GoJet Surface',password:'SurfaceUser!2026'});return reg.token;}
async function setSession(page,token){await page.addInitScript(t=>localStorage.setItem('gojet_token',t),token);}
async function noOverflow(page){const d=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));expect(d.scroll).toBeLessThanOrEqual(d.client+2);}
async function noBrokenImages(page){const bad=await page.locator('img:visible').evaluateAll(imgs=>imgs.filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.getAttribute('src')));expect(bad).toEqual([]);}
async function noEngineering(page){expect((await page.locator('body').innerText())).not.toMatch(engineering);}
async function branded(locator){
 await expect(locator).toBeVisible();
 const logo=locator.locator('.logo').first();
 await expect(logo).toBeVisible();
 const image=logo.locator('img');
 if(await image.count()){
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('alt',/\S+/);
  expect(await image.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 }else{
  await expect(logo).toContainText('GoJet');
 }
}

test.describe.serial('whole product visual and route consistency',()=>{
 test('every public product route uses a stable GoJet shell',async({page})=>{
  for(const route of publicRoutes){const response=await page.goto(base+route,{waitUntil:'domcontentloaded'});expect(response&&response.status(),route).toBeLessThan(400);await expect(page.locator('body')).toBeVisible();await branded(page.locator('header'));await branded(page.locator('footer'));await noEngineering(page);await noBrokenImages(page);await noOverflow(page);}
 });
 test('all account entry pages keep the GoJet identity without release-stage copy',async({page})=>{
  for(const route of authRoutes){const response=await page.goto(base+route,{waitUntil:'domcontentloaded'});expect(response&&response.status(),route).toBeLessThan(400);await expect(page.locator('.auth-brand')).toContainText('GoJet');await noEngineering(page);await noBrokenImages(page);await noOverflow(page);}
 });
 test('every customer-console route owns and renders its page',async({page,request})=>{
  const token=await user(request);await setSession(page,token);
  for(const route of consoleRoutes){const response=await page.goto(base+route,{waitUntil:'domcontentloaded'});expect(response&&response.status(),route).toBeLessThan(400);await expect(page.locator('#shell')).toBeVisible();await expect(page.locator('.content h1').first(),route).toBeVisible({timeout:10000});await expect(page.locator('aside .brand')).toContainText('GoJet');await noEngineering(page);await noBrokenImages(page);await noOverflow(page);}
 });
 test('every administrator primary module renders inside the same branded shell',async({page})=>{
  await page.goto(base+'/admin/');await page.getByLabel('管理员邮箱').fill('owner@example.test');await page.getByLabel('密码').fill('OwnerPassword!2026');await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.locator('#adminView')).toBeVisible();await expect(page.locator('.sidebar .brand')).toContainText('GoJet');
  for(const view of adminViews){const button=page.locator(`#nav [data-view="${view}"]`);await expect(button,view).toBeVisible();await button.click();await expect.poll(async()=>((await page.locator('#content').innerText()).trim().length),{message:view,timeout:10000}).toBeGreaterThan(0);await noEngineering(page);await noBrokenImages(page);await noOverflow(page);}
 });
});
