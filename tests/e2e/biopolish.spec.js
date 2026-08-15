const {test,expect}=require('@playwright/test');

const base=process.env.GOJET_SURFACE_BASE||'http://127.0.0.1:4180';

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
  const registration=await json(request,'POST','/api/auth/register',{
    email:`bio-polish-${stamp}@example.test`,
    display_name:'Bio Polish User',
    password:'BioPolishUser!2026'
  });
  const workspaces=await json(request,'GET','/api/workspaces',undefined,registration.token);
  return{token:registration.token,workspace:workspaces.data[0].id,stamp};
}

async function setUserSession(page,token){
  await page.addInitScript(value=>localStorage.setItem('gojet_token',value),token);
}

test('bio editor makes theme choice, live preview, add-link CTA and QR sharing explicit',async({page,request})=>{
  const account=await bootstrapUser(request);
  await setUserSession(page,account.token);
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base+'/app/bio',{waitUntil:'networkidle'});

  await expect(page.getByRole('heading',{name:'个人主页'})).toBeVisible();
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
    return{background:style.backgroundColor,color:style.color,border:style.borderTopColor};
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

  const slug=`bio-${String(account.stamp).slice(-10)}`;
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
});
