import { expect, test, type Page, type Route } from "@playwright/test";

const viewports=[{name:"desktop",width:1440,height:900},{name:"tablet",width:1024,height:768},{name:"mobile",width:390,height:844}] as const;

async function fixture(page:Page){
  let replies=0;
  const json=(route:Route,body:unknown,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
  const ticket={id:41,ticket_number:"GJ-260818-ABCD1234",user_id:7,department_id:1,department_name:"Technical Support",subject:"Custom domain verification",priority:"high",status:"customer_reply",last_reply_at:"2026-08-18T08:10:00Z",last_reply_by:"customer",created_at:"2026-08-18T08:00:00Z"};
  await page.route("**/api/**",async route=>{
    const req=route.request();const path=new URL(req.url()).pathname;const method=req.method();
    if(method==="GET"&&path==="/api/session")return json(route,{authenticated:true,identity:{id:7,email:"owner@example.com",displayName:"P14 Owner",emailVerified:true},csrfToken:"p14-csrf"});
    if(method==="GET"&&path==="/api/public/turnstile")return json(route,{enabled:false,surface:new URL(req.url()).searchParams.get("surface")||""});
    if(method==="GET"&&path==="/api/support/departments")return json(route,{data:[{id:1,name:"Technical Support",slug:"technical",description:"Product help"}]});
    if(method==="GET"&&path==="/api/support/tickets")return json(route,{data:[ticket]});
    if(method==="GET"&&path==="/api/support/tickets/41")return json(route,{ticket,messages:[{id:1,author_type:"customer",author_name:"Ethan",body:"Verification is still pending.",internal:false,created_at:"2026-08-18T08:00:00Z"},{id:2,author_type:"administrator",author_name:"Support",body:"We are checking the DNS record.",internal:false,created_at:"2026-08-18T08:05:00Z"}]});
    if(method==="GET"&&path==="/api/support/tickets/41/attachments")return json(route,{data:[{id:9,ticket_id:41,message_id:1,original_name:"dns-proof.txt",mime_type:"text/plain",size_bytes:1200,scan_status:"clean",created_at:"2026-08-18T08:02:00Z",download_url:"/api/support/tickets/41/attachments/9"}]});
    if(method==="POST"&&path==="/api/support/tickets/41/replies"){replies+=1;return json(route,{saved:true},201);}
    if(method==="PATCH"&&path==="/api/support/tickets/41/state")return json(route,{updated:true});
    if(method==="POST"&&path==="/api/support/tickets")return json(route,{id:42,ticket_number:"GJ-260818-NEW",status:"open"},201);
    return json(route,{error:`Unhandled P14 support route: ${method} ${path}`},404);
  });
  return {get replies(){return replies;}};
}

function runtimeErrors(page:Page){const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});return errors;}
async function noOverflow(page:Page){const s=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));expect(s.scroll).toBeLessThanOrEqual(s.client+1);}

for(const viewport of viewports){
  test(`P14 Workspace Support · ${viewport.name}`,async({page})=>{
    await page.setViewportSize({width:viewport.width,height:viewport.height});const errors=runtimeErrors(page);const state=await fixture(page);await page.goto("/app/support");
    await expect(page.getByRole("heading",{name:"Help & support",exact:true})).toBeVisible();
    await expect(page.getByRole("heading",{name:"Create a ticket",exact:true})).toBeVisible();
    await expect(page.getByRole("heading",{name:"My tickets",exact:true})).toBeVisible();
    await expect(page.getByLabel("Attachments").first()).toBeVisible();
    await expect(page.getByText("GJ-260818-ABCD1234")).toBeVisible();
    await expect(page.getByRole("heading",{name:"Ticket conversation",exact:true})).toBeVisible();
    await expect(page.getByText("Verification is still pending.")).toBeVisible();
    await expect(page.getByText("We are checking the DNS record.")).toBeVisible();
    await expect(page.getByText("dns-proof.txt")).toBeVisible();
    await expect(page.getByRole("link",{name:"Download"})).toBeVisible();
    await page.getByLabel("Reply").fill("Thanks, I will keep the record in place.");
    await page.getByRole("button",{name:"Send reply"}).click();
    await expect.poll(()=>state.replies).toBe(1);
    await expect(page.getByLabel("Reply")).toHaveValue("");
    await noOverflow(page);expect(errors).toEqual([]);await page.screenshot({path:`test-results/p14-support-${viewport.name}.png`,fullPage:true});
  });
}
