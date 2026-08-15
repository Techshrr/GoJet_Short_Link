const {test,expect}=require('@playwright/test');

const base='http://127.0.0.1:4173';
const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)});

async function seedUser(page,token='user-fixture-token'){
  await page.addInitScript(value=>localStorage.setItem('gojet_token',value),token);
}
async function seedAdmin(page,token='admin-fixture-token'){
  await page.addInitScript(value=>sessionStorage.setItem('gojet_admin',value),token);
}
async function openUser(page){
  await page.goto(base+'/app/');
  await expect(page.locator('#shell')).toBeVisible();
}
async function openAdmin(page){
  await page.goto(base+'/admin/');
  await expect(page.locator('#adminView')).toBeVisible();
}
function commonUser(path){
  if(path==='/api/me')return {id:1,email:'owner@example.com',display_name:'负责人',status:'active',email_verified:true};
  if(path==='/api/workspaces')return {data:[{id:7,name:'GoJet 产品团队',type:'company',role:'owner'}]};
  if(path.includes('/overview'))return {today_clicks:12,month_clicks:80,unique_visitors:30,active_links:2,usage:{plan_name:'基础版',links:2,link_limit:100,qr_codes:0,qr_limit:25,members:1,member_limit:3,file_bytes:0,file_storage_bytes:1073741824},trend:[],recent:[],anomalies:[],generated_at:'2026-08-12T10:00:00Z'};
  if(path.includes('/organization'))return {campaigns:[],folders:[],tags:[]};
  if(path.includes('/domains'))return {data:[]};
  if(path.includes('/links'))return {data:[],total:0};
  return {data:[]};
}
function commonAdmin(path){
  if(path==='/api/admin/auth/me')return {id:1,email:'owner@example.test',display_name:'Owner',role:'super_admin',status:'active',totp_enabled:false,permissions:['*']};
  if(path==='/api/admin/overview')return {users:12,workspaces:4,active_links:28,today_clicks:932,mail_failures:0,abuse_reports:0,domain_errors:0,file_scan_backlog:0};
  return {data:[]};
}

test('customer console loads the canonical browser module bundle',async({page})=>{
  await seedUser(page);
  await page.route('**/api/**',route=>json(route,commonUser(new URL(route.request().url()).pathname)));
  await openUser(page);
  const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(entry=>new URL(entry.name).pathname));
  for(const resource of ['/app/app.js','/app/pages.js','/app/router.js','/app/pendinglink.js'])expect(resources).toContain(resource);
  await expect(page.getByText('GoJet',{exact:false}).first()).toBeVisible();
  await expect(page.getByRole('button',{name:'创建链接'})).toBeVisible();
});

test('team console renders active members and invitation lifecycle states',async({page})=>{
  await seedUser(page);
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/workspaces/7')return json(route,{
      workspace:{id:7,name:'GoJet 产品团队',type:'company',role:'owner'},
      members:[
        {user_id:1,email:'owner@example.com',display_name:'负责人',role:'owner',status:'active',joined_at:'2026-08-01T10:00:00Z'},
        {user_id:2,email:'analyst@example.com',display_name:'数据分析员',role:'analyst',status:'active',joined_at:'2026-08-02T10:00:00Z'}
      ],
      invitations:[
        {id:8,email:'editor@example.com',role:'editor',status:'pending',expires_at:'2026-08-19T10:00:00Z'},
        {id:9,email:'viewer@example.com',role:'viewer',status:'expired',expires_at:'2026-08-01T10:00:00Z'}
      ]
    });
    return json(route,commonUser(path));
  });
  await openUser(page);
  await page.getByRole('button',{name:'工作区与团队'}).click();
  await expect(page.getByText('数据分析员')).toBeVisible();
  await expect(page.getByText('等待接受')).toBeVisible();
  await expect(page.getByText('只读成员 · 已过期',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'重新发送'})).toHaveCount(2);
});

test('customer file sharing distinguishes clean downloads from quarantined scans',async({page})=>{
  await seedUser(page);
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.includes('/fileshares'))return json(route,{data:[{id:3,slug:'safe-file',original_name:'campaign.pdf',mime_type:'application/pdf',size_bytes:2048,scan_status:'clean',status:'active',downloads:2,max_downloads:10},{id:4,slug:'pending-file',original_name:'raw-assets.zip',mime_type:'application/zip',size_bytes:4096,scan_status:'pending',status:'quarantined',downloads:0}]});
    return json(route,commonUser(path));
  });
  await openUser(page);
  await page.getByRole('button',{name:'文件分享'}).click();
  await expect(page.getByText('campaign.pdf')).toBeVisible();
  await expect(page.getByText('等待检查')).toBeVisible();
  await expect(page.getByRole('link',{name:'打开分享页'})).toHaveAttribute('href','http://127.0.0.1:4173/f/safe-file');
  await expect(page.getByRole('button',{name:'删除'})).toHaveCount(2);
});

test('organization, text, bio and QR product surfaces use live API data',async({page})=>{
  await seedUser(page);
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.includes('/organization'))return json(route,{campaigns:[{id:3,name:'夏季投放',status:'active',links:12,clicks:932,conversions:41}],folders:[{id:4,name:'社交媒体',links:8}],tags:[{id:5,name:'重点',color:'#e11d48',links:6}]});
    const scriptWord='<scr'+'ipt>alert(1)</scr'+'ipt>';
    if(path.includes('/text-shares'))return json(route,{data:[{id:4,slug:'launch-notes',title:'发布说明 '+scriptWord,format:'markdown',status:'active',protected:true,one_time:false,views:18}]});
    if(path.includes('/bio-pages'))return json(route,{data:[{id:5,slug:'creator',title:'GoJet 创作者',bio:'集中展示所有内容入口',status:'published',theme:{primary:'#1769e0',background:'#f4f8fc'},blocks:[{label:'视频频道',url:'https://example.com'}],views:88}]});
    if(path.includes('/qr-codes'))return json(route,{data:[{id:6,link_id:9,name:'线下展会',image_url:'/generated/qr/demo.png',code:'expo',qr_visits:127,size:1024}]});
    return json(route,commonUser(path));
  });
  await openUser(page);
  await page.getByRole('button',{name:'推广与组织'}).click();
  await expect(page.locator('#organizationWorkspace').getByText('夏季投放',{exact:true})).toBeVisible();
  await expect(page.getByText(/41 次转化/)).toBeVisible();
  await page.getByRole('button',{name:'文本分享'}).click();
  await expect(page.getByText(/发布说明/)).toBeVisible();
  await expect(page.locator('.content script')).toHaveCount(0);
  await page.getByRole('button',{name:'个人主页'}).click();
  await expect(page.getByRole('heading',{name:'GoJet 创作者'})).toBeVisible();
  await expect(page.getByText(/88 次浏览/)).toBeVisible();
  await page.getByRole('button',{name:'二维码'}).click();
  await expect(page.getByText('线下展会')).toBeVisible();
  await expect(page.getByText(/127 次访问/)).toBeVisible();
  await expect(page.getByRole('button',{name:'创建二维码'})).toBeVisible();
});

test('link creator sends structured routing rules and stable A/B weights',async({page})=>{
  let created;
  await seedUser(page);
  await page.route('**/api/**',route=>{
    const request=route.request(),path=new URL(request.url()).pathname,method=request.method();
    if(path.includes('/links')&&method==='POST'){created=request.postDataJSON();return json(route,{ID:10,Code:'launch'},201)}
    return json(route,commonUser(path));
  });
  await openUser(page);
  await page.getByRole('button',{name:'创建链接'}).click();
  const editor=page.locator('#linkEditorForm');
  await editor.locator('[name=destination]').fill('https://default.example/landing');
  await editor.locator('summary').filter({hasText:'智能路由与 A/B 分流'}).click();
  await editor.locator('.ruleDimension').selectOption('country');
  await editor.locator('.ruleValue').fill('CN');
  await editor.locator('.ruleDestination').fill('https://cn.example/landing');
  const variants=editor.locator('.abRow');
  await variants.nth(0).locator('.abDestination').fill('https://a.example/landing');
  await variants.nth(1).locator('.abDestination').fill('https://b.example/landing');
  await editor.getByRole('button',{name:'创建短链接'}).click();
  await expect.poll(()=>created).toBeTruthy();
  expect(created.routing_rules).toEqual([{dimension:'country',value:'CN',destination:'https://cn.example/landing'}]);
  expect(created.ab_destinations).toEqual([
    {id:'variant-1',destination:'https://a.example/landing',weight:50},
    {id:'variant-2',destination:'https://b.example/landing',weight:50}
  ]);
});

test('customer billing can choose annual cycle before continuing into payment choice',async({page})=>{
  let requested;
  await seedUser(page);
  await page.route('**/api/**',route=>{
    const request=route.request(),path=new URL(request.url()).pathname,method=request.method();
    if(path.endsWith('/billing')&&method==='GET')return json(route,{subscription:{workspace_id:7,plan_code:'starter',plan_name:'基础版',status:'active',cancel_at_period_end:false},plans:[{id:1,code:'starter',name:'基础版',monthly_price_cents:0,currency:'CNY',description:'轻量项目',features:['100 条短链接']},{id:2,code:'pro',name:'专业版',monthly_price_cents:6900,currency:'CNY',description:'增长团队',features:['5,000 条短链接','180 天分析']}],invoices:[{id:9,invoice_number:'GJ-20260812-ABCDEF012345',plan_name:'专业版',invoice_type:'upgrade',billing_cycle:'monthly',period_months:1,amount_cents:6900,currency:'CNY',status:'pending',created_at:'2026-08-12T10:00:00Z',due_at:'2026-08-15T10:00:00Z'}]});
    if(path.endsWith('/billing/invoices')&&method==='POST'){requested=request.postDataJSON();return json(route,{id:10,invoice_number:'GJ-NEW',billing_cycle:'annual',period_months:12,amount_cents:82800,currency:'CNY',status:'pending'},201)}
    if(path.endsWith('/billing/payment-methods')&&method==='GET')return json(route,{data:[{code:'epay',name:'易支付',mode:'redirect'}]});
    return json(route,commonUser(path));
  });
  await openUser(page);
  await page.getByRole('button',{name:'套餐与账单'}).click();
  await expect(page.getByRole('heading',{name:'专业版'})).toBeVisible();
  await expect(page.getByText('GJ-20260812-ABCDEF012345')).toBeVisible();
  await page.getByRole('button',{name:'选择套餐'}).click();
  await page.locator('input[name="billing_cycle"][value="annual"]').check();
  await expect(page.locator('[data-cycle-total]')).toContainText('828');
  await page.getByRole('button',{name:'继续支付'}).click();
  await expect.poll(()=>requested).toEqual({plan_code:'pro',type:'upgrade',billing_cycle:'annual'});
  await expect(page.getByRole('heading',{name:'选择支付方式'})).toBeVisible();
  await expect(page.getByRole('button',{name:/易支付/})).toBeVisible();
});

test('administrator console loads every canonical management module',async({page})=>{
  await seedAdmin(page);
  await page.route('**/api/admin/**',route=>json(route,commonAdmin(new URL(route.request().url()).pathname)));
  await openAdmin(page);
  const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(entry=>new URL(entry.name).pathname));
  for(const resource of ['/admin/app.js','/admin/mailstatus.js','/admin/mailtemplates.js','/admin/productactions.js','/admin/billingadmin.js','/admin/settings.js','/admin/billingfxsettings.js','/admin/supportsecurity.js'])expect(resources).toContain(resource);
  await expect(page.getByRole('button',{name:'客户工单'})).toBeVisible();
  await expect(page.getByRole('button',{name:'系统设置',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'邮件服务',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'人机验证',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'系统设置',exact:true}).click();
  await expect(page.getByRole('button',{name:/邮件服务/})).toBeVisible();
  await expect(page.getByRole('button',{name:/人机验证/})).toBeVisible();
});

test('administrator TOTP login uses the current login form and fails closed',async({page})=>{
  await page.route('**/api/admin/**',route=>{
    const request=route.request(),path=new URL(route.request().url()).pathname;
    if(path==='/api/admin/auth/login'){
      const input=request.postDataJSON();
      if(input.code!=='123456')return json(route,{error:'请输入有效的二次验证码',two_factor_required:true},428);
      return json(route,{token:'a'.repeat(64),administrator:{id:1,email:'admin@example.com',display_name:'平台所有者',role:'super_admin',status:'active',totp_enabled:true,permissions:['*']}});
    }
    if(path==='/api/admin/overview')return json(route,{users:12,workspaces:4,active_links:28,today_clicks:932});
    return json(route,commonAdmin(path));
  });
  await page.goto(base+'/admin/');
  await page.getByLabel('管理员邮箱').fill('admin@example.com');
  await page.getByLabel('密码').fill('a-secure-admin-password');
  await page.locator('#loginForm button[type=submit]').click();
  await expect(page.getByText('请输入有效的二次验证码')).toBeVisible();
  await expect(page.locator('#loginTotp')).toBeVisible();
  await page.locator('#loginTotp [name=code]').fill('123456');
  await page.locator('#loginForm button[type=submit]').click();
  await expect(page.locator('#adminView')).toBeVisible();
  await expect(page.locator('#adminRole')).toHaveText('超级管理员');
});

test('administrator file security center retries a failed malware scan',async({page})=>{
  let retried=false;
  await seedAdmin(page);
  await page.route('**/api/admin/**',route=>{
    const request=route.request(),path=new URL(request.url()).pathname,method=request.method();
    if(path==='/api/admin/files'&&method==='GET')return json(route,{data:[{id:9,name:'campaign-assets.zip',mime:'application/zip',size:4096,scan_status:'error',status:'active',scan_result:'clamd connection: timeout',workspace:'营销团队',creator:'owner@example.com'},{id:8,name:'brief.pdf',mime:'application/pdf',size:2048,scan_status:'clean',status:'active',scan_result:'stream: OK',workspace:'创作者团队',creator:'editor@example.com'}]});
    if(path==='/api/admin/resources')return json(route,{data:[]});
    if(path==='/api/admin/files/9/retry-scan'&&method==='POST'){retried=true;return json(route,{queued:true})}
    return json(route,commonAdmin(path));
  });
  await openAdmin(page);
  await page.getByRole('button',{name:'文件安全'}).click();
  await expect(page.getByText('campaign-assets.zip')).toBeVisible();
  await expect(page.getByText('安全',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'重试扫描'}).click();
  await expect.poll(()=>retried).toBe(true);
  await expect(page.locator('#toast')).toContainText('文件已重新进入扫描队列');
});

test('administrator billing settles the current invoice through the canonical modal',async({page})=>{
  let settlement;
  await seedAdmin(page);
  await page.route('**/api/admin/**',route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method();
    if(path==='/api/admin/plans'&&method==='GET')return json(route,{data:[{id:2,code:'pro',name:'专业版',status:'active',monthly_price_cents:6900,currency:'CNY',description:'增长团队',features:['180 天分析'],link_limit:5000,qr_limit:1000,text_limit:1000,bio_limit:50,file_storage_bytes:10737418240,member_limit:10,analytics_retention_days:180}]});
    if(path==='/api/admin/invoices'&&method==='GET')return json(route,{data:[{id:9,invoice_number:'GJ-20260812-ABCDEF012345',workspace_id:7,plan_name:'专业版',invoice_type:'purchase',amount_cents:6900,currency:'CNY',status:'pending',due_at:'2026-08-15T10:00:00Z'}]});
    if(path==='/api/admin/invoices/9/settle'&&method==='POST'){settlement=request.postDataJSON();return json(route,{updated:true})}
    return json(route,commonAdmin(path));
  });
  await openAdmin(page);
  await page.getByRole('button',{name:'套餐与账单'}).click();
  await expect(page.getByText('GJ-20260812-ABCDEF012345')).toBeVisible();
  await page.getByRole('button',{name:'标记已支付'}).click();
  await page.getByLabel('处理备注（可选）').fill('银行流水已核验');
  await page.locator('#invoiceForm').getByRole('button',{name:'确认'}).click();
  await expect.poll(()=>settlement).toEqual({status:'paid',note:'银行流水已核验'});
  await expect(page.locator('#toast')).toContainText('账单状态已更新');
});

test('administrator diagnostics exposes live dependencies and direct audited actions',async({page})=>{
  let reconciled=false;
  await seedAdmin(page);
  await page.route('**/api/admin/**',route=>{
    const request=route.request(),path=new URL(request.url()).pathname,method=request.method();
    if(path==='/api/admin/diagnostics'&&method==='GET')return json(route,{database:{status:'operational',latency_ms:3,open_connections:5},redis:{status:'operational',latency_ms:1,stream_events:82,consumer_pending:4},maintenance_mode:false,alerts:[]});
    if(path==='/api/admin/diagnostics/reconcile'&&method==='POST'){reconciled=true;return json(route,{status:'success'})}
    return json(route,commonAdmin(path));
  });
  await openAdmin(page);
  await page.getByRole('button',{name:'系统状态'}).click();
  await expect(page.locator('.metric').filter({hasText:'MySQL'})).toContainText('operational');
  await expect(page.locator('.metric').filter({hasText:'Redis Stream'})).toContainText('82');
  await page.getByRole('button',{name:'执行平台对账'}).click();
  await page.getByRole('button',{name:'确认执行'}).click();
  await expect.poll(()=>reconciled).toBe(true);
  await expect(page.locator('#toast')).toContainText('平台对账完成');
});