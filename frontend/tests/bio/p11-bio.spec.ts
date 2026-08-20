import { expect, test, type Page, type Route } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 }
] as const;

type BioItem = { id:number; slug:string; title:string; bio:string; status:"draft"|"published"|"paused"; theme:Record<string,string>; blocks:Array<{Label:string;URL:string}>; views:number; created_at:string; };
interface Options { viewer?: boolean; empty?: boolean; failList?: boolean; quotaOnCreate?: boolean; }
interface State { creates:number; updates:number; deletes:number[]; requests:string[]; }

function fixtures(): BioItem[] { return [
  { id:31, slug:"creator", title:"Creator page", bio:"Build, ship and share.", status:"published", theme:{Primary:"#16a66a",Background:"#f5faf7",Ink:"#14231d",Muted:"#66766f",Surface:"#ffffff"}, blocks:[{Label:"GoJet",URL:"https://gojet.cc/"},{Label:"GitHub",URL:"https://github.com/"}], views:82, created_at:"2026-08-18T07:00:00Z" },
  { id:32, slug:"draft-page", title:"Draft page", bio:"Work in progress", status:"draft", theme:{Primary:"#1769e0",Background:"#f7f9fc"}, blocks:[], views:0, created_at:"2026-08-18T07:05:00Z" }
]; }

async function fixture(page:Page, options:Options={}):Promise<State>{
  const state:State={creates:0,updates:0,deletes:[],requests:[]}; const items=options.empty?[]:fixtures();
  const json=(route:Route,body:unknown,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
  await page.route("**/api/**",async(route)=>{ const req=route.request(); const path=new URL(req.url()).pathname; const method=req.method(); state.requests.push(`${method} ${path}`);
    if(method==="GET"&&path==="/api/session") return json(route,{authenticated:true,identity:{id:7,email:"owner@example.com",displayName:"P11 Owner",emailVerified:true},csrfToken:"p11-csrf"});
    if(method==="GET"&&path==="/api/workspaces") return json(route,{data:[{id:1,name:"P11 Workspace",type:"personal",role:options.viewer?"viewer":"owner"}]});
    if(method==="GET"&&path==="/api/workspaces/1/bio-pages"){ if(options.failList)return json(route,{error:"bio service unavailable"},503); return json(route,{data:items}); }
    if(method==="POST"&&path==="/api/workspaces/1/bio-pages"){ if(options.quotaOnCreate)return json(route,{error:"bio quota limit reached"},422); state.creates+=1; const p=req.postDataJSON() as Record<string,unknown>; const created:BioItem={id:40+state.creates,slug:String(p.slug||`bio-${state.creates}`),title:String(p.title),bio:String(p.bio||""),status:(p.status as BioItem["status"])||"draft",theme:p.theme as Record<string,string>,blocks:(p.blocks as BioItem["blocks"])||[],views:0,created_at:"2026-08-18T07:10:00Z"}; items.unshift(created); return json(route,created,201); }
    if(method==="PUT"&&/^\/api\/workspaces\/1\/bio-pages\/\d+$/.test(path)){ state.updates+=1; const id=Number(path.split("/").pop()); const item=items.find((row)=>row.id===id); if(!item)return json(route,{error:"not found"},404); const p=req.postDataJSON() as Record<string,unknown>; Object.assign(item,{title:String(p.title),bio:String(p.bio||""),status:p.status,theme:p.theme,blocks:p.blocks}); return json(route,{updated:true}); }
    if(method==="DELETE"&&/^\/api\/workspaces\/1\/bio-pages\/\d+$/.test(path)){ const id=Number(path.split("/").pop()); state.deletes.push(id); const index=items.findIndex((row)=>row.id===id); if(index>=0)items.splice(index,1); return route.fulfill({status:204,body:""}); }
    return json(route,{error:`Unhandled P11 route: ${method} ${path}`},404);
  }); return state;
}

function runtimeErrors(page:Page){const errors:string[]=[];page.on("pageerror",(e)=>errors.push(e.message));page.on("console",(m)=>{if(m.type()==="error")errors.push(m.text());});return errors;}
async function noOverflow(page:Page){const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));expect(size.scroll).toBeLessThanOrEqual(size.client+1);}

for(const viewport of viewports){
  test(`P11 profile builder · ${viewport.name}`,async({page})=>{
    await page.setViewportSize({width:viewport.width,height:viewport.height}); const errors=runtimeErrors(page); const state=await fixture(page); await page.goto("/app/bio?workspace=1");
    await expect(page.getByRole("heading",{name:"Profile pages",exact:true})).toBeVisible(); await expect(page.getByText("Creator page")).toBeVisible();
    await page.locator('[data-bio-id="31"]').click(); await expect(page.locator("[data-bio-builder]")).toBeVisible(); await expect(page.getByLabel("Profile live phone preview")).toContainText("Build, ship and share.");
    await expect(page.getByRole("tab")).toHaveCount(7); for(const name of ["Content","Appearance","Social","Domain","Analytics","SEO","Settings"]) await expect(page.getByRole("tab",{name,exact:true})).toBeVisible();
    await page.getByRole("tab",{name:"Content",exact:true}).click(); await page.getByLabel("Introduction",{exact:true}).fill("Updated from P11 browser gate"); await page.getByRole("button",{name:"Save changes",exact:true}).click(); await expect(page.getByText("Saved",{exact:true})).toBeVisible(); expect(state.updates).toBe(1);
    await expect(page.getByLabel("Profile live phone preview")).toContainText("Updated from P11 browser gate");
    await page.getByRole("tab",{name:"SEO",exact:true}).click(); await expect(page.getByText("Search indexing is disabled")).toBeVisible();
    await page.getByRole("button",{name:"New profile page"}).click(); const sheet=page.locator(".gj-side-sheet-popup"); await expect(sheet).toBeVisible();
    const box=await sheet.boundingBox(); expect(box).not.toBeNull(); if(viewport.name==="mobile") expect(Math.round(box!.width)).toBeGreaterThanOrEqual(viewport.width-1); else { expect(box!.width).toBeGreaterThanOrEqual(520); expect(box!.width).toBeLessThanOrEqual(560); }
    await sheet.getByLabel("Page title").fill("New public profile"); await sheet.getByLabel("Public slug").fill("new-profile"); await sheet.getByRole("button",{name:"Create profile page",exact:true}).click(); await expect(sheet.getByText("Profile page created")).toBeVisible(); expect(state.creates).toBe(1);
    await noOverflow(page); expect(errors).toEqual([]); await page.screenshot({path:`test-results/p11-bio-${viewport.name}.png`,fullPage:true});
  });
}

test("P11 profile pages read-only RBAC",async({page})=>{await fixture(page,{viewer:true});await page.goto("/app/bio?workspace=1");await expect(page.getByText("Read-only profile pages").first()).toBeVisible();await expect(page.getByRole("button",{name:"New profile page"})).toHaveCount(0);await page.locator('[data-bio-id="31"]').click();await expect(page.getByRole("button",{name:"Save changes"})).toHaveCount(0);await expect(page.getByLabel("Profile live phone preview")).toBeVisible();});

test("P11 profile pages empty state",async({page})=>{await fixture(page,{empty:true});await page.goto("/app/bio?workspace=1");await expect(page.getByText("No profile pages")).toBeVisible();});

test("P11 profile pages disabled state",async({page})=>{await fixture(page,{failList:true});await page.goto("/app/bio?workspace=1");await expect(page.getByText("Profile-page service unavailable")).toBeVisible();await expect(page.getByRole("button",{name:"Retry"})).toBeVisible();});

test("P11 profile pages quota state",async({page})=>{await fixture(page,{quotaOnCreate:true});await page.goto("/app/bio?workspace=1");await page.getByRole("button",{name:"New profile page"}).click();const sheet=page.locator(".gj-side-sheet-popup");await sheet.getByLabel("Page title").fill("Quota profile");await sheet.getByRole("button",{name:"Create profile page",exact:true}).click();await expect(sheet.getByText("Profile-page allowance reached")).toBeVisible();});
