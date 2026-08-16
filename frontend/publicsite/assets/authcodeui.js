(()=>{
'use strict';
const page=document.body.dataset.authPage||'';
const formSelector={login:'#loginForm',register:'#registerForm'}[page]||'';
if(!formSelector)return;
const form=document.querySelector(formSelector);
if(!form)return;
const message=document.querySelector('#message');
const show=(text,type='error')=>{if(!message)return;message.className=`message${text?' show':''} ${type}`;message.textContent=text};
const call=async(path,body)=>{const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'当前操作未能完成，请稍后重试。');return data};
const read=async path=>{const response=await fetch(path,{cache:'no-store'});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'当前操作未能完成，请稍后重试。');return data};
const policy=()=>fetch('/api/public/account-policy',{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({}));
const token=()=>document.querySelector('input[name="cf-turnstile-response"]')?.value||'';
const resetChallenge=()=>{try{window.turnstile?.reset()}catch{}};
const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||'').trim());
const validLocalPath=target=>typeof target==='string'&&target.startsWith('/')&&!target.startsWith('//')&&!target.includes('\\')&&!/[\u0000-\u001f\u007f]/.test(target);
function codeField(id){return `<label class="field auth-code-field" id="${id}Field"><span>邮箱验证码</span><div class="auth-code-row"><input id="${id}" name="email_code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="6 位验证码"><button type="button" class="auth-code-send" id="${id}Send">获取验证码</button></div><small class="auth-field-note">验证码 10 分钟内有效，每 60 秒可重新发送。</small></label>`}
function countdown(button){let left=60;button.disabled=true;button.textContent=`${left}s 后可重发`;const timer=setInterval(()=>{left--;if(left<=0){clearInterval(timer);button.disabled=false;button.textContent='获取验证码'}else button.textContent=`${left}s 后可重发`},1000)}
async function sendCode(purpose,button){const email=String(form.elements.email?.value||'').trim();if(!validEmail(email))throw new Error('请先填写有效的邮箱地址。');button.disabled=true;button.textContent='发送中…';try{await call('/api/public/email-code',{email,purpose,turnstile_token:token()});show('验证码已发送，请检查收件箱；如果没有看到，也请检查垃圾邮件目录。','success');resetChallenge();countdown(button)}catch(err){button.disabled=false;button.textContent='获取验证码';resetChallenge();throw err}}
function storeAndRedirect(result){if(result?.token)localStorage.setItem('gojet_token',result.token);const queryTarget=new URLSearchParams(location.search).get('redirect'),target=validLocalPath(result?.redirect)?result.redirect:queryTarget;location.replace(validLocalPath(target)?target:'/app/dashboard')}
async function setupSocialRegistration(code){
  document.querySelector('#socialAuth')?.classList.add('hidden');
  const title=document.querySelector('#authTitle'),subtitle=document.querySelector('.auth-heading p'),submit=form.querySelector('button[type="submit"]');
  try{
    const info=await read('/api/public/auth/social-registration?code='+encodeURIComponent(code));
    if(title)title.textContent='完成 GoJet 注册';
    if(subtitle)subtitle.textContent=`已验证 ${info.provider_label||'第三方平台'} 身份。完成账户资料与邮箱验证后，会自动绑定到新的 GoJet 账户。`;
    if(info.suggested_display_name&&!form.elements.display_name.value)form.elements.display_name.value=info.suggested_display_name;
    if(info.provider_email&&!form.elements.email.value)form.elements.email.value=info.provider_email;
    const min=Math.max(10,Math.min(72,Number(info.password_min_length)||10));
    [form.elements.password,form.elements.password_confirmation].forEach(input=>{if(input){input.minLength=min;input.placeholder=`至少 ${min} 位字符`}});
    const emailField=form.querySelector('input[name="email"]')?.closest('.field');
    emailField?.insertAdjacentHTML('afterend',codeField('socialRegisterEmailCode'));
    const codeInput=document.querySelector('#socialRegisterEmailCode'),send=document.querySelector('#socialRegisterEmailCodeSend');
    if(codeInput)codeInput.required=true;
    send?.addEventListener('click',()=>sendCode('register',send).catch(err=>show(err.message)));
    if(submit)submit.textContent='验证邮箱并完成注册';
    show(`已完成 ${info.provider_label||'第三方平台'} 身份验证，请继续完成 GoJet 账户资料。`,'success');
    form.addEventListener('submit',async event=>{
      event.preventDefault();event.stopImmediatePropagation();
      const data=Object.fromEntries(new FormData(form));
      if(data.password!==data.password_confirmation)return show('两次输入的密码不一致');
      if(!/^\d{6}$/.test(String(data.email_code||'')))return show('请输入邮件中的 6 位验证码。');
      if(!validEmail(data.email))return show('请填写有效的邮箱地址。');
      submit.disabled=true;submit.textContent='正在验证并绑定…';
      try{storeAndRedirect(await call('/api/public/auth/social-registration/complete',{code,display_name:data.display_name,email:data.email,email_code:data.email_code,password:data.password}))}
      catch(err){show(err.message);submit.disabled=false;submit.textContent='验证邮箱并完成注册'}
    },true);
  }catch(err){
    if(submit)submit.disabled=true;
    show(err.message);
  }
}
const socialRegistrationCode=page==='register'?String(window.gojetSocialRegistrationCode||'').trim():'';
if(socialRegistrationCode){setupSocialRegistration(socialRegistrationCode);return}
policy().then(settings=>{
  if(page==='register'&&settings.registration_code_required){const emailField=form.querySelector('input[name="email"]')?.closest('.field');emailField?.insertAdjacentHTML('afterend',codeField('registerEmailCode'));const code=document.querySelector('#registerEmailCode'),send=document.querySelector('#registerEmailCodeSend');if(code)code.required=true;send?.addEventListener('click',()=>sendCode('register',send).catch(err=>show(err.message)));const submit=form.querySelector('button[type="submit"]');if(submit)submit.textContent='验证邮箱并创建账户';form.addEventListener('submit',async event=>{event.preventDefault();event.stopImmediatePropagation();const data=Object.fromEntries(new FormData(form));if(data.password!==data.password_confirmation)return show('两次输入的密码不一致');if(!/^\d{6}$/.test(String(data.email_code||'')))return show('请输入邮件中的 6 位验证码。');const button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent='正在验证并创建…';try{storeAndRedirect(await call('/api/public/register-email-code',{email:data.email,password:data.password,display_name:data.display_name,email_code:data.email_code}))}catch(err){show(err.message);button.disabled=false;button.textContent='验证邮箱并创建账户'}},true)}
  if(page==='login'&&settings.email_code_login_available){let mode='password';const passwordField=form.querySelector('input[name="password"]')?.closest('.field'),forgot=form.querySelector('.auth-row'),submit=form.querySelector('button[type="submit"]');const tabs=document.createElement('div');tabs.className='auth-mode-tabs';tabs.innerHTML='<button type="button" class="active" data-login-mode="password">密码登录</button><button type="button" data-login-mode="code">验证码登录</button>';form.insertBefore(tabs,form.firstElementChild);form.querySelector('input[name="email"]')?.closest('.field')?.insertAdjacentHTML('afterend',codeField('loginEmailCode'));const codeFieldEl=document.querySelector('#loginEmailCodeField'),code=document.querySelector('#loginEmailCode'),send=document.querySelector('#loginEmailCodeSend');codeFieldEl?.classList.add('hidden');send?.addEventListener('click',()=>sendCode('login',send).catch(err=>show(err.message)));tabs.querySelectorAll('[data-login-mode]').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.loginMode;tabs.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===button));const byCode=mode==='code';passwordField?.classList.toggle('hidden',byCode);if(passwordField?.querySelector('input'))passwordField.querySelector('input').required=!byCode;codeFieldEl?.classList.toggle('hidden',!byCode);if(code)code.required=byCode;forgot?.classList.toggle('hidden',byCode);if(submit)submit.textContent=byCode?'使用验证码登录':'登录';show('','info')}));form.addEventListener('submit',async event=>{if(mode!=='code')return;event.preventDefault();event.stopImmediatePropagation();const data=Object.fromEntries(new FormData(form));if(!/^\d{6}$/.test(String(data.email_code||'')))return show('请输入邮件中的 6 位验证码。');submit.disabled=true;submit.textContent='正在验证…';try{storeAndRedirect(await call('/api/public/login-email-code',{email:data.email,email_code:data.email_code}))}catch(err){show(err.message);submit.disabled=false;submit.textContent='使用验证码登录'}},true)}
});
})();
