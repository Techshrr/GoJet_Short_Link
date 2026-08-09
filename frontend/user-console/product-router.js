(()=>{
  const routeToView={
    '/app/':'overview','/app/dashboard':'overview','/app/links':'links','/app/team':'team',
    '/app/organization':'organization','/app/domains':'domains','/app/text':'texts','/app/bio':'bios',
    '/app/files':'files','/app/qr':'qrs','/app/billing':'billing','/app/analytics':'analytics','/app/settings':'settings'
  };
  const viewToRoute={overview:'/app/dashboard',links:'/app/links',team:'/app/team',organization:'/app/organization',domains:'/app/domains',texts:'/app/text',bios:'/app/bio',files:'/app/files',qrs:'/app/qr',billing:'/app/billing',analytics:'/app/analytics',settings:'/app/settings'};
  const functions={overview:()=>renderOverview(),team:()=>renderTeam(),organization:()=>renderOrganization(),domains:()=>renderDomains(),texts:()=>renderTexts(),bios:()=>renderBios(),files:()=>renderFiles(),qrs:()=>renderQRs(),billing:()=>renderBilling(),analytics:()=>renderGlobalAnalytics(),settings:()=>renderAccountSettings()};

  function activate(view){document.querySelectorAll('[data-console-view]').forEach(x=>x.classList.toggle('active',x.dataset.consoleView===view))}
  function ready(fn){let n=0;const t=setInterval(()=>{if(state?.workspace){clearInterval(t);fn()}else if(++n>80)clearInterval(t)},100)}
  async function show(view,push=false){
    activate(view);
    if(push)history.pushState({view},'',viewToRoute[view]||'/app/dashboard');
    if(view==='links'){
      if(new URLSearchParams(location.search).get('view')!=='links'){
        const target=(viewToRoute.links||'/app/links')+'?view=links';
        location.assign(target);return;
      }
      return;
    }
    const fn=functions[view]||functions.overview;
    try{await fn()}catch(err){console.error(err)}
  }

  document.addEventListener('click',e=>{
    const button=e.target.closest('[data-console-view]');
    if(!button)return;
    e.preventDefault();e.stopImmediatePropagation();
    show(button.dataset.consoleView,true);
  },true);

  addEventListener('popstate',()=>ready(()=>show(routeToView[location.pathname]||'overview',false)));

  const initial=routeToView[location.pathname]||'overview';
  if(initial==='links'&&new URLSearchParams(location.search).get('view')!=='links'){
    location.replace('/app/links?view=links');return;
  }
  if(initial==='links'&&new URLSearchParams(location.search).get('view')==='links'){
    history.replaceState({view:'links'},'', '/app/links');
    activate('links');
  }else{
    ready(()=>show(initial,false));
  }

  async function renderGlobalAnalytics(){
    const wid=state.workspace;
    const [overview,links]=await Promise.all([
      api(`/api/workspaces/${wid}/overview`).catch(()=>({})),
      api(`/api/workspaces/${wid}/links?limit=50&offset=0`).catch(()=>({data:[]}))
    ]);
    const rows=(links.data||[]);
    const clicks=overview.total_clicks??overview.clicks??rows.reduce((n,x)=>n+Number(x.clicks||0),0);
    const visitors=overview.unique_visitors??overview.visitors??rows.reduce((n,x)=>n+Number(x.unique_visitors||x.visitors||0),0);
    const active=overview.active_links??rows.filter(x=>x.status==='active').length;
    const content=document.querySelector('.content');
    content.innerHTML=`<div class="title"><div><small>Analytics</small><h1>工作区访问分析</h1><p>汇总当前工作区的真实短链访问表现，并可继续进入单条链接查看详细事件。</p></div><button id="analyticsRefresh">刷新数据</button></div>
      <div class="metrics"><article><span>累计点击</span><strong>${Number(clicks||0).toLocaleString()}</strong></article><article><span>独立访客</span><strong>${Number(visitors||0).toLocaleString()}</strong></article><article><span>活跃链接</span><strong>${Number(active||0).toLocaleString()}</strong></article><article><span>链接总数</span><strong>${Number(rows.length).toLocaleString()}</strong></article></div>
      <div class="tableWrap"><table><thead><tr><th>短码</th><th>目标地址</th><th>点击</th><th>访客</th><th>状态</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${escapeHTML(x.code||'—')}</td><td>${escapeHTML(x.destination||'—')}</td><td>${Number(x.clicks||0).toLocaleString()}</td><td>${Number(x.unique_visitors||x.visitors||0).toLocaleString()}</td><td>${escapeHTML(x.status||'—')}</td></tr>`).join('')||'<tr><td colspan="5">当前工作区还没有短链接数据。</td></tr>'}</tbody></table></div>`;
    $('#analyticsRefresh').onclick=renderGlobalAnalytics;
  }

  async function renderAccountSettings(){
    const user=await api('/api/me');
    const content=document.querySelector('.content');
    content.innerHTML=`<div class="title"><div><small>账户</small><h1>账户设置</h1><p>管理个人资料、登录密码和当前会话。</p></div><button id="accountLogout">退出登录</button></div>
      <div class="settingsGrid">
        <form id="profileSettings" class="resourceForm"><h3>个人资料</h3><label>邮箱<input value="${escapeHTML(user.email)}" disabled></label><label>显示名称<input name="display_name" value="${escapeHTML(user.display_name)}" maxlength="120" required></label><div class="error" id="profileError"></div><button class="primary">保存资料</button></form>
        <form id="passwordSettings" class="resourceForm"><h3>修改密码</h3><p>修改成功后当前和其他设备的登录会话都会立即失效。</p><label>当前密码<input name="current_password" type="password" autocomplete="current-password" required></label><label>新密码<input name="new_password" type="password" autocomplete="new-password" minlength="10" required></label><label>确认新密码<input name="confirmation" type="password" autocomplete="new-password" minlength="10" required></label><div class="error" id="passwordError"></div><button class="primary">修改密码</button></form>
      </div>`;
    $('#profileSettings').onsubmit=async e=>{e.preventDefault();try{const updated=await api('/api/me',{method:'PATCH',body:JSON.stringify({display_name:new FormData(e.currentTarget).get('display_name')})});$('#userName').textContent=updated.display_name||new FormData(e.currentTarget).get('display_name');$('#profileError').textContent='资料已保存'}catch(err){$('#profileError').textContent=err.message}};
    $('#passwordSettings').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));if(f.new_password!==f.confirmation){$('#passwordError').textContent='两次输入的新密码不一致';return}try{await api('/api/me/password',{method:'POST',body:JSON.stringify({current_password:f.current_password,new_password:f.new_password})});localStorage.removeItem('gojet_token');state.token=null;location.replace('/login')}catch(err){$('#passwordError').textContent=err.message}};
    $('#accountLogout').onclick=logout;
  }
  async function logout(){try{await api('/api/auth/logout',{method:'POST'})}catch{}localStorage.removeItem('gojet_token');state.token=null;location.replace('/login')}
})();
