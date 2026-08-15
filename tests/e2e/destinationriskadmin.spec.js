const {test,expect}=require('@playwright/test');
const base=process.env.GOJET_SURFACE_BASE||'http://127.0.0.1:4180';

async function createReviewLink(request){
  const suffix=Date.now();
  const registered=await request.post(base+'/api/auth/register',{data:{email:`risk-ui-${suffix}@example.test`,display_name:'Risk UI',password:'RiskUiPassword!2026'}});
  expect(registered.status()).toBe(201);
  const user=await registered.json();
  const headers={Authorization:`Bearer ${user.token}`};
  const spaces=await request.get(base+'/api/workspaces',{headers});
  const wid=(await spaces.json()).data[0].id;
  const code=`riskui${suffix}`;
  const created=await request.post(`${base}/api/workspaces/${wid}/links`,{headers,data:{destination:'https://risk-ui.invalid/review',code,redirect_status:302,status:'active'}});
  expect(created.status()).toBe(201);
  return {code};
}

async function adminLogin(page){
  await page.goto(base+'/admin/');
  await page.getByLabel('管理员邮箱').fill('owner@example.test');
  await page.getByLabel('密码').fill('OwnerPassword!2026');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.locator('#adminView')).toBeVisible();
}

async function confirmRiskAction(page,button,confirmation){
  await button.click();
  const modal=page.locator('#modal');
  await expect(modal).not.toHaveClass(/hidden/);
  await modal.getByRole('button',{name:confirmation,exact:true}).click();
  await expect(modal).toHaveClass(/hidden/,{timeout:10000});
}

async function openRisk(page,code){
  await page.locator('#nav [data-risk-review]').click();
  await expect(page.locator('.riskWorkspace')).toBeVisible();
  const row=page.locator('.riskRow').filter({hasText:code});
  for(let i=0;i<12 && !await row.count();i++){
    await page.getByRole('button',{name:'刷新队列'}).click();
    await page.waitForTimeout(1000);
  }
  await expect(row).toBeVisible({timeout:5000});
  await row.click();
  return row;
}

test('destination risk review is a dedicated workflow and admin link management consumes the same safety truth',async({page,request})=>{
  const {code}=await createReviewLink(request);
  await adminLogin(page);
  await openRisk(page,code);
  await expect(page.locator('#pageTitle')).toHaveText('目标风险审核');
  await expect(page.locator('#modal')).toHaveClass(/hidden/);
  await expect(page.locator('[data-risk-detail]')).toContainText('待审核');
  await expect(page.locator('[data-risk-detail]')).toContainText('risk-ui.invalid');

  await page.locator('[data-risk-review-form] textarea').fill('Browser gate reviewed current target and evidence');
  await confirmRiskAction(page,page.locator('[data-decision="block"]'),'确认阻止');
  await expect(page.locator('[data-risk-detail]')).toContainText('人工结论：阻止',{timeout:10000});

  // Link management must preserve operational state and expose target safety as
  // a separate authoritative column. It must never rewrite “active” into a
  // misleading generic status or bind a decision by row position.
  await page.locator('#nav [data-view="links"]').click();
  await expect(page.locator('#pageTitle')).toHaveText('链接管理');
  await expect(page.locator('#content table thead')).toContainText('运行状态');
  await expect(page.locator('#content table thead')).toContainText('目标安全');
  const linkRow=page.locator('#content table tbody tr').filter({hasText:code});
  await expect(linkRow).toBeVisible();
  await expect(linkRow.locator('td').nth(5)).toHaveText('正常');
  await expect(linkRow.locator('[data-link-risk]')).toHaveText('安全阻止',{timeout:8000});
  await expect(linkRow).toHaveAttribute('data-risk-decision','block');

  const blocked=await request.get(base+'/'+code,{maxRedirects:0});
  // Risk enforcement remains fail-closed. Depending on fixture presentation
  // configuration this is either the branded internal safety redirect or a
  // non-redirecting closed response, never the original target.
  if([301,302,307,308].includes(blocked.status())){
    const location=blocked.headers().location||'';
    expect(location).toContain('/link-unavailable');
    expect(location).not.toContain('risk-ui.invalid');

    // The public result is a branded safety surface, not raw JSON. Its appeal
    // handoff carries only the short resource reference and moderation state;
    // the private destination and internal evidence must not leak into the URL.
    const safety=await page.context().newPage();
    await safety.goto(new URL(location,base).href);
    await expect(safety.getByRole('heading',{name:'此链接已被安全阻止'})).toBeVisible();
    await expect(safety.locator('#safetyCode')).toHaveText(code);
    const appeal=await safety.locator('#safetyAppeal').getAttribute('href');
    expect(appeal).toContain('/app/support?');
    expect(appeal).toContain('mode=appeal');
    expect(appeal).toContain(`resource_ref=${encodeURIComponent(code)}`);
    expect(appeal).toContain('safety_state=blocked');
    expect(appeal).not.toContain('risk-ui.invalid');
    expect(appeal).not.toContain('target=');
    await safety.close();
  }

  await openRisk(page,code);
  await expect(page.locator('[data-risk-detail]')).toContainText('人工结论：阻止',{timeout:10000});
  await confirmRiskAction(page,page.locator('[data-clear-override]'),'恢复自动判断');
  await expect(page.locator('[data-risk-detail]')).toContainText('待审核',{timeout:10000});

  await confirmRiskAction(page,page.locator('[data-risk-rescan]'),'开始扫描');
  await expect(page.locator('[data-risk-detail]')).toContainText('待审核',{timeout:15000});
  await expect(page.locator('#modal')).toHaveClass(/hidden/);
});