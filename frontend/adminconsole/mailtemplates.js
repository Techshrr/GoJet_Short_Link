(()=>{
  window.templateModal=function(t){
    openModal(`<div class="modal-head"><div><h2>编辑邮件模板</h2><p>${esc(t.key)} · 这里只编辑邮件内容区；品牌标志、外层卡片、背景与页脚由 GoJet 统一生成。</p></div><button class="btn" data-modal-close>关闭</button></div><form id="templateForm"><div class="modal-body form-grid"><label><span>名称</span><input name="name" value="${esc(t.name)}" required></label><label><span>状态</span><select name="status"><option value="active" ${t.status==='active'?'selected':''}>启用</option><option value="disabled" ${t.status==='disabled'?'selected':''}>停用</option></select></label><label class="full"><span>邮件主题</span><input name="subject_template" value="${esc(t.subject_template)}" required></label><label class="full"><span>邮件内容区 HTML</span><textarea name="html_template" rows="14" required>${esc(t.html_template)}</textarea><small>支持 {{variable}} 模板变量。不要填写 &lt;!doctype&gt;、&lt;html&gt;、&lt;head&gt; 或 &lt;body&gt;；系统发送时会自动套用统一品牌邮件外壳。</small></label><div id="templateError" class="alert hidden full"></div></div><div class="modal-foot"><button type="button" class="btn" data-modal-close>取消</button><button class="btn blue">保存模板</button></div></form>`);
    $('#templateForm').onsubmit=async e=>{
      e.preventDefault();
      const payload=Object.fromEntries(new FormData(e.currentTarget));
      const html=String(payload.html_template||'').toLowerCase();
      if(/<!doctype|<\/?html\b|<\/?head\b|<\/?body\b/.test(html)){
        const x=$('#templateError');
        x.textContent='这里只能保存邮件内容区，品牌外壳由系统统一生成。请移除 html、head、body 等整页标签。';
        x.classList.remove('hidden');
        return;
      }
      try{
        await api(`/api/admin/mail/templates/${encodeURIComponent(t.key)}`,{method:'PUT',body:JSON.stringify(payload)});
        closeModal();
        toast('邮件模板已保存');
        if(typeof window.refreshMailSettings==='function')await window.refreshMailSettings();
        else if(typeof window.renderMailSettings==='function')await window.renderMailSettings();
      }catch(err){const x=$('#templateError');x.textContent=err.message;x.classList.remove('hidden')}
    };
  };
})();
