const {test,expect}=require('@playwright/test');
const base=process.env.GOJET_SURFACE_BASE||'http://127.0.0.1:4173';

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
  const reg=await json(request,'POST','/api/auth/register',{email:`risk-sync-${stamp}@example.test`,display_name:'Risk Sync',password:'RiskSync!2026'});
  const workspaces=await json(request,'GET','/api/workspaces',undefined,reg.token);
  return{token:reg.token,workspace:workspaces.data[0].id};
}
async function createLink(request,user,suffix){
  return json(request,'POST',`/api/workspaces/${user.workspace}/links`,{destination:`https://example.com/${suffix}`,title:`Risk ${suffix}`,code:`rs${suffix}${String(Date.now()).slice(-5)}`,domain:'',redirect_status:302,status:'active',one_time:false,expires_at:null,max_clicks:null,password:''},user.token);
}
function id(link){return Number(link.ID??link.id)}
function code(link){return String(link.Code??link.code)}

// This is intentionally a browser contract test rather than a backend risk test.
// It proves the customer link list binds security state by link_id and refreshes
// that state while the page is open, including after DOM ordering changes.
test('link management stays synchronized with target-risk decisions by link id',async({page,request})=>{
  const user=await bootstrapUser(request);
  const first=await createLink(request,user,'alpha');
  const second=await createLink(request,user,'beta');
  let state={
    [id(first)]:{link_id:id(first),automatic_decision:'block',effective_decision:'block',score:100,provider:'test',pending:false,manual:false},
    [id(second)]:{link_id:id(second),automatic_decision:'allow',effective_decision:'allow',score:0,provider:'test',pending:false,manual:false},
  };
  await page.route(`**/api/workspaces/${user.workspace}/link-risks`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:Object.values(state)})}));
  await page.addInitScript(token=>localStorage.setItem('gojet_token',token),user.token);
  await page.goto(base+'/app/links');
  await expect(page.getByRole('heading',{name:'短链接',exact:true})).toBeVisible();
  const firstCard=page.locator('#lhLinks .shareCard').filter({hasText:code(first)});
  const secondCard=page.locator('#lhLinks .shareCard').filter({hasText:code(second)});
  await expect(firstCard.locator('.productStatus')).toHaveText('安全阻止');
  await expect(secondCard.locator('.productStatus')).toHaveText('正常使用');
  await expect(firstCard).toHaveAttribute('data-link-id',String(id(first)));
  await expect(secondCard).toHaveAttribute('data-link-id',String(id(second)));

  // Reorder the visible cards to ensure synchronization never depends on array index.
  await page.locator('#lhLinks .resourceStack').evaluate(stack=>{const cards=[...stack.children];cards.reverse().forEach(card=>stack.appendChild(card));});
  state={
    [id(first)]:{link_id:id(first),automatic_decision:'allow',effective_decision:'allow',score:0,provider:'test',pending:false,manual:true},
    [id(second)]:{link_id:id(second),automatic_decision:'block',effective_decision:'block',score:100,provider:'test',pending:false,manual:true},
  };
  await expect(firstCard.locator('.productStatus')).toHaveText('正常使用',{timeout:8000});
  await expect(secondCard.locator('.productStatus')).toHaveText('安全阻止',{timeout:8000});
  await expect(secondCard.getByRole('button',{name:'二维码'})).toBeDisabled();
});