(()=>{
function setMailTestState(button,statusEl,state,message){
  if(button){
    button.disabled=state==='sending';
    button.setAttribute('aria-busy',state==='sending'?'true':'false');
    button.textContent=state==='sending'?'发送中…':(state==='success'?'重新发送测试':'发送测试');
  }
  if(statusEl){
    statusEl.textContent=message||'';
    statusEl.className='alert full '+(state==='error'?'':state==='success'?'success':'info');
    statusEl.classList.toggle('hidden',!message);
  }
}

// Replace the original modal handler with an explicit, duplicate-safe state
// machine. The API call remains synchronous so the displayed result reflects
// the real SMTP connection/authentication/send outcome.
mailTest=function(){
  openModal(`<div class="modal-head"><div><h2>发送测试邮件</h2><p>将使用当前已保存的 SMTP 配置进行真实连接、认证和发送。</p></div><button class="btn" data-modal-close>关闭</button></div><form id="mailTestForm"><div class="modal-body form-grid"><label class="full"><span>测试收件人</span><input name="recipient" type="email" required></label><div id="mailTestStatus" class="alert hidden full" role="status" aria-live="polite"></div></div><div class="modal-foot"><button type="button" class="btn" data-modal-close>取消</button><button class="btn blue" id="mailTestSubmit">发送测试</button></div></form>`);
  const form=document.querySelector('#mailTestForm');
  const button=document.querySelector('#mailTestSubmit');
  const status=document.querySelector('#mailTestStatus');
  let sending=false;
  form.onsubmit=async e=>{
    e.preventDefault();
    if(sending)return;
    sending=true;
    setMailTestState(button,status,'sending','正在连接 SMTP 服务器并发送测试邮件，请稍候…');
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),30000);
    try{
      const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
      const body=JSON.stringify(Object.fromEntries(new FormData(form)));
      const response=await fetch('/api/admin/mail/test',{method:'POST',headers,body,signal:controller.signal});
      const data=await response.json().catch(()=>({}));
      if(response.status===401){sessionStorage.removeItem('gojet_admin');token='';showLogin();throw new Error('管理员会话已过期，请重新登录')}
      if(!response.ok)throw new Error(data.error||`测试发送失败 (${response.status})`);
      setMailTestState(button,status,'success','测试邮件已发送。请检查收件箱；如未收到，也请检查垃圾邮件目录。');
      toast('测试邮件已发送');
    }catch(err){
      const message=err?.name==='AbortError'?'测试发送等待超过 30 秒，已停止等待。请检查 SMTP 地址、端口、网络与服务商状态。':(err?.message||'测试邮件发送失败');
      setMailTestState(button,status,'error',message);
      fail(message);
    }finally{
      clearTimeout(timeout);
      sending=false;
      if(button){button.disabled=false;button.setAttribute('aria-busy','false')}
    }
  };
};
})();
