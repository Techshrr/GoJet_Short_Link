(()=>{
'use strict';
const routeToView={
  '/app/':'overview','/app/dashboard':'overview','/app/links':'links','/app/team':'team',
  '/app/organization':'organization','/app/domains':'domains','/app/text':'texts','/app/bio':'bios',
  '/app/files':'files','/app/qr':'qrs','/app/billing':'billing','/app/analytics':'analytics',
  '/app/support':'tickets','/app/settings':'settings'
};
const viewToRoute={
  overview:'/app/dashboard',links:'/app/links',team:'/app/team',organization:'/app/organization',domains:'/app/domains',
  texts:'/app/text',bios:'/app/bio',files:'/app/files',qrs:'/app/qr',billing:'/app/billing',analytics:'/app/analytics',
  tickets:'/app/support',settings:'/app/settings'
};
const styleModules=['/assets/gojetdesignsystem.css','/app/shell.css','/app/links.css','/app/workflowpages.css','/app/bio.css','/app/domains.css','/app/analytics.css','/app/files.css','/app/team.css','/app/organization.css','/app/billing.css','/app/supportux.css','/app/socialidentities.css'];
const scriptModules=['/app/dialogs.js','/app/links.js','/app/workflowpages.js','/app/bio.js','/app/domains.js','/app/analytics.js','/app/files.js','/app/team.js','/app/organization.js','/app/billing.js','/app/support.js','/app/socialidentities.js'];
let navigationToken=0;
const overviewPage=typeof window.renderOverview==='function'?window.renderOverview:null;

function loadStyle(path){
  return new Promise(resolve=>{
    if([...document.styleSheets].some(sheet=>{try{return new URL(sheet.href,location.href).pathname===path}catch{return false}}))return resolve();
    if(document.querySelector(`link[data-gojet-module="${path}"]`))return resolve();
    const node=document.createElement('link');
    node.rel='stylesheet';node.href=path;node.dataset.gojetModule=path;
    node.onload=resolve;node.onerror=resolve;document.head.appendChild(node);
  });
}
function loadScript(path){
  return new Promise((resolve,reject)=>{
    if(document.querySelector(`script[data-gojet-module="${path}"]`))return resolve();
    const node=document.createElement('script');
    node.src=path;node.dataset.gojetModule=path;node.async=false;
    node.onload=resolve;node.onerror=()=>reject(new Error(`页面组件加载失败：${path}`));document.head.appendChild(node);
  });
}
const modulesReady=(async()=>{
  await Promise.all(styleModules.map(loadStyle));
  for(const path of scriptModules)await loadScript(path);
})();

const nav=document.querySelector('#shell aside nav');
if(nav&&!nav.querySelector('[data-console-view="tickets"]')){
  const button=document.createElement('button');button.dataset.consoleView='tickets';button.textContent='支持工单';
  const settings=nav.querySelector('[data-console-view="settings"]');nav.insertBefore(button,settings||null);
}
function activate(view){document.querySelectorAll('[data-console-view]').forEach(node=>node.classList.toggle('active',node.dataset.consoleView===view))}
function currentView(){return routeToView[location.pathname]||'overview'}
function registeredPage(view){return window.GoJetPages?.[view]||null}
async function waitForWorkspace(){
  for(let i=0;i<200;i++){
    if(typeof state!=='undefined'&&state.workspace&&document.querySelector('#shell:not(.hidden)'))return;
    await new Promise(resolve=>setTimeout(resolve,30));
  }
  throw new Error('工作区初始化超时');
}
async function show(view,push=false){
  const token=++navigationToken;
  activate(view);
  if(push&&location.pathname!==(viewToRoute[view]||'/app/dashboard'))history.pushState({view},'',viewToRoute[view]||'/app/dashboard');
  try{
    await modulesReady;
    if(token!==navigationToken)return;
    const page=registeredPage(view);
    if(page)return await page();
    if(view==='overview')return overviewPage?await overviewPage():undefined;
    if(view==='settings')return await renderAccountSettings();
    if(overviewPage)return await overviewPage();
  }catch(err){
    console.error(err);
    const content=document.querySelector('.content');
    if(content)content.innerHTML=`<div class="productError">${escapeHTML(err.message||'页面加载失败')}</div>`;
  }
}

window.GoJetRouter={
  show:(view,push=false)=>show(view,push),
  currentView,
  showCurrent:()=>show(currentView(),false)
};

document.addEventListener('click',event=>{
  const create=event.target.closest('#createButton');
  if(create){event.preventDefault();event.stopImmediatePropagation();modulesReady.then(()=>window.openLinkEditor?.());return}
  const button=event.target.closest('[data-console-view]');
  if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();show(button.dataset.consoleView,true);
},true);
addEventListener('popstate',()=>show(currentView(),false));
waitForWorkspace().then(()=>show(currentView(),false)).catch(err=>console.error(err));

async function renderAccountSettings(){
  const user=await api('/api/me'),content=document.querySelector('.content');
  content.innerHTML=`<div class="productPageHead"><div><h1>账户设置</h1><p>管理个人资料、登录凭据、第三方账户和当前登录状态。</p></div><button id="accountLogout">退出登录</button></div><div class="settingsGrid"><form id="profileSettings" class="resourceForm"><h3>个人资料</h3><label>邮箱<input value="${escapeHTML(user.email)}" disabled></label><label>显示名称<input name="display_name" value="${escapeHTML(user.display_name)}" maxlength="120" required></label><div class="error" id="profileError"></div><button class="primary">保存资料</button></form><form id="passwordSettings" class="resourceForm"><h3>修改密码</h3><p>修改成功后，其他已登录设备会失效，需要重新登录。</p><label>当前密码<input name="current_password" type="password" autocomplete="current-password" required></label><label>新密码<input name="new_password" type="password" autocomplete="new-password" minlength="10" required></label><label>确认新密码<input name="confirmation" type="password" autocomplete="new-password" minlength="10" required></label><div class="error" id="passwordError"></div><button class="primary">修改密码</button></form><section class="resourceForm socialIdentityPanel" data-social-identity-mount><div class="productLoading">正在读取第三方账户…</div></section></div>`;
  document.querySelector('#profileSettings').onsubmit=async event=>{
    event.preventDefault();const name=new FormData(event.currentTarget).get('display_name');
    try{const updated=await api('/api/me',{method:'PATCH',body:JSON.stringify({display_name:name})});document.querySelector('#userName').textContent=updated.display_name||name;document.querySelector('#profileError').textContent='资料已保存'}catch(err){document.querySelector('#profileError').textContent=err.message}
  };
  const social=typeof window.renderSocialIdentitySettings==='function'?await window.renderSocialIdentitySettings(document.querySelector('[data-social-identity-mount]')):null;
  const passwordForm=document.querySelector('#passwordSettings');
  if(social&&social.password_login_enabled===false){
    passwordForm.outerHTML=`<section id="passwordSettings" class="resourceForm passwordCredentialSetup"><h3>设置登录密码</h3><p>当前账户由第三方登录创建，还没有可用的密码凭据。通过已验证邮箱完成密码找回后，即可使用邮箱和密码登录，也可以安全解除最后一个第三方登录方式。</p><a class="primary" href="/forgotpassword">通过邮箱设置密码</a></section>`;
  }else{
    passwordForm.onsubmit=async event=>{
      event.preventDefault();const form=Object.fromEntries(new FormData(event.currentTarget));
      if(form.new_password!==form.confirmation){document.querySelector('#passwordError').textContent='两次输入的新密码不一致';return}
      try{await api('/api/me/password',{method:'POST',body:JSON.stringify({current_password:form.current_password,new_password:form.new_password})});localStorage.removeItem('gojet_token');state.token=null;location.replace('/login')}catch(err){document.querySelector('#passwordError').textContent=err.message}
    };
  }
  document.querySelector('#accountLogout').onclick=logout;
}
async function logout(){try{await api('/api/auth/logout',{method:'POST'})}catch{}localStorage.removeItem('gojet_token');state.token=null;location.replace('/login')}
})();
