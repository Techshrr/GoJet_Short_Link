const { test, expect } = require('@playwright/test');
const fs=require('fs');
const base=process.env.GOJET_SURFACE_BASE||'http://127.0.0.1:4180';
const visualEvidenceDir='test-results/visual-evidence';
fs.mkdirSync(visualEvidenceDir,{recursive:true});

async function json(request,method,path,body,token){
  const options={method,headers:{'Content-Type':'application/json'}};
  if(token)options.headers.Authorization=`Bearer ${token}`;
  if(body!==undefined)options.data=body;
  const response=await request.fetch(base+path,options);
  const data=await response.json().catch(()=>({}));
  if(!response.ok())throw new Error(`${method} ${path}: ${response.status()} ${JSON.stringify(data)}`);
  return data;
}
async function bootstrapUser(request){
  const stamp=Date.now();
  const reg=await json(request,'POST','/api/auth/register',{email:`surface-${stamp}@example.test`,display_name:'Surface User',password:'SurfaceUser!2026'});
  const token=reg.token;
  const workspaces=await json(request,'GET','/api/workspaces',undefined,token);
  return {token,workspace:workspaces.data[0].id};
}
async function createLink(request,user){
  return json(request,'POST',`/api/workspaces/${user.workspace}/links`,{destination:'https://example.com/product',title:'Surface Link',code:'surface'+String(Date.now()).slice(-6),domain:'',redirect_status:302,status:'active',one_time:false,expires_at:null,max_clicks:null,password:''},user.token);
}
async function setUserSession(page,token){
  await page.addInitScript(t=>localStorage.setItem('gojet_token',t),token);
}
async function adminLogin(page){
  await page.goto(base+'/admin/');
  await page.getByLabel('管理员邮箱').fill('owner@example.test');
  await page.getByLabel('密码').fill('OwnerPassword!2026');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.getByText('平台概览',{exact:true}).first()).toBeVisible();
}
async function capture(page,name){
  await page.screenshot({path:`${visualEvidenceDir}/${name}.png`,fullPage:true});
}

test.describe.serial('real product surface',()=>{
  let user,link,invoice;

  test('admin settings save stays inside the visible settings form',async({page})=>{
    await adminLogin(page);
    await page.getByRole('button',{name:'系统设置',exact:true}).click();
    await page.getByRole('button',{name:/注册与账户/}).click();
    const pane=page.locator('[data-ah-pane="registration"]');
    await expect(pane).toBeVisible();
    const requestPromise=page.waitForRequest(req=>req.method()==='PUT'&&req.url().endsWith('/api/admin/settings/registration'));
    const responsePromise=page.waitForResponse(res=>res.request().method()==='PUT'&&res.url().endsWith('/api/admin/settings/registration'));
    await pane.getByRole('button',{name:'保存设置',exact:true}).click();
    const req=await requestPromise;
    const payload=req.postDataJSON();
    for(const key of Object.keys(payload))expect(key.startsWith('registration.')).toBeTruthy();
    for(const forbidden of ['email','password','code'])expect(payload).not.toHaveProperty(forbidden);
    expect((await responsePromise).status()).toBe(200);
  });

  test('uploaded brand logo is readable through the same public origin',async({page,request})=>{
    let uploaded=false;
    await adminLogin(page);
    try{
      await page.getByRole('button',{name:'系统设置',exact:true}).click();
      await page.getByRole('button',{name:/品牌与视觉/}).click();
      const chooserPromise=page.waitForEvent('filechooser');
      await page.locator('[data-ah-upload="logo"]').click();
      const chooser=await chooserPromise;
      const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR42mNk+M/wHwMDAwMjIACmBgB9ewQ/u2+z0AAAAABJRU5ErkJggg==','base64');
      await chooser.setFiles({name:'gojet-logo.png',mimeType:'image/png',buffer:png});
      uploaded=true;
      const preview=page.locator('[data-ah-pane="brand"] .ah-asset').first().locator('img');
      await expect(preview).toBeVisible();
      await expect.poll(async()=>preview.evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
      expect(new URL(await preview.getAttribute('src'),base).pathname).toBe('/assets/images/logo.png');
      const response=await request.get(base+'/assets/images/logo.png');
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']||'').toContain('image/png');
    }finally{
      if(uploaded){
        const remove=page.locator('[data-ah-delete="logo"]');
        if(await remove.isVisible().catch(()=>false)){
          page.once('dialog',dialog=>dialog.accept());
          await remove.click();
          await expect(page.locator('[data-ah-pane="brand"] .ah-asset').first().locator('img')).toHaveCount(0);
        }
      }
    }
  });

  test('authenticated public site switches all guest conversion actions to account actions',async({page,request})=>{
    user=await bootstrapUser(request);
    await setUserSession(page,user.token);
    await page.goto(base+'/');
    await expect(page.locator('header [data-account-nav]')).toContainText('进入控制台');
    await expect(page.locator('header [data-account-nav] a[href="/login"]')).toHaveCount(0);
    await expect(page.locator('header [data-account-nav] a[href="/register"]')).toHaveCount(0);
    await expect(page.locator('main a[href="/register"]')).toHaveCount(0);
  });

  test('generated QR is visible in the customer console and downloadable from public storage',async({page,request})=>{
    if(!user)user=await bootstrapUser(request);
    link=await createLink(request,user);
    const qr=await json(request,'POST',`/api/workspaces/${user.workspace}/qr-codes`,{name:'Surface QR',link_id:Number(link.ID??link.id),foreground:'#101828',background:'#ffffff',size:512},user.token);
    expect(qr.image_url).toMatch(/^\/generated\/qr\//);
    const image=await request.get(base+qr.image_url);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']||'').toContain('image/png');
    await setUserSession(page,user.token);
    await page.goto(base+'/app/qr');
    await expect(page.getByRole('heading',{name:'二维码'})).toBeVisible();
    const img=page.locator('img[alt="二维码"]').first();
    await expect(img).toBeVisible();
    await expect.poll(async()=>img.evaluate(node=>node.naturalWidth)).toBeGreaterThan(0);
  });

  test('invoice download completes as a browser download and the returned PDF is non-empty',async({page,request})=>{
    if(!user)user=await bootstrapUser(request);
    invoice=await json(request,'POST',`/api/workspaces/${user.workspace}/billing/invoices`,{plan_code:'pro',type:'purchase'},user.token);
    await setUserSession(page,user.token);
    await page.goto(base+'/app/billing');
    await expect(page.getByRole('heading',{name:'套餐与账单'})).toBeVisible();
    const button=page.locator(`[data-download-invoice="${invoice.id}"]`);
    await expect(button).toBeVisible();
    const downloadPromise=page.waitForEvent('download');
    await button.click();
    const download=await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    const path=await download.path();
    expect(path).toBeTruthy();
    expect(fs.statSync(path).size).toBeGreaterThan(1500);
    expect(fs.readFileSync(path).subarray(0,5).toString()).toBe('%PDF-');
    await expect(page.getByText('Failed to fetch')).toHaveCount(0);
  });

  test('analytics page stays within the viewport after opening a link analysis',async({page,request})=>{
    if(!user)user=await bootstrapUser(request);
    if(!link)link=await createLink(request,user);
    const id=Number(link.ID??link.id),code=link.Code??link.code;
    await request.get(base+'/'+code);
    await request.get(base+'/'+code);
    await expect.poll(async()=>{const a=await json(request,'GET',`/api/workspaces/${user.workspace}/links/${id}/analytics`,undefined,user.token);return Number(a?.clicks??0)},{timeout:10000}).toBeGreaterThanOrEqual(1);
    await setUserSession(page,user.token);
    await page.goto(base+'/app/links');
    await expect(page.getByRole('heading',{name:'短链接'})).toBeVisible();
    const card=page.locator('#lhLinks article.shareCard').filter({hasText:code}).first();
    await expect(card).toBeVisible();
    await card.getByRole('button',{name:'访问分析',exact:true}).click();
    await expect(page).toHaveURL(new RegExp(`/app/analytics\\?link=${id}$`));
    await expect(page.getByRole('heading',{name:'访问分析'})).toBeVisible();
    const surface=page.locator('#analyticsPage');
    await expect(surface).toBeVisible();
    await expect(page.locator('#analyticsLinkSelect')).toHaveValue(String(id));
    await expect(page.locator('#analyticsLinkResult .analyticsLinkHead')).toBeVisible();
    const measurements=await surface.evaluate(node=>({client:node.clientWidth,scroll:node.scrollWidth,right:node.getBoundingClientRect().right,viewport:innerWidth,bodyScroll:document.documentElement.scrollWidth,bodyClient:document.documentElement.clientWidth}));
    expect(measurements.scroll).toBeLessThanOrEqual(measurements.client+1);
    expect(measurements.right).toBeLessThanOrEqual(measurements.viewport+1);
    expect(measurements.bodyScroll).toBeLessThanOrEqual(measurements.bodyClient+1);
  });

  test('public abuse report fields have stable non-overlapping layout',async({page})=>{
    await page.goto(base+'/reportabuse');
    const form=page.locator('#abuseReportForm');
    await expect(form).toBeVisible();
    const labels=await form.locator('label').all();
    let bottom=0;
    for(const label of labels){const box=await label.boundingBox();expect(box.y).toBeGreaterThanOrEqual(bottom-1);bottom=box.y+box.height;}
    const fields=await form.locator('input,select,textarea').all();
    const formBox=await form.boundingBox();
    for(const field of fields){const box=await field.boundingBox();expect(box.x).toBeGreaterThanOrEqual(formBox.x);expect(box.x+box.width).toBeLessThanOrEqual(formBox.x+formBox.width+1);}
  });
});

test.describe.serial('product visual evidence',()=>{
  test('capture desktop public home',async({page})=>{
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(base+'/',{waitUntil:'networkidle'});
    await expect(page.getByRole('heading',{name:'让链接更短，让分享更有价值'})).toBeVisible();
    await capture(page,'01-public-home-desktop');
  });

  test('capture mobile public home',async({page})=>{
    await page.setViewportSize({width:390,height:844});
    await page.goto(base+'/',{waitUntil:'networkidle'});
    await expect(page.getByRole('heading',{name:'让链接更短，让分享更有价值'})).toBeVisible();
    await capture(page,'02-public-home-mobile');
  });

  test('capture account login',async({page})=>{
    await page.setViewportSize({width:1280,height:900});
    await page.goto(base+'/login',{waitUntil:'networkidle'});
    await expect(page.getByRole('heading',{name:'欢迎回来'})).toBeVisible();
    await capture(page,'03-account-login');
  });

  test('capture customer console',async({page,request})=>{
    const account=await bootstrapUser(request);
    await setUserSession(page,account.token);
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(base+'/app/dashboard',{waitUntil:'networkidle'});
    await expect(page.locator('#shell')).toBeVisible();
    await capture(page,'04-customer-console');
  });

  test('capture administrator console',async({page})=>{
    await page.setViewportSize({width:1440,height:1000});
    await adminLogin(page);
    await expect(page.locator('#adminView')).toBeVisible();
    await capture(page,'05-administrator-console');
  });
});
