const $=s=>document.querySelector(s);
const page=document.body.dataset.authPage||'';
const qs=new URLSearchParams(location.search);
function showMessage(text,type='error'){const el=$('#message');if(!el)return;el.className=`message show ${type}`;el.textContent=text}
function setBusy(form,busy){const btn=form?.querySelector('button[type="submit"]');if(btn){btn.disabled=busy;btn.dataset.label||=btn.textContent;btn.textContent=busy?'处理中…':btn.dataset.label}}
async function request(path,options={}){const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(data.error||`请求失败 (${response.status})`),{data,status:response.status});return data}
function safeRedirect(){const target=qs.get('redirect')||'/app/';return target.startsWith('/')&&!target.startsWith('//')?target:'/app/'}

if(page==='login'){
  if(localStorage.getItem('gojet_token'))location.replace(safeRedirect());
  $('#loginForm')?.addEventListener('submit',async e=>{e.preventDefault();setBusy(e.currentTarget,true);showMessage('', 'info');try{const body=Object.fromEntries(new FormData(e.currentTarget));const result=await request('/api/auth/login',{method:'POST',body:JSON.stringify(body)});localStorage.setItem('gojet_token',result.token);location.replace(safeRedirect())}catch(err){if(err.data?.email_verification_required)showMessage('该账户尚未完成邮箱验证，请先检查验证邮件。','info');else showMessage(err.message)}finally{setBusy(e.currentTarget,false)}})
}

if(page==='register'){
  request('/api/public/settings').then(settings=>{const enabled=settings?.registration?.enabled??settings?.['registration.enabled'];if(enabled===false||enabled==='false'){$('#registerForm')?.remove();showMessage('当前暂未开放新用户注册。','info')}}).catch(()=>{});
  $('#registerForm')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;const body=Object.fromEntries(new FormData(form));if(body.password!==body.password_confirmation){showMessage('两次输入的密码不一致');return}delete body.password_confirmation;setBusy(form,true);try{const result=await request('/api/auth/register',{method:'POST',body:JSON.stringify(body)});if(result.verification_required){form.reset();showMessage(result.verification_queued?'账户已创建，验证邮件已经发送。完成邮箱验证后即可登录。':'账户已创建，但验证邮件暂时无法发送，请稍后重试。','success')}else{localStorage.setItem('gojet_token',result.token);location.replace('/app/')}}catch(err){showMessage(err.message)}finally{setBusy(form,false)}})
}

if(page==='forgot'){
  $('#forgotForm')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;setBusy(form,true);try{await request('/api/auth/reset-password',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.reset();showMessage('如果该邮箱对应有效账户，我们已经发送密码重置链接。','success')}catch(err){showMessage(err.message)}finally{setBusy(form,false)}})
}

if(page==='reset'){
  const token=qs.get('token')||'';if(!token)showMessage('重置链接缺少 token，请重新发起找回密码。');
  $('#resetForm')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;const body=Object.fromEntries(new FormData(form));if(body.password!==body.password_confirmation){showMessage('两次输入的密码不一致');return}delete body.password_confirmation;body.token=token;setBusy(form,true);try{await request('/api/auth/reset-password',{method:'POST',body:JSON.stringify(body)});localStorage.removeItem('gojet_token');form.reset();showMessage('密码已更新，所有旧会话均已失效。现在可以使用新密码登录。','success');setTimeout(()=>location.replace('/login'),1200)}catch(err){showMessage(err.message)}finally{setBusy(form,false)}})
}

if(page==='verify'){
  const token=qs.get('token')||'';const action=$('#verifyAction');if(!token){showMessage('验证链接缺少 token。');if(action)action.disabled=true}else{action?.addEventListener('click',async()=>{action.disabled=true;try{await request('/api/auth/verify-email',{method:'POST',body:JSON.stringify({token})});showMessage('邮箱验证成功，现在可以登录 GoJet。','success');action.textContent='验证成功';$('#loginLink')?.classList.remove('hidden')}catch(err){showMessage(err.message);action.disabled=false}})}
}
