Object.assign(permissionNames,{
  'workspaces.manage':'工作区管理',
  'files.manage':'文件与资源管理',
  'domains.manage':'域名管理'
});

generic.workspaces={path:'/api/admin/workspaces',headers:['ID','工作区','类型','所有者','成员','链接','创建时间','操作'],row:x=>`<tr><td>${x.id}</td><td>${esc(x.name)}</td><td>${esc(x.type)}</td><td>${esc(x.owner)}</td><td>${num(x.members)}</td><td>${num(x.links)}</td><td>${dt(x.created_at)}</td><td><button class="btn small" data-workspace-rename="${x.id}" data-name="${esc(x.name)}">改名</button></td></tr>`};
generic.links={path:'/api/admin/links',headers:['ID','短码','目标','工作区','创建者','状态','创建时间','操作'],row:x=>`<tr><td>${x.id}</td><td>${esc(x.code)}</td><td class="wrap">${esc(x.destination)}</td><td>${esc(x.workspace)}</td><td>${esc(x.creator)}</td><td>${state(x.status)}</td><td>${dt(x.created_at)}</td><td><div class="row-actions"><button class="btn small" data-link-toggle="${x.id}" data-status="${x.status}">${x.status==='active'?'暂停':'启用'}</button><button class="btn small danger" data-link-delete="${x.id}">删除</button></div></td></tr>`};
generic.files={path:'/api/admin/files',headers:['ID','文件','类型','大小','扫描','业务状态','工作区','操作'],row:x=>`<tr><td>${x.id}</td><td>${esc(x.name)}</td><td>${esc(x.mime)}</td><td>${num(x.size)} B</td><td>${state(x.scan_status)}</td><td>${state(x.status)}</td><td>${esc(x.workspace)}</td><td><div class="row-actions">${x.scan_status==='error'?`<button class="btn small" data-file-retry="${x.id}">重试扫描</button>`:''}${x.status!=='quarantined'?`<button class="btn small danger" data-resource-quarantine="file:${x.id}">隔离</button>`:''}</div></td></tr>`};
generic.abuse={path:'/api/admin/abuse',headers:['ID','短码','举报原因','详情','状态','处理'],row:x=>`<tr><td>${x.id}</td><td>${esc(x.code)}</td><td>${esc(x.reason)}</td><td class="wrap">${esc(x.details)}</td><td>${state(x.status)}</td><td>${['resolved','rejected'].includes(x.status)?esc(x.resolution||'已处理'):`<button class="btn small" data-abuse="${x.id}">处理举报</button>`}</td></tr>`};
generic.domains={path:'/api/admin/domains',headers:['ID','域名','工作区','状态','HTTPS','异常','操作'],row:x=>`<tr><td>${x.id}</td><td>${esc(x.hostname)}</td><td>${esc(x.workspace)}</td><td>${state(x.status)}</td><td>${state(x.https_status)}</td><td class="wrap">${esc(x.last_error)}</td><td><div class="row-actions"><button class="btn small" data-domain-toggle="${x.id}" data-status="${x.status}">${x.status==='active'?'停用':'启用'}</button><button class="btn small danger" data-domain-delete="${x.id}">删除</button></div></td></tr>`};
generic.security={path:'/api/admin/security',headers:['ID','事件','级别','来源','说明','状态','操作'],row:x=>`<tr><td>${x.id}</td><td>${esc(x.event_type)}</td><td>${state(x.severity)}</td><td>${esc(x.source)}</td><td class="wrap">${esc(x.description)}</td><td>${state(x.status)}</td><td>${x.status==='open'?`<button class="btn small" data-security-resolve="${x.id}">标记已处理</button>`:'—'}</td></tr>`};

const baseRenderGeneric=renderGeneric;
renderGeneric=async function(view){
  await baseRenderGeneric(view);
  if(view==='files'){
    try{
      const q=await api('/api/admin/resources');
      const active=(q.data||[]).filter(x=>x.status==='quarantined');
      if(active.length){
        $('#content').insertAdjacentHTML('beforeend',panelTable(['隔离 ID','类型','资源 ID','工作区','隔离原因','时间','操作'],active.map(x=>`<tr><td>${x.id}</td><td>${esc(x.resource_type)}</td><td>${x.resource_id}</td><td>${esc(x.workspace)}</td><td class="wrap">${esc(x.reason)}</td><td>${dt(x.quarantined_at)}</td><td><button class="btn small" data-resource-restore="${x.id}">恢复</button></td></tr>`).join(''),'当前没有隔离资源'));
      }
    }catch{}
  }
};

$('#content').addEventListener('click',async e=>{
  const rename=e.target.closest('[data-workspace-rename]');
  if(rename){
    openModal(`<div class="modal-head"><div><h2>修改工作区名称</h2><p>只修改展示名称，不影响工作区 ID 和资源。</p></div><button class="btn" data-modal-close>关闭</button></div><form id="workspaceRename"><div class="modal-body form-grid"><label class="full"><span>工作区名称</span><input name="name" value="${esc(rename.dataset.name)}" required maxlength="120"></label></div><div class="modal-foot"><button type="button" class="btn" data-modal-close>取消</button><button class="btn blue">保存</button></div></form>`);
    $('#workspaceRename').onsubmit=async ev=>{ev.preventDefault();try{await api(`/api/admin/workspaces/${rename.dataset.workspaceRename}`,{method:'PATCH',body:JSON.stringify(Object.fromEntries(new FormData(ev.currentTarget)))});closeModal();toast('工作区名称已更新');load('workspaces')}catch(err){fail(err.message)}};return;
  }
  const link=e.target.closest('[data-link-toggle]');
  if(link){try{await api(`/api/admin/links/${link.dataset.linkToggle}/status`,{method:'PATCH',body:JSON.stringify({status:link.dataset.status==='active'?'paused':'active'})});toast('链接状态已更新');load('links')}catch(err){fail(err.message)}return}
  const linkDelete=e.target.closest('[data-link-delete]');
  if(linkDelete){if(!confirm('确认删除该短链接？删除后跳转将立即失效。'))return;try{await api(`/api/admin/links/${linkDelete.dataset.linkDelete}`,{method:'DELETE'});toast('短链接已删除');load('links')}catch(err){fail(err.message)}return}
  const retry=e.target.closest('[data-file-retry]');
  if(retry){try{await api(`/api/admin/files/${retry.dataset.fileRetry}/retry-scan`,{method:'POST'});toast('文件已重新进入扫描队列');load('files')}catch(err){fail(err.message)}return}
  const quarantine=e.target.closest('[data-resource-quarantine]');
  if(quarantine){const [type,id]=quarantine.dataset.resourceQuarantine.split(':');return resourceReasonModal('隔离资源','隔离原因用于安全审计，例如：恶意文件、钓鱼内容或人工复核。',async reason=>{await api(`/api/admin/resources/${type}/${id}/quarantine`,{method:'POST',body:JSON.stringify({reason})});toast('资源已隔离');load('files')})}
  const restore=e.target.closest('[data-resource-restore]');
  if(restore){return resourceReasonModal('恢复隔离资源','请记录确认恢复的依据；文件必须已经通过安全扫描。',async reason=>{await api(`/api/admin/quarantine/${restore.dataset.resourceRestore}/restore`,{method:'POST',body:JSON.stringify({reason})});toast('资源已恢复');load('files')})}
  const abuse=e.target.closest('[data-abuse]');
  if(abuse){return abuseModal(abuse.dataset.abuse)}
  const domain=e.target.closest('[data-domain-toggle]');
  if(domain){try{await api(`/api/admin/domains/${domain.dataset.domainToggle}/status`,{method:'PATCH',body:JSON.stringify({status:domain.dataset.status==='active'?'suspended':'active'})});toast('域名状态已更新');load('domains')}catch(err){fail(err.message)}return}
  const domainDelete=e.target.closest('[data-domain-delete]');
  if(domainDelete){if(!confirm('确认删除该自定义域名？仍被资源引用时服务器会拒绝删除。'))return;try{await api(`/api/admin/domains/${domainDelete.dataset.domainDelete}`,{method:'DELETE'});toast('域名已删除');load('domains')}catch(err){fail(err.message)}return}
  const sec=e.target.closest('[data-security-resolve]');
  if(sec){try{await api(`/api/admin/security/${sec.dataset.securityResolve}`,{method:'PATCH'});toast('安全事件已标记处理');load('security')}catch(err){fail(err.message)}return}
});

function resourceReasonModal(title,description,run){
  openModal(`<div class="modal-head"><div><h2>${esc(title)}</h2><p>${esc(description)}</p></div><button class="btn" data-modal-close>关闭</button></div><form id="resourceReason"><div class="modal-body form-grid"><label class="full"><span>安全处置说明</span><textarea name="reason" rows="4" minlength="3" required></textarea></label><div id="resourceReasonError" class="alert hidden full"></div></div><div class="modal-foot"><button type="button" class="btn" data-modal-close>取消</button><button class="btn blue">确认</button></div></form>`);
  $('#resourceReason').onsubmit=async e=>{e.preventDefault();try{await run(new FormData(e.currentTarget).get('reason').trim());closeModal()}catch(err){const x=$('#resourceReasonError');x.textContent=err.message;x.classList.remove('hidden')}};
}
function abuseModal(id){
  openModal(`<div class="modal-head"><div><h2>处理举报</h2><p>举报结论属于安全处置记录，因此保留明确的处理结论。</p></div><button class="btn" data-modal-close>关闭</button></div><form id="abuseForm"><div class="modal-body form-grid"><label><span>处理状态</span><select name="status"><option value="investigating">调查中</option><option value="resolved">举报成立并处理</option><option value="rejected">驳回举报</option></select></label><label class="full"><span>处理结论</span><textarea name="resolution" rows="5" minlength="3" required></textarea></label><div id="abuseError" class="alert hidden full"></div></div><div class="modal-foot"><button type="button" class="btn" data-modal-close>取消</button><button class="btn blue">保存处理结果</button></div></form>`);
  $('#abuseForm').onsubmit=async e=>{e.preventDefault();try{await api(`/api/admin/abuse/${id}`,{method:'PATCH',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});closeModal();toast('举报处理结果已保存');load('abuse')}catch(err){const x=$('#abuseError');x.textContent=err.message;x.classList.remove('hidden')}};
}

renderBilling=async function(){
  const [plans,invoices]=await Promise.all([api('/api/admin/plans'),api('/api/admin/invoices?limit=100')]);
  const planRows=(plans.data||[]).map(p=>`<tr><td>${p.id}</td><td><b>${esc(p.name)}</b><br><small>${esc(p.code)}</small></td><td>${state(p.status)}</td><td>${(p.monthly_price_cents/100).toFixed(2)} ${esc(p.currency)}</td><td>${num(p.link_limit)}</td><td>${num(p.file_storage_bytes)} B</td><td><button class="btn small" data-plan-edit="${p.id}">编辑套餐</button></td></tr>`).join('');
  const invoiceRows=(invoices.data||[]).map(i=>`<tr><td>${esc(i.invoice_number)}</td><td>#${i.workspace_id}</td><td>${esc(i.plan_name)}</td><td>${(i.amount_cents/100).toFixed(2)} ${esc(i.currency)}</td><td>${state(i.status)}</td><td>${dt(i.due_at)}</td><td>${['pending','overdue'].includes(i.status)?`<div class="row-actions"><button class="btn small" data-invoice-paid="${i.id}">标记已支付</button><button class="btn small danger" data-invoice-void="${i.id}">作废</button></div>`:esc(i.admin_note||'—')}</td></tr>`).join('');
  $('#content').innerHTML=pageHead('套餐与账单','套餐配额和价格可以直接编辑；待处理账单可由管理员结算或作废。')+panelTable(['ID','套餐','状态','月价','链接配额','文件空间','操作'],planRows,'暂无套餐')+panelTable(['账单号','工作区','套餐','金额','状态','到期','操作/备注'],invoiceRows,'暂无账单');
  $$('[data-plan-edit]').forEach(b=>b.onclick=()=>planModal((plans.data||[]).find(x=>x.id===Number(b.dataset.planEdit))));
  $$('[data-invoice-paid]').forEach(b=>b.onclick=()=>invoiceSettle(b.dataset.invoicePaid,'paid'));
  $$('[data-invoice-void]').forEach(b=>b.onclick=()=>invoiceSettle(b.dataset.invoiceVoid,'void'));
};
function planModal(p){
  let featureText='[]';try{featureText=typeof p.features==='string'?p.features:JSON.stringify(p.features||[],null,2)}catch{}
  openModal(`<div class="modal-head"><div><h2>编辑套餐 · ${esc(p.code)}</h2><p>修改价格、配额、功能声明和上下架状态。</p></div><button class="btn" data-modal-close>关闭</button></div><form id="planForm"><div class="modal-body form-grid"><label><span>套餐名称</span><input name="name" value="${esc(p.name)}" required></label><label><span>状态</span><select name="status"><option value="active" ${p.status==='active'?'selected':''}>启用</option><option value="archived" ${p.status==='archived'?'selected':''}>归档</option></select></label><label class="full"><span>描述</span><textarea name="description" rows="3">${esc(p.description||'')}</textarea></label><label><span>月价（分）</span><input name="monthly_price_cents" type="number" min="0" value="${p.monthly_price_cents}"></label><label><span>短链接配额</span><input name="link_limit" type="number" min="1" value="${p.link_limit}"></label><label><span>二维码配额</span><input name="qr_limit" type="number" min="1" value="${p.qr_limit}"></label><label><span>文本分享配额</span><input name="text_limit" type="number" min="1" value="${p.text_limit}"></label><label><span>Bio 页面配额</span><input name="bio_limit" type="number" min="1" value="${p.bio_limit}"></label><label><span>文件空间（字节）</span><input name="file_storage_bytes" type="number" min="1" value="${p.file_storage_bytes}"></label><label><span>成员上限</span><input name="member_limit" type="number" min="1" value="${p.member_limit}"></label><label><span>分析保留天数</span><input name="analytics_retention_days" type="number" min="1" value="${p.analytics_retention_days}"></label><label class="full"><span>功能 JSON</span><textarea name="features" rows="5">${esc(featureText)}</textarea></label><div id="planError" class="alert hidden full"></div></div><div class="modal-foot"><button type="button" class="btn" data-modal-close>取消</button><button class="btn blue">保存套餐</button></div></form>`);
  $('#planForm').onsubmit=async e=>{e.preventDefault();const raw=Object.fromEntries(new FormData(e.currentTarget));for(const k of ['monthly_price_cents','link_limit','qr_limit','text_limit','bio_limit','file_storage_bytes','member_limit','analytics_retention_days'])raw[k]=Number(raw[k]);try{raw.features=JSON.parse(raw.features||'[]');await api(`/api/admin/plans/${p.id}`,{method:'PUT',body:JSON.stringify(raw)});closeModal();toast('套餐已更新');load('billing')}catch(err){const x=$('#planError');x.textContent=err.message;x.classList.remove('hidden')}};
}
function invoiceSettle(id,status){
  const title=status==='paid'?'确认账单已支付':'作废账单';
  openModal(`<div class="modal-head"><div><h2>${title}</h2><p>${status==='paid'?'确认收款后会按账单内容更新工作区订阅。':'作废后该账单不再参与结算。'}</p></div><button class="btn" data-modal-close>关闭</button></div><form id="invoiceForm"><div class="modal-body form-grid"><label class="full"><span>备注（可选）</span><textarea name="note" rows="3"></textarea></label><div id="invoiceError" class="alert hidden full"></div></div><div class="modal-foot"><button type="button" class="btn" data-modal-close>取消</button><button class="btn ${status==='paid'?'blue':'danger'}">确认</button></div></form>`);
  $('#invoiceForm').onsubmit=async e=>{e.preventDefault();try{await api(`/api/admin/invoices/${id}/settle`,{method:'POST',body:JSON.stringify({status,note:new FormData(e.currentTarget).get('note')||''})});closeModal();toast('账单状态已更新');load('billing')}catch(err){const x=$('#invoiceError');x.textContent=err.message;x.classList.remove('hidden')}};
}
