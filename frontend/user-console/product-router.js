(()=>{
const routeToView={'/app/':'overview','/app/dashboard':'overview','/app/links':'links','/app/team':'team','/app/organization':'organization','/app/domains':'domains','/app/text':'texts','/app/bio':'bios','/app/files':'files','/app/qr':'qrs','/app/billing':'billing','/app/analytics':'analytics','/app/settings':'settings'};
const viewToRoute={overview:'/app/dashboard',links:'/app/links',team:'/app/team',organization:'/app/organization',domains:'/app/domains',texts:'/app/text',bios:'/app/bio',files:'/app/files',qrs:'/app/qr',billing:'/app/billing',analytics:'/app/analytics',settings:'/app/settings'};
function activate(view){document.querySelectorAll('[data-console-view]').forEach(x=>x.classList.toggle('active',x.dataset.consoleView===view))}
function ready(fn){let n=0;const t=setInterval(()=>{if(typeof state!=='undefined'&&state.workspace){clearInterval(t);fn()}else if(++n>100)clearInterval(t)},80)}
async function show(view,push=false){
 activate(view);if(push)history.pushState({view},'',viewToRoute[view]||'/app/dashboard');
 try{
  if(window.GoJetProductHardening&&window.GoJetProductHardening[view])return await window.GoJetProductHardening[view]();
  if(view==='overview')return await renderOverview();
  if(view==='team')return await renderTeam();
  if(view==='organization')return await renderOrganization();
  if(view==='domains')return await renderDomains();
  if(view==='bios')return await renderBios();
  if(view==='billing')return await renderBilling();
  if(view==='analytics')return await renderGlobalAnalytics();
  if(view==='settings')return await renderAccountSettings();
  return await renderOverview();
 }catch(err){console.error(err);const c=document.querySelector('.content');if(c)c.innerHTML=`<div class="productError">${escapeHTML(err.message||'页面加载失败')}</div>`}
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-console-view]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();show(b.dataset.consoleView,true)},true);
addEventListener('popstate',()=>ready(()=>show(routeToView[location.pathname]||'overview',false)));
ready(()=>show(routeToView[location.pathname]||'overview',false));

async function renderGlobalAnalytics(){
 const wid=state.workspace,[overview,links]=await Promise.all([api(`/api/workspaces/${wid}/overview`).catch(()=>({})),api(`/api/workspaces/${wid}/links?limit=50&offset=0`).catch(()=>({data:[]}))]),rows=links.data||[];
 const clicks=overview.total_clicks??overview.clicks??rows.reduce((n,x)=>n+Number(x.clicks||0),0),visitors=overview.unique_visitors??overview.visitors??rows.reduce((n,x)=>n+Number(x.unique_visitors||x.visitors||0),0),active=overview.active_links??rows.filter(x=>x.status==='active').length;
 document.querySelector('.content').innerHTML=`<div class="productPageHead"><div><span class="eyebrow">ANALYTICS</span><h1>访问分析</h1><p>工作区整体表现，以及每条短链接的点击与独立访客。</p></div><button id="analyticsRefresh">刷新数据</button></div><div class="metrics"><article><span>累计点击</span><strong>${Number(clicks||0).toLocaleString()}</strong></article><article><span>独立访客</span><strong>${Number(visitors||0).toLocaleString()}</strong></article><article><span>活跃链接</span><strong>${Number(active||0).toLocaleString()}</strong></article><article><span>链接总数</span><strong>${Number(rows.length).toLocaleString()}</strong></article></div><div class="tableWrap"><table><thead><tr><th>短码</th><th>目标地址</th><th>点击</th><th>访客</th><th>状态</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${escapeHTML(x.code||x.Code||'—')}</td><td>${escapeHTML(x.destination||x.Destination||'—')}</td><td>${Number(x.clicks||x.Clicks||0).toLocaleString()}</td><td>${Number(x.unique_visitors||x.visitors||x.Visitors||0).toLocaleString()}</td><td>${escapeHTML(x.status||x.Status||'—')}</td></tr>`).join('')||'<tr><td colspan="5">当前工作区还没有短链接数据。</td></tr>'}</tbody></table></div>`;document.querySelector('#analyticsRefresh').onclick=renderGlobalAnalytics;
}
async function renderAccountSettings(){
 const user=await api('/api/me'),content=document.querySelector('.content');content.innerHTML=`<div class="productPageHead"><div><span class="eyebrow">ACCOUNT</span><h1>账户设置</h1><p>管理个人资料、登录密码和当前会话。</p></div><button id="accountLogout">退出登录</button></div><div class="settingsGrid"><form id="profileSettings" class="resourceForm"><h3>个人资料</h3><label>邮箱<input value="${escapeHTML(user.email)}" disabled></label><label>显示名称<input name="display_name" value="${escapeHTML(user.display_name)}" maxlength="120" required></label><div class="error" id="profileError"></div><button class="primary">保存资料</button></form><form id="passwordSettings" class="resourceForm"><h3>修改密码</h3><p>修改成功后所有旧会话都会立即失效。</p><label>当前密码<input name="current_password" type="password" autocomplete="current-password" required></label><label>新密码<input name="new_password" type="password" autocomplete="new-password" minlength="10" required></label><label>确认新密码<input name="confirmation" type="password" autocomplete="new-password" minlength="10" required></label><div class="error" id="passwordError"></div><button class="primary">修改密码</button></form></div>`;
 document.querySelector('#profileSettings').onsubmit=async e=>{e.preventDefault();const name=new FormData(e.currentTarget).get('display_name');try{const updated=await api('/api/me',{method:'PATCH',body:JSON.stringify({display_name:name})});document.querySelector('#userName').textContent=updated.display_name||name;document.querySelector('#profileError').textContent='资料已保存'}catch(err){document.querySelector('#profileError').textContent=err.message}};
 document.querySelector('#passwordSettings').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));if(f.new_password!==f.confirmation){document.querySelector('#passwordError').textContent='两次输入的新密码不一致';return}try{await api('/api/me/password',{method:'POST',body:JSON.stringify({current_password:f.current_password,new_password:f.new_password})});localStorage.removeItem('gojet_token');state.token=null;location.replace('/login')}catch(err){document.querySelector('#passwordError').textContent=err.message}};
 document.querySelector('#accountLogout').onclick=logout;
}
async function logout(){try{await api('/api/auth/logout',{method:'POST'})}catch{}localStorage.removeItem('gojet_token');state.token=null;location.replace('/login')}
})();