const {test,expect}=require('@playwright/test');

const base=process.env.GOJET_SURFACE_BASE||'http://127.0.0.1:4180';
const viewports=[
  {name:'desktop',width:1440,height:900},
  {name:'tablet',width:1024,height:768},
  {name:'mobile',width:390,height:844},
];

async function json(request,method,path,body,token){
  const options={method,headers:{'Content-Type':'application/json'}};
  if(token)options.headers.Authorization=`Bearer ${token}`;
  if(body!==undefined)options.data=body;
  const response=await request.fetch(base+path,options);
  const data=await response.json().catch(()=>({}));
  if(!response.ok())throw new Error(`${method} ${path}: ${response.status()} ${JSON.stringify(data)}`);
  return data;
}

async function createUser(request,suffix){
  const email=`responsive-${suffix}-${Date.now()}@example.test`;
  const result=await json(request,'POST','/api/auth/register',{email,display_name:'GoJet Responsive',password:'ResponsiveUser!2026'});
  return result.token;
}

function observeBrowserProblems(page){
  const problems=[];
  page.on('pageerror',error=>problems.push(`pageerror: ${error.message}`));
  page.on('console',message=>{
    if(message.type()==='error')problems.push(`console.error: ${message.text()}`);
  });
  page.on('requestfailed',request=>{
    const failure=request.failure();
    problems.push(`requestfailed: ${request.method()} ${request.url()} ${failure?.errorText||''}`);
  });
  page.on('response',response=>{
    if(response.status()>=500)problems.push(`http ${response.status()}: ${response.request().method()} ${response.url()}`);
  });
  return problems;
}

async function assertViewportHealthy(page,label){
  await expect(page.locator('body')).toBeVisible();
  const geometry=await page.evaluate(()=>({
    documentWidth:document.documentElement.scrollWidth,
    viewportWidth:document.documentElement.clientWidth,
    bodyWidth:document.body.scrollWidth,
  }));
  expect(geometry.documentWidth,`${label}: document overflow`).toBeLessThanOrEqual(geometry.viewportWidth+2);
  expect(geometry.bodyWidth,`${label}: body overflow`).toBeLessThanOrEqual(geometry.viewportWidth+2);
  const heading=page.locator('main h1:visible,.content h1:visible,.auth-heading h1:visible').first();
  if(await heading.count()){
    const box=await heading.boundingBox();
    expect(box,`${label}: primary heading box`).toBeTruthy();
    expect(box.x,`${label}: heading starts outside viewport`).toBeGreaterThanOrEqual(-2);
    expect(box.x+box.width,`${label}: heading ends outside viewport`).toBeLessThanOrEqual(geometry.viewportWidth+2);
  }
}

async function adminLogin(page){
  await page.goto(base+'/admin/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#loginView')).toBeVisible();
  await expect(page.locator('#adminView')).toBeHidden();
  await page.getByLabel('管理员邮箱').fill('owner@example.test');
  await page.getByLabel('密码').fill('OwnerPassword!2026');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.locator('#adminView')).toBeVisible({timeout:10000});
  await expect(page.locator('#loginView')).toBeHidden();
}

for(const viewport of viewports){
  test(`${viewport.name} public auth, customer console and admin stay responsive and console-clean`,async({page,request})=>{
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    const problems=observeBrowserProblems(page);

    for(const route of ['/login','/register','/forgotpassword']){
      const response=await page.goto(base+route,{waitUntil:'networkidle'});
      expect(response&&response.status(),`${viewport.name} ${route}`).toBeLessThan(400);
      await expect(page.locator('.auth-brand')).toContainText('GoJet');
      await assertViewportHealthy(page,`${viewport.name} ${route}`);
    }

    const token=await createUser(request,viewport.name);
    await page.addInitScript(value=>localStorage.setItem('gojet_token',value),token);
    for(const route of ['/app/dashboard','/app/links','/app/text','/app/bio','/app/files','/app/qr','/app/organization','/app/analytics']){
      const response=await page.goto(base+route,{waitUntil:'networkidle'});
      expect(response&&response.status(),`${viewport.name} ${route}`).toBeLessThan(400);
      await expect(page.locator('#shell')).toBeVisible({timeout:10000});
      await expect(page.locator('.content h1').first()).toBeVisible({timeout:10000});
      await assertViewportHealthy(page,`${viewport.name} ${route}`);
    }

    await adminLogin(page);
    await assertViewportHealthy(page,`${viewport.name} admin overview`);
    const settings=page.locator('#nav [data-view="settings"]');
    await expect(settings).toBeVisible();
    await settings.click();
    await expect(page.locator('#content')).not.toBeEmpty();
    await assertViewportHealthy(page,`${viewport.name} admin settings`);
    const risk=page.locator('[data-risk-review]');
    await expect(risk).toBeVisible();
    await risk.click();
    await expect(page.locator('#content')).not.toBeEmpty();
    await assertViewportHealthy(page,`${viewport.name} admin destination risk`);

    expect(problems,`${viewport.name} browser console/network problems`).toEqual([]);
  });
}
