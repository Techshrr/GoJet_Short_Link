const $=s=>document.querySelector(s);
const page=document.body.dataset.authPage||'';
const qs=new URLSearchParams(location.search);
let botPolicyPromise=null,turnstileScriptPromise=null,turnstileWidget=null;
function showMessage(text,type='error'){const el=$('#message');if(!el)return;el.className=`message show ${type}`;el.textContent=text}
function setBusy(form,busy){const btn=form?.querySelector('button[type="submit"]');if(btn){btn.disabled=busy;btn.dataset.label||=btn.textContent;btn.textContent=busy?'处理中…':btn.dataset.label}}
function fallbackMessage(status){if(status===429)return'操作过于频繁，请稍后再试。';if(status===401||status===403)return'邮箱或密码不正确，请重新检查。';if(status>=500)return'服务暂时不可用，请稍后再试。';return'当前操作未能完成，请检查填写内容后重试。'}
async function request(path,options={}){const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(data.error||fallbackMessage(response.status)),{data,status:response.status});return data}
function validLocalPath(target){return typeof target==='string'&&target.startsWith('/')&&!target.startsWith('//')}
function safeRedirect(){const queryTarget=qs.get('redirect'),stored=localStorage.getItem('gojet_post_auth_path');if(validLocalPath(queryTarget))return queryTarget;if(validLocalPath(stored)){localStorage.removeItem('gojet_post_auth_path');return stored}return'/app/dashboard'}
async function botPolicy(){if(!botPolicyPromise)botPolicyPromise=request('/api/public/turnstile').catch(()=>({enabled:false,surfaces:{}}));return botPolicyPromise}
function surfaceForPage(){return page==='register'?'registration':page==='login'?'login':page==='forgot'?'forgot_password':page==='reset'?'reset_password':''}
function actionForPage(){return page==='register'?'register':page==='login'?'login':page==='forgot'?'forgot_password':page==='reset'?'reset_password':''}
function loadTurnstile(){if(window.turnstile)return Promise.resolve();if(turnstileScriptPromise)return turnstileScriptPromise;turnstileScriptPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.defer=true;s.onload=resolve;s.onerror=()=>reject(new Error('人机验证组件加载失败，请刷新页面重试。'));document.head.appendChild(s)});return turnstileScriptPromise}
async function prepareTurnstile(form){const surface=surfaceForPage(),policy=await botPolicy();if(!surface||!policy.enabled||!policy.surfaces?.[surface])return null;if(!policy.site_key)throw new Error('人机验证已启用，但站点密钥尚未配置。');await loadTurnstile();let slot=form.querySelector('[data-turnstile-slot]');if(!slot){slot=document.createElement('div');slot.dataset.turnstileSlot='1';slot.style.margin='14px 0';form.insertBefore(slot,form.querySelector('button[type="submit"]'))}if(turnstileWidget===null)turnstileWidget=window.turnstile.render(slot,{sitekey:policy.site_key,action:actionForPage(),theme:'auto'});return turnstileWidget}
async function getTurnstileToken(form){const id=await prepareTurnstile(form);if(id===null)return'';const token=window.turnstile.getResponse(id);if(!token)throw new Error('请先完成人机验证。');return token}
function resetTurnstile(){if(turnstileWidget!==null&&window.turnstile)window.turnstile.reset(turnstileWidget)}
async function attachTurnstile(){const form=$('form');if(!form)return;try{await prepareTurnstile(form)}catch(err){showMessage(err.message)}}

if(page==='login'){
  if(localStorage.getItem('gojet_token'))location.replace(safeRedirect());
  attachTurnstile();
  $('#loginForm')?.addEventListener('submit',async e=>{e.preventDefault();setBusy(e.currentTarget,true);showMessage('', 'info');try{const body=Object.fromEntries(new FormData(e.currentTarget));body.turnstile_token=await getTurnstileToken(e.currentTarget);const result=await request('/api/auth/login',{method:'POST',body:JSON.stringify(body)});localStorage.setItem('gojet_token',result.token);location.replace(safeRedirect())}catch(err){if(err.data?.email_verification_required)showMessage('该账户尚未完成邮箱验证，请先检查验证邮件。','info');else showMessage(err.message);resetTurnstile()}finally{setBusy(e.currentTarget,false)}})
}

if(page==='register'){
  request('/api/public/settings').then(settings=>{const enabled=settings?.registration?.enabled??settings?.['registration.enabled'];if(enabled===false||enabled==='false'){$('#registerForm')?.remove();showMessage('当前暂未开放新用户注册。','info')}}).catch(()=>{});
  attachTurnstile();
  $('#registerForm')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;const body=Object.fromEntries(new FormData(form));if(body.password!==body.password_confirmation){showMessage('两次输入的密码不一致');return}delete body.password_confirmation;setBusy(form,true);try{body.turnstile_token=await getTurnstileToken(form);const result=await request('/api/auth/register',{method:'POST',body:JSON.stringify(body)});if(result.verification_required){form.reset();resetTurnstile();showMessage(result.verification_queued?'账户已创建，验证邮件已经发送。完成邮箱验证后即可登录。':'账户已创建，但验证邮件暂时无法发送，请稍后重试。','success')}else{localStorage.setItem('gojet_token',result.token);location.replace(safeRedirect())}}catch(err){showMessage(err.message);resetTurnstile()}finally{setBusy(form,false)}})
}

if(page==='forgot'){
  attachTurnstile();
  $('#forgotForm')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;setBusy(form,true);try{const body=Object.fromEntries(new FormData(form));body.turnstile_token=await getTurnstileToken(form);await request('/api/auth/forgot-password',{method:'POST',body:JSON.stringify(body)});form.reset();resetTurnstile();showMessage('如果该邮箱对应有效账户，我们已经发送密码重置链接。','success')}catch(err){showMessage(err.message);resetTurnstile()}finally{setBusy(form,false)}})
}

if(page==='reset'){
  const token=qs.get('token')||'';if(!token)showMessage('这个密码重置链接无效或不完整，请重新发起找回密码。');
  attachTurnstile();
  $('#resetForm')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;const body=Object.fromEntries(new FormData(form));if(body.password!==body.password_confirmation){showMessage('两次输入的密码不一致');return}delete body.password_confirmation;body.token=token;setBusy(form,true);try{body.turnstile_token=await getTurnstileToken(form);await request('/api/auth/reset-password',{method:'POST',body:JSON.stringify(body)});localStorage.removeItem('gojet_token');form.reset();showMessage('密码已更新。其他已登录设备会失效，现在可以使用新密码登录。','success');setTimeout(()=>location.replace('/login'),1200)}catch(err){showMessage(err.message);resetTurnstile()}finally{setBusy(form,false)}})
}

if(page==='verify'){
  const token=qs.get('token')||'';const action=$('#verifyAction');if(!token){showMessage('这个邮箱验证链接无效或不完整。');if(action)action.disabled=true}else{action?.addEventListener('click',async()=>{action.disabled=true;try{await request('/api/auth/verify-email',{method:'POST',body:JSON.stringify({token})});showMessage('邮箱验证成功，现在可以登录 GoJet。','success');action.textContent='验证成功';$('#loginLink')?.classList.remove('hidden')}catch(err){showMessage(err.message);action.disabled=false}})}
}