const {test,expect}=require('@playwright/test');

const base='http://127.0.0.1:4173';
const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)});

async function seedUser(page){await page.addInitScript(()=>localStorage.setItem('gojet_token','workflow-user-token'))}
async function openUser(page){await page.goto(base+'/app/');await expect(page.locator('#shell')).toBeVisible()}
function commonUser(path){
  if(path==='/api/me')return{id:1,email:'owner@example.com',display_name:'负责人',status:'active',email_verified:true};
  if(path==='/api/workspaces')return{data:[{id:7,name:'GoJet 产品团队',type:'company',role:'owner'}]};
  if(path.includes('/overview'))return{today_clicks:0,month_clicks:0,unique_visitors:0,active_links:0,usage:{plan_name:'基础版',links:0,link_limit:100,qr_codes:0,qr_limit:25,members:1,member_limit:3,file_bytes:0,file_storage_bytes:1073741824},trend:[],recent:[],anomalies:[]};
  if(path==='/api/workspaces/7/link-domains')return{data:[]};
  if(path==='/api/workspaces/7/links')return{data:[],total:0};
  return{data:[]};
}
async function adminLogin(page){
  await page.goto(base+'/admin/');
  await page.getByLabel('管理员邮箱').fill('owner@example.test');
  await page.getByLabel('密码').fill('OwnerPassword!2026');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.locator('#adminView')).toBeVisible();
}

test('page-based link creator sends structured routing rules and stable A/B weights',async({page})=>{
  let created;
  await seedUser(page);
  await page.route('**/api/**',route=>{
    const request=route.request(),path=new URL(request.url()).pathname,method=request.method();
    if(path==='/api/workspaces/7/links'&&method==='POST'){
      created=request.postDataJSON();
      return json(route,{ID:10,Code:'launch',Destination:created.destination},201);
    }
    return json(route,commonUser(path));
  });
  await openUser(page);
  await page.getByRole('button',{name:'创建链接',exact:true}).click();
  const editor=page.locator('.workflowForm');
  await expect(editor).toBeVisible();
  await expect(page.locator('#linkEditorLayer:not(.hidden),.productModalLayer:not(.hidden)')).toHaveCount(0);
  await editor.locator('[name=destination]').fill('https://default.example/landing');
  await editor.locator('.workflowAdvanced > summary').click();
  await editor.locator('.ruleDimension').selectOption('country');
  await editor.locator('.ruleValue').fill('CN');
  await editor.locator('.ruleDestination').fill('https://cn.example/landing');
  const variants=editor.locator('.workflowABRow');
  await expect(variants).toHaveCount(2);
  await variants.nth(0).locator('.abDestination').fill('https://a.example/landing');
  await variants.nth(1).locator('.abDestination').fill('https://b.example/landing');
  await editor.getByRole('button',{name:'创建短链接',exact:true}).click();
  await expect.poll(()=>created).toBeTruthy();
  expect(created.routing_rules).toEqual([{dimension:'country',value:'CN',destination:'https://cn.example/landing'}]);
  expect(created.ab_destinations).toEqual([
    {id:'variant-1',destination:'https://a.example/landing',weight:50},
    {id:'variant-2',destination:'https://b.example/landing',weight:50}
  ]);
});

test('admin support queue opens a dedicated handling page with conversation and internal notes',async({page})=>{
  await adminLogin(page);
  await page.getByRole('button',{name:'客户工单',exact:true}).click();
  await expect(page.getByText('GJ-260811-A1B2C3D4',{exact:true})).toBeVisible();
  await expect(page.getByText('短链接跳转问题',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'处理',exact:true}).click();
  await expect(page.locator('.adminTicketPage')).toBeVisible();
  await expect(page.locator('#modal:not(.hidden)')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:/GJ-260811-A1B2C3D4/})).toBeVisible();
  await expect(page.locator('.adminTicketTimeline .adminTicketMessage')).toHaveCount(2);
  await expect(page.getByText('仅管理员可见，不会发送给客户。',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'发送回复',exact:true})).toBeVisible();
});
