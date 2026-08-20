import { expect, test, type Page, type Route } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 }
] as const;

interface Options { viewer?: boolean; empty?: boolean; failList?: boolean; quotaOnCreate?: boolean; }
interface State { requests: string[]; creates: number; updates: number; deletes: number[]; }
type TextItem = { id:number; slug:string; title:string; content?:string; format:"plain"|"markdown"|"code"; status:"active"|"paused"|"consumed"|"expired"; expires_at:string|null; one_time:boolean; protected:boolean; views:number; created_at:string; };

function fixtures(): TextItem[] { return [
  { id:11, slug:"release-notes", title:"Release notes", format:"markdown", status:"active", expires_at:null, one_time:false, protected:true, views:41, created_at:"2026-08-18T05:00:00Z" },
  { id:12, slug:"single-use-log", title:"Single use log", format:"code", status:"consumed", expires_at:null, one_time:true, protected:false, views:1, created_at:"2026-08-18T05:04:00Z" }
]; }

async function fixture(page: Page, options: Options = {}): Promise<State> {
  const state: State = { requests: [], creates: 0, updates: 0, deletes: [] };
  const items = options.empty ? [] : fixtures();
  const content = new Map<number,string>([[11,"# Release\n\n**Production** is ready."],[12,"GET /health 200"]]);
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType:"application/json", body:JSON.stringify(body) });
  await page.route("**/api/**", async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const method = request.method(); state.requests.push(`${method} ${path}`);
    if (method === "GET" && path === "/api/session") return json(route,{authenticated:true,identity:{id:7,email:"owner@example.com",displayName:"P10 Owner",emailVerified:true},csrfToken:"p10-csrf"});
    if (method === "GET" && path === "/api/workspaces") return json(route,{data:[{id:1,name:"P10 Workspace",type:"personal",role:options.viewer?"viewer":"owner"}]});
    if (method === "GET" && path === "/api/workspaces/1/text-shares") { if (options.failList) return json(route,{error:"text service temporarily unavailable"},503); return json(route,{data:items}); }
    if (method === "GET" && /^\/api\/workspaces\/1\/text-shares\/\d+$/.test(path)) { const id=Number(path.split("/").pop()); const item=items.find((row)=>row.id===id); if (!item) return json(route,{error:"not found"},404); return json(route,{...item,content:content.get(id)??""}); }
    if (method === "POST" && path === "/api/workspaces/1/text-shares") {
      if (options.quotaOnCreate) return json(route,{error:"text quota limit reached"},422);
      state.creates += 1; const payload=request.postDataJSON() as Record<string,unknown>; const created:TextItem={id:20+state.creates,slug:String(payload.slug||`text-${state.creates}`),title:String(payload.title),format:payload.format as TextItem["format"],status:"active",expires_at:(payload.expires_at as string|null)??null,one_time:Boolean(payload.one_time),protected:Boolean(payload.password),views:0,created_at:"2026-08-18T06:00:00Z"}; content.set(created.id,String(payload.content??"")); items.unshift(created); return json(route,created,201);
    }
    if (method === "PUT" && /^\/api\/workspaces\/1\/text-shares\/\d+$/.test(path)) { state.updates += 1; const id=Number(path.split("/").pop()); const payload=request.postDataJSON() as Record<string,unknown>; const item=items.find((row)=>row.id===id); if (!item) return json(route,{error:"not found"},404); Object.assign(item,{title:String(payload.title),format:payload.format,status:payload.status,expires_at:payload.expires_at,one_time:payload.one_time}); content.set(id,String(payload.content??"")); return json(route,{...item,content:content.get(id)}); }
    if (method === "DELETE" && /^\/api\/workspaces\/1\/text-shares\/\d+$/.test(path)) { const id=Number(path.split("/").pop()); state.deletes.push(id); const index=items.findIndex((row)=>row.id===id); if(index>=0)items.splice(index,1); return route.fulfill({status:204,body:""}); }
    return json(route,{error:`Unhandled P10 route: ${method} ${path}`},404);
  });
  return state;
}

function runtimeErrors(page: Page) { const errors:string[]=[]; page.on("pageerror",(error)=>errors.push(error.message)); page.on("console",(message)=>{if(message.type()==="error")errors.push(message.text());}); return errors; }
async function noOverflow(page: Page) { const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})); expect(size.scroll).toBeLessThanOrEqual(size.client+1); }

for (const viewport of viewports) {
  test(`P10 Text vertical slice · ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({width:viewport.width,height:viewport.height}); const errors=runtimeErrors(page); const state=await fixture(page); await page.goto("/app/text?workspace=1");
    await expect(page.getByRole("heading",{name:"Text sharing",exact:true})).toBeVisible();
    await expect(page.getByText("Release notes")).toBeVisible();
    await expect(page.getByText("Single use log")).toBeVisible();
    await expect(page.locator('[data-text-id="11"]')).toHaveAttribute("data-text-state","active");
    await expect(page.locator('[data-text-id="12"]')).toHaveAttribute("data-text-state","consumed");
    await expect(page.getByRole("link",{name:"Open text",exact:true})).toHaveCount(2);

    await page.getByRole("button",{name:"New text share"}).click();
    const sheet=page.locator(".gj-side-sheet-popup");
    await expect(sheet).toBeVisible();
    const box=await sheet.boundingBox(); expect(box).not.toBeNull();
    if(viewport.name==="mobile") expect(Math.round(box!.width)).toBeGreaterThanOrEqual(viewport.width-1); else { expect(box!.width).toBeGreaterThanOrEqual(520); expect(box!.width).toBeLessThanOrEqual(560); }
    await sheet.getByLabel("Title").fill("Browser contract");
    await sheet.getByLabel("Display format").selectOption("markdown");
    await sheet.getByLabel("Content").fill("# Browser\n\nP10 exact head");
    await sheet.getByLabel("Public slug").fill("browser-contract");
    await sheet.getByRole("checkbox",{name:"One-time access"}).click();
    await sheet.getByRole("button",{name:"Create text share",exact:true}).click();
    await expect.poll(()=>state.creates).toBe(1);
    await expect(page.getByText("Browser contract")).toBeVisible();

    await noOverflow(page); expect(errors).toEqual([]); await page.screenshot({path:`test-results/p10-text-${viewport.name}.png`,fullPage:true});
  });
}

test("P10 Text read-only RBAC", async ({page})=>{
  await fixture(page,{viewer:true}); await page.goto("/app/text?workspace=1");
  await expect(page.getByText("Read-only text sharing")).toBeVisible();
  await expect(page.getByRole("button",{name:"New text share"})).toHaveCount(0);
  await expect(page.locator('[data-text-id="11"]').getByRole("button",{name:"Edit"})).toHaveCount(0);
});

test("P10 Text empty state", async ({page})=>{ await fixture(page,{empty:true}); await page.goto("/app/text?workspace=1"); await expect(page.getByText("No text shares")).toBeVisible(); });

test("P10 Text disabled state", async ({page})=>{ await fixture(page,{failList:true}); await page.goto("/app/text?workspace=1"); await expect(page.getByText("Unable to load text shares")).toBeVisible(); await expect(page.getByText("text service temporarily unavailable")).toBeVisible(); await expect(page.getByRole("button",{name:"Retry"})).toBeVisible(); });

test("P10 Text quota state", async ({page})=>{
  await fixture(page,{quotaOnCreate:true}); await page.goto("/app/text?workspace=1");
  await page.getByRole("button",{name:"New text share"}).click(); const sheet=page.locator(".gj-side-sheet-popup");
  await sheet.getByLabel("Title").fill("Quota test"); await sheet.getByLabel("Content").fill("quota");
  await sheet.getByRole("button",{name:"Create text share",exact:true}).click();
  await expect(sheet.getByText("Text sharing allowance reached")).toBeVisible();
});

test("P10 Text terminal consumed state is immutable", async ({page})=>{
  await fixture(page); await page.goto("/app/text?workspace=1");
  const terminal=page.locator('[data-text-id="12"]');
  await expect(terminal).toHaveAttribute("data-text-state","consumed");
  await expect(terminal.getByText("Consumed",{exact:true})).toBeVisible();
  await expect(terminal.getByRole("button",{name:"Edit"})).toHaveCount(0);
  await expect(terminal.getByRole("link",{name:"Open text",exact:true})).toBeVisible();
});
