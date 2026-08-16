const {test,expect}=require('@playwright/test');

// Product Surface runs this suite against its real Nginx fixture on 4180 via
// GOJET_SURFACE_BASE. The general installer/browser fixture is served by the
// root Playwright config on 4173. Keep the default aligned with that canonical
// fixture instead of silently dialing a server that does not exist.
const base=process.env.GOJET_SURFACE_BASE||'http://127.0.0.1:4173';
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
      // Route ownership is represented by the rendered content surface, not by
      // one mandatory heading level. Several first-party pages deliberately use
      // h2/card headings, so requiring `.content h1` turns valid responsive
      // pages into false negatives while adding no layout coverage.
      const content=page.locator('.content');
      await expect(content).toBeVisible({timeout:10000});
      await expect(content).not.toBeEmpty();
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

test('desktop Bio editor exposes theme state, live preview, prominent add-link CTA and QR sharing',async({page,request})=>{
  await page.setViewportSize({width:1440,height:1000});
  const problems=observeBrowserProblems(page);
  const token=await createUser(request,'bio-polish');
  await page.addInitScript(value=>localStorage.setItem('gojet_token',value),token);
  await page.goto(base+'/app/bio',{waitUntil:'networkidle'});

  await expect(page.getByRole('heading',{name:'个人主页',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'创建主页',exact:true}).first().click();

  const editor=page.locator('#bioEditor .bioEditor');
  await expect(editor).toBeVisible();
  const themes=editor.locator('.bioThemes [data-theme]');
  await expect(themes).toHaveCount(4);

  const green=editor.locator('[data-theme="green"]');
  const warm=editor.locator('[data-theme="warm"]');
  await expect(green).toHaveAttribute('aria-pressed','true');
  await expect(green).toHaveClass(/active/);
  await expect(warm).toHaveAttribute('aria-pressed','false');

  const phone=editor.locator('#bioPhone');
  await expect(phone).toBeVisible();
  await warm.click();
  await expect(warm).toHaveAttribute('aria-pressed','true');
  await expect(warm).toHaveClass(/active/);
  await expect(green).toHaveAttribute('aria-pressed','false');
  await expect.poll(()=>phone.evaluate(node=>node.style.getPropertyValue('--bio-bg').trim())).toBe('#fff6e9');
  await expect.poll(()=>phone.evaluate(node=>node.style.getPropertyValue('--bio-primary').trim())).toBe('#b45f17');

  await editor.locator('#bioTitle').fill('GoJet Bio 验收');
  await editor.locator('#bioIntro').fill('主题与内容应当同步到实时手机预览。');
  await expect(phone.getByRole('heading',{name:'GoJet Bio 验收'})).toBeVisible();
  await expect(phone.getByText('主题与内容应当同步到实时手机预览。')).toBeVisible();

  const addLink=editor.getByRole('button',{name:/添加链接/});
  await expect(addLink).toBeVisible();
  const addStyle=await addLink.evaluate(node=>{
    const style=getComputedStyle(node);
    return{background:style.backgroundColor,color:style.color};
  });
  expect(addStyle.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(addStyle.background).not.toBe('rgb(255, 255, 255)');
  expect(addStyle.color).not.toBe(addStyle.background);

  await addLink.click();
  const label=editor.getByLabel('链接 1 名称');
  const target=editor.getByLabel('链接 1 地址');
  await expect(label).toBeFocused();
  await label.fill('GoJet 官网');
  await target.fill('https://example.com');
  await expect(phone.getByText('GoJet 官网',{exact:true})).toBeVisible();

  const slug=`bio-${String(Date.now()).slice(-10)}`;
  await editor.locator('input[name="slug"]').fill(slug);
  await editor.locator('select[name="status"]').selectOption('published');
  await editor.locator('#bioEditorForm > button.primary').click();

  const created=page.locator('#bioEditor .shareCreated');
  await expect(created).toContainText('主页已经发布',{timeout:10000});
  await expect(created.locator(`a[href$="/p/${slug}"]`).first()).toBeVisible();

  const qrButton=created.locator('[data-share-qr^="bio:"]');
  await expect(qrButton).toBeVisible({timeout:10000});
  await expect(qrButton).toHaveAttribute('aria-label',/生成.*分享码/);
  await qrButton.click();

  const dialog=page.locator('dialog[data-gojet-share-qr-dialog]');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('二维码分享',{exact:true})).toBeVisible();
  const image=dialog.locator('img');
  await expect(image).toBeVisible();
  await expect.poll(()=>image.evaluate(node=>node.naturalWidth)).toBeGreaterThan(0);
  await expect(dialog.getByRole('link',{name:'打开分享页'})).toHaveAttribute('href',new RegExp(`/p/${slug}$`));

  await assertViewportHealthy(page,'desktop Bio editor and share QR');
  expect(problems,'desktop Bio browser console/network problems').toEqual([]);
});

test('desktop billing cycle chooser is compact, selectable and updates the payable total',async({page,request})=>{
  await page.setViewportSize({width:1440,height:1000});
  const problems=observeBrowserProblems(page);
  const token=await createUser(request,'billing-cycle');
  await page.addInitScript(value=>localStorage.setItem('gojet_token',value),token);

  // The root installer fixture intentionally keeps billing payloads minimal.
  // Seed only that generic browser fixture so this UI contract stays stable,
  // while Product Surface (GOJET_SURFACE_BASE) continues to hit the real API.
  if(!process.env.GOJET_SURFACE_BASE){
    await page.route('**/api/workspaces/*/billing',route=>{
      if(route.request().method()!=='GET')return route.continue();
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
        subscription:{workspace_id:7,plan_code:'starter',plan_name:'基础版',status:'active',cancel_at_period_end:false},
        plans:[
          {id:1,code:'starter',name:'基础版',monthly_price_cents:0,currency:'CNY',description:'轻量项目',features:['100 条短链接']},
          {id:2,code:'pro',name:'专业版',monthly_price_cents:6900,currency:'CNY',description:'增长团队',features:['5,000 条短链接','180 天分析']}
        ],
        invoices:[]
      })});
    });
  }

  await page.goto(base+'/app/billing',{waitUntil:'networkidle'});

  await expect(page.getByRole('heading',{name:'套餐与账单',exact:true})).toBeVisible();
  const planButton=page.locator('.planCard button[data-plan]').first();
  await expect(planButton).toBeVisible();
  await planButton.click();

  const dialog=page.locator('.productModal.billingDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('group',{name:'选择付款周期'})).toBeVisible();
  const cycles=dialog.locator('input[name="billing_cycle"]');
  await expect(cycles).toHaveCount(4);
  await expect(dialog.getByText('月付',{exact:true})).toBeVisible();
  await expect(dialog.getByText('季付',{exact:true})).toBeVisible();
  await expect(dialog.getByText('半年付',{exact:true})).toBeVisible();
  await expect(dialog.getByText('年付',{exact:true})).toBeVisible();

  const monthly=dialog.locator('input[value="monthly"]');
  const annual=dialog.locator('input[value="annual"]');
  await expect(monthly).toBeChecked();
  const amount=dialog.locator('[data-cycle-total] > strong');
  const monthlyText=await amount.innerText();
  const numeric=text=>Number(String(text).replace(/[^0-9.-]/g,''));
  const monthlyAmount=numeric(monthlyText);
  expect(monthlyAmount).toBeGreaterThan(0);

  await annual.check();
  await expect(annual).toBeChecked();
  await expect(monthly).not.toBeChecked();
  await expect(dialog.locator('[data-cycle-summary]')).toHaveText('年付 · 12 个月');
  const annualAmount=numeric(await amount.innerText());
  expect(annualAmount).toBeCloseTo(monthlyAmount*12,2);

  const box=await dialog.boundingBox();
  expect(box,'billing dialog box').toBeTruthy();
  expect(box.width,'billing dialog should not consume the whole desktop').toBeLessThan(760);
  expect(box.x,'billing dialog left edge').toBeGreaterThan(0);
  expect(box.x+box.width,'billing dialog right edge').toBeLessThan(1440);
  await expect(dialog.getByRole('button',{name:'继续支付',exact:true})).toBeVisible();
  await expect(dialog.getByRole('button',{name:'取消',exact:true})).toBeVisible();

  await assertViewportHealthy(page,'desktop billing cycle chooser');
  expect(problems,'desktop billing browser console/network problems').toEqual([]);
});

test('desktop customer and administrator account areas stay readable and keyboard-obvious',async({page,request})=>{
  await page.setViewportSize({width:1440,height:1000});
  const problems=observeBrowserProblems(page);
  const token=await createUser(request,'sidebar-identity');
  await page.addInitScript(value=>localStorage.setItem('gojet_token',value),token);
  await page.goto(base+'/app/dashboard',{waitUntil:'networkidle'});

  const profile=page.locator('#shell aside .profile');
  await expect(profile).toBeVisible();
  const customerName=profile.locator('.profileIdentity b');
  const customerEmail=profile.locator('.profileIdentity small');
  await expect(customerName).toContainText('GoJet Responsive');
  await expect(customerEmail).toContainText('@example.test');
  const customerType=await customerName.evaluate(node=>parseFloat(getComputedStyle(node).fontSize));
  const customerMeta=await customerEmail.evaluate(node=>{
    const style=getComputedStyle(node);
    return{fontSize:parseFloat(style.fontSize),opacity:Number(style.opacity),color:style.color};
  });
  expect(customerType).toBeGreaterThanOrEqual(13);
  expect(customerMeta.fontSize).toBeGreaterThanOrEqual(11);
  expect(customerMeta.opacity).toBe(1);
  expect(customerMeta.color).not.toMatch(/rgba\([^)]*,\s*0\s*\)$/);

  const customerLogout=profile.locator('#logoutButton');
  const logoutBox=await customerLogout.boundingBox();
  expect(logoutBox,'customer logout button box').toBeTruthy();
  expect(logoutBox.width).toBeGreaterThanOrEqual(60);
  expect(logoutBox.height).toBeGreaterThanOrEqual(32);
  await page.keyboard.press('Tab');
  await customerLogout.focus();
  const customerFocus=await customerLogout.evaluate(node=>{
    const style=getComputedStyle(node);
    return{shadow:style.boxShadow,outlineWidth:parseFloat(style.outlineWidth||'0')};
  });
  expect(customerFocus.shadow!=='none'||customerFocus.outlineWidth>=2).toBe(true);

  await adminLogin(page);
  const adminAccount=page.locator('.sidebar .sidebar-account');
  await expect(adminAccount).toBeVisible();
  const adminName=adminAccount.locator('.adminIdentity strong');
  const adminEmail=adminAccount.locator('.adminIdentity span');
  const adminType=await adminName.evaluate(node=>parseFloat(getComputedStyle(node).fontSize));
  const adminMeta=await adminEmail.evaluate(node=>{
    const style=getComputedStyle(node);
    return{fontSize:parseFloat(style.fontSize),color:style.color};
  });
  expect(adminType).toBeGreaterThanOrEqual(13);
  expect(adminMeta.fontSize).toBeGreaterThanOrEqual(11);
  expect(adminMeta.color).not.toMatch(/rgba\([^)]*,\s*0\s*\)$/);
  await expect(adminAccount.locator('.role-pill')).toBeVisible();

  const adminSettings=page.locator('.sidebar #nav [data-view="settings"]');
  await page.keyboard.press('Tab');
  await adminSettings.focus();
  const adminFocus=await adminSettings.evaluate(node=>{
    const style=getComputedStyle(node);
    return{shadow:style.boxShadow,outlineWidth:parseFloat(style.outlineWidth||'0')};
  });
  expect(adminFocus.shadow!=='none'||adminFocus.outlineWidth>=2).toBe(true);
  const adminLogout=page.locator('#logout');
  await expect(adminLogout).toBeVisible();
  const adminLogoutBox=await adminLogout.boundingBox();
  expect(adminLogoutBox,'administrator logout button box').toBeTruthy();
  expect(adminLogoutBox.width).toBeGreaterThanOrEqual(60);
  expect(adminLogoutBox.height).toBeGreaterThanOrEqual(30);

  await assertViewportHealthy(page,'desktop customer and administrator account areas');
  expect(problems,'sidebar identity browser console/network problems').toEqual([]);
});
