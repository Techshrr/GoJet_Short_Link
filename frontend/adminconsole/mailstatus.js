(()=>{
let activeMailMount=null;

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

function mailHeading(embedded){
  if(!embedded)return pageHead('邮件中心','统一管理 SMTP、邮件模板、测试发送和失败队列。');
  return `<div class="ah-pane-head"><div><h2>邮件服务</h2><p>统一管理 SMTP、邮件模板、测试发送和投递记录。邮件密码不会明文回显。</p></div></div>`;
}

async function renderMailInto(target=null,options={}){
  const embedded=Boolean(options.embedded||target);
  const root=target||document.querySelector('#content');
  if(!root)return;
  activeMailMount=embedded?root:null;
  root.innerHTML='<div class="panel"><div class="empty">正在加载邮件设置…</div></div>';
  const [templates,logs,settings]=await Promise.all([
    api('/api/admin/mail/templates'),
    api('/api/admin/mail/logs'),
    api('/api/admin/settings')
  ]);
  const m=settings.mail||{};
  const body=`<div class="panel"><div class="panel-head"><div><h3>SMTP 配置</h3><p>密码不会明文回显，留空即保持原值。</p></div></div><form id="smtpForm" class="panel-body form-grid"><label><span>SMTP Host</span><input name="host" value="${esc(m.host||'')}" required></label><label><span>端口</span><input name="port" type="number" value="${esc(m.port||587)}" required></label><label><span>加密</span><select name="encryption"><option value="starttls" ${m.encryption==='starttls'?'selected':''}>STARTTLS</option><option value="tls" ${m.encryption==='tls'?'selected':''}>TLS</option><option value="none" ${m.encryption==='none'?'selected':''}>None</option></select></label><label><span>EHLO</span><input name="ehlo" value="${esc(m.ehlo||'')}"></label><label><span>用户名</span><input name="username" value="${esc(m.username||'')}"></label><label><span>密码</span><input name="password" type="password" autocomplete="new-password" placeholder="${m.password_configured?'已保存；留空保持不变':'请输入密码'}"></label><label><span>发件邮箱</span><input name="from_email" type="email" value="${esc(m.from_email||'')}" required></label><label><span>发件人名称</span><input name="from_name" value="${esc(m.from_name||'GoJet')}"></label><label><span>回复邮箱</span><input name="reply_to" type="email" value="${esc(m.reply_to||'')}"></label><div class="full diagnostic-actions"><button class="btn blue">保存 SMTP</button><button class="btn" type="button" id="testSmtp">发送测试</button></div></form></div><div class="panel"><div class="panel-head"><div><h3>邮件模板</h3><p>主题和 HTML 内容区均可编辑；统一品牌外壳由系统发送时自动生成。</p></div></div><div class="panel-body template-grid">${(templates.data||[]).map(t=>`<article class="template-card"><h4>${esc(t.name)}</h4><p>${esc(t.key)} · ${state(t.status)}</p><strong>${esc(t.subject_template)}</strong><div style="margin-top:12px"><button class="btn small" data-template="${esc(t.key)}">编辑模板</button></div></article>`).join('')||'<div class="empty">暂无邮件模板</div>'}</div></div><div class="panel"><div class="panel-head"><div><h3>投递记录</h3><p>查看最近邮件发送状态、重试次数与最后错误。</p></div></div><div class="table-wrap"><table><thead><tr><th>类型</th><th>收件人</th><th>主题</th><th>状态</th><th>尝试</th><th>最后错误</th></tr></thead><tbody>${(logs.data||[]).map(x=>`<tr><td>${esc(x.type)}</td><td>${esc(x.recipient)}</td><td class="wrap">${esc(x.subject)}</td><td>${state(x.status)}</td><td>${num(x.attempts)}</td><td class="wrap">${esc(x.last_error)}</td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">暂无邮件记录</div></td></tr>'}</tbody></table></div></div>`;
  root.innerHTML=mailHeading(embedded)+body;
  const form=root.querySelector('#smtpForm');
  const testButton=root.querySelector('#testSmtp');
  if(form)form.onsubmit=async e=>{
    e.preventDefault();
    const d=Object.fromEntries(new FormData(e.currentTarget));
    d.port=Number(d.port);
    try{
      await api('/api/admin/settings/mail',{method:'PUT',body:JSON.stringify(d)});
      toast('SMTP 设置已保存');
      await renderMailInto(root,{embedded});
    }catch(err){fail(err.message)}
  };
  if(testButton)testButton.onclick=()=>mailTest();
  root.querySelectorAll('[data-template]').forEach(b=>b.onclick=()=>{
    const item=(templates.data||[]).find(x=>x.key===b.dataset.template);
    if(item)templateModal(item);
  });
}

renderMailSettings=renderMailInto;
window.renderMailSettings=renderMailInto;
window.refreshMailSettings=()=>renderMailInto(activeMailMount,{embedded:Boolean(activeMailMount)});

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
