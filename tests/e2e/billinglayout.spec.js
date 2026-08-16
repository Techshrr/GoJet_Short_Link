const {test,expect}=require('@playwright/test');
const fs=require('fs');
const base=process.env.GOJET_SURFACE_BASE||'http://127.0.0.1:4180';

test.skip(!process.env.GOJET_SURFACE_BASE,'requires the real Product Surface runtime');

async function json(request,method,path,body,token){
  const options={method,headers:{'Content-Type':'application/json'}};
  if(token)options.headers.Authorization=`Bearer ${token}`;
  if(body!==undefined)options.data=body;
  const response=await request.fetch(base+path,options);
  const data=await response.json().catch(()=>({}));
  if(!response.ok())throw new Error(`${method} ${path}: ${response.status()} ${JSON.stringify(data)}`);
  return data;
}

async function account(request){
  const stamp=Date.now()+Math.floor(Math.random()*100000);
  const registration=await json(request,'POST','/api/auth/register',{email:`billing-layout-${stamp}@example.test`,display_name:'Billing Layout',password:'BillingLayout!2026'});
  return registration.token;
}

async function session(page,token){await page.addInitScript(value=>localStorage.setItem('gojet_token',value),token)}

function rgb(value){const match=String(value||'').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);return match?match.slice(1).map(Number):null}

test('billing desktop uses one left edge and visually primary purchase actions',async({page,request})=>{
  const token=await account(request);
  await session(page,token);
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base+'/app/billing');
  await expect(page.getByRole('heading',{name:'套餐与账单'})).toBeVisible();
  await expect(page.locator('.content')).toHaveClass(/billingAcceptancePage/);
  await expect(page.locator('.billingPlans .planCard')).toHaveCount(3);

  const geometry=await page.evaluate(()=>{
    const rect=selector=>{const node=document.querySelector(selector);if(!node)return null;const r=node.getBoundingClientRect();return{x:r.x,width:r.width,right:r.right}};
    return {
      content:rect('.content.billingAcceptancePage'),
      head:rect('.billingAcceptancePage .productPageHead'),
      summary:rect('.billingAcceptancePage #billingWorkspace > .billingSummary'),
      sections:[...document.querySelectorAll('.billingAcceptancePage #billingWorkspace > .billingSection')].map(node=>{const r=node.getBoundingClientRect();return{x:r.x,width:r.width,right:r.right}}),
      grid:getComputedStyle(document.querySelector('.billingAcceptancePage .billingPlans')).gridTemplateColumns,
      bodyScroll:document.documentElement.scrollWidth,
      bodyClient:document.documentElement.clientWidth,
    };
  });
  expect(geometry.content).toBeTruthy();
  expect(geometry.head).toBeTruthy();
  expect(geometry.summary).toBeTruthy();
  expect(Math.abs(geometry.summary.x-geometry.head.x)).toBeLessThanOrEqual(2);
  for(const section of geometry.sections){
    expect(Math.abs(section.x-geometry.head.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(section.width-geometry.summary.width)).toBeLessThanOrEqual(2);
  }
  expect(geometry.grid.trim().split(/\s+/)).toHaveLength(3);
  expect(geometry.bodyScroll).toBeLessThanOrEqual(geometry.bodyClient+1);

  const purchase=page.locator('.billingAcceptancePage .planCardFoot > button[data-plan]:not(:disabled)').first();
  await expect(purchase).toBeVisible();
  const visual=await purchase.evaluate(node=>{const style=getComputedStyle(node),r=node.getBoundingClientRect();return{background:style.backgroundColor,color:style.color,height:r.height,width:r.width}});
  const background=rgb(visual.background),foreground=rgb(visual.color);
  expect(background).toBeTruthy();
  expect(foreground).toBeTruthy();
  expect(Math.max(...background)).toBeLessThan(245);
  expect(Math.min(...foreground)).toBeGreaterThan(220);
  expect(visual.height).toBeGreaterThanOrEqual(40);
  expect(visual.width).toBeGreaterThan(160);

  fs.mkdirSync('test-results/visual-evidence',{recursive:true});
  await page.screenshot({path:'test-results/visual-evidence/billing-layout-desktop.png',fullPage:true});
});

test('billing collapses to one deliberate column on mobile without overflow',async({page,request})=>{
  const token=await account(request);
  await session(page,token);
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'/app/billing');
  await expect(page.getByRole('heading',{name:'套餐与账单'})).toBeVisible();
  const layout=await page.evaluate(()=>({
    grid:getComputedStyle(document.querySelector('.billingPlans')).gridTemplateColumns,
    bodyScroll:document.documentElement.scrollWidth,
    bodyClient:document.documentElement.clientWidth,
    cards:[...document.querySelectorAll('.billingPlans .planCard')].map(node=>node.getBoundingClientRect().width),
  }));
  expect(layout.grid.trim().split(/\s+/)).toHaveLength(1);
  expect(layout.bodyScroll).toBeLessThanOrEqual(layout.bodyClient+1);
  expect(layout.cards).toHaveLength(3);
  for(const width of layout.cards)expect(width).toBeGreaterThan(250);
});
