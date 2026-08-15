(()=>{
'use strict';
const nav=document.querySelector('#nav');
if(!nav)return;
const domainView=nav.querySelector('[data-view="domains"]');
if(!nav.querySelector('[data-view="shortdomains"]')){
  const button=document.createElement('button');
  button.dataset.view='shortdomains';
  button.dataset.permission='domains.manage';
  button.textContent='短链域名';
  if(domainView?.parentElement)domainView.parentElement.insertBefore(button,domainView.nextSibling);
  else nav.appendChild(button);
}
titles.shortdomains='短链域名';
permissionNames['domains.manage']='域名管理';
const previousRenderGeneric=renderGeneric;
renderGeneric=async function(view){
  if(view==='shortdomains')return renderOfficialDomains();
  return previousRenderGeneric(view);
};

function domainStatus(value){return value==='active'?'<span class="state active">可用</span>':'<span class="state suspended">已停用</span>'}
function domainRows(items=[]){
  return items.map(item=>`<tr>
    <td><div class="domainPrimary"><b>${esc(item.hostname)}</b>${item.is_default?'<span class="domainDefault">默认</span>':''}</div><small>${esc(item.label||'未填写备注')}</small></td>
    <td>${domainStatus(item.status)}</td>
    <td>${Number(item.sort_order||0)}</td>
    <td><div class="row-actions">
      ${item.status==='active'?`<button class="btn small" data-domain-status="${item.id}" data-next="disabled">停用</button>`:`<button class="btn small" data-domain-status="${item.id}" data-next="active">启用</button>`}
      ${item.is_default?'':`<button class="btn small" data-domain-default="${item.id}">设为默认</button>`}
      <button class="btn small" data-domain-edit="${item.id}">编辑</button>
      <button class="btn small danger" data-domain-delete="${item.id}">删除</button>
    </div></td>
  </tr>`).join('')||'<tr><td colspan="4"><div class="empty">还没有官方短链域名</div></td></tr>';
}

async function renderOfficialDomains(){
  const data=await api('/api/admin/official-domains');
  const items=data.data||[];
  document.querySelector('#content').innerHTML=pageHead(
    '短链域名',
    '维护客户创建短链接时可以直接选择的官方域名。客户自己的已验证域名会另外显示在其工作区中。',
    '<button class="btn blue" id="addOfficialDomain">添加域名</button>'
  )+`<div class="panel"><div class="panel-head"><div><h3>官方域名池</h3><p>可同时启用多个域名，并指定一个默认域名。停用后不会删除已经创建的短链接。</p></div><span>${items.filter(x=>x.status==='active').length} 个可用</span></div><div class="table-wrap"><table><thead><tr><th>域名</th><th>状态</th><th>排序</th><th>操作</th></tr></thead><tbody id="officialDomainRows">${domainRows(items)}</tbody></table></div></div>`;
  document.querySelector('#addOfficialDomain').onclick=()=>officialDomainModal();
}

function officialDomainModal(item=null){
  openModal(`<div class="modal-head"><div><h2>${item?'编辑短链域名':'添加短链域名'}</h2><p>${item?'修改显示名称、排序和默认状态。域名本身不可直接改名。':'域名需要已经解析到当前 GoJet 站点并具备有效 HTTPS。'}</p></div><button type="button" class="gojetDialogClose" data-modal-close aria-label="关闭" title="关闭">×</button></div><form id="officialDomainForm"><div class="modal-body form-grid">${item?`<label class="full"><span>域名</span><input value="${esc(item.hostname)}" disabled></label>`:`<label class="full"><span>域名</span><input name="hostname" placeholder="例如 go.example.com" required autocomplete="off"></label>`}<label><span>显示备注</span><input name="label" value="${esc(item?.label||'')}" maxlength="120" placeholder="例如：主短链域名"></label><label><span>排序</span><input name="sort_order" type="number" min="-10000" max="10000" value="${Number(item?.sort_order||0)}"></label><label class="check full"><input name="is_default" type="checkbox" ${item?.is_default?'checked':''}> 设为客户创建短链接时的默认官方域名</label><div id="officialDomainError" class="alert hidden full"></div></div><div class="modal-foot"><button type="button" class="btn" data-modal-close>取消</button><button class="btn blue">保存</button></div></form>`);
  const form=document.querySelector('#officialDomainForm');
  form.onsubmit=async event=>{
    event.preventDefault();
    const fd=new FormData(form);
    const payload={label:String(fd.get('label')||'').trim(),sort_order:Number(fd.get('sort_order')||0),is_default:form.elements.is_default.checked};
    if(!item)payload.hostname=String(fd.get('hostname')||'').trim();
    try{
      await api(item?`/api/admin/official-domains/${item.id}`:'/api/admin/official-domains',{method:item?'PATCH':'POST',body:JSON.stringify(payload)});
      closeModal();toast(item?'短链域名已更新':'短链域名已添加');renderOfficialDomains();
    }catch(err){const box=document.querySelector('#officialDomainError');box.textContent=err.message;box.classList.remove('hidden')}
  };
}

async function confirmDomainDelete(){
  if(typeof window.gojetAdminConfirm==='function')return window.gojetAdminConfirm('删除短链域名','删除后不能再作为官方域名创建新短链；已经被短链接使用的域名不会被强制删除。','确认删除','danger');
  return window.confirm('确认删除这个官方短链域名？已经被短链接使用的域名不能删除。');
}

document.querySelector('#content').addEventListener('click',async event=>{
  const edit=event.target.closest('[data-domain-edit]');
  const status=event.target.closest('[data-domain-status]');
  const makeDefault=event.target.closest('[data-domain-default]');
  const remove=event.target.closest('[data-domain-delete]');
  try{
    if(edit){const list=(await api('/api/admin/official-domains')).data||[];const item=list.find(x=>Number(x.id)===Number(edit.dataset.domainEdit));if(item)officialDomainModal(item);return}
    if(status){await api(`/api/admin/official-domains/${status.dataset.domainStatus}`,{method:'PATCH',body:JSON.stringify({status:status.dataset.next})});toast(status.dataset.next==='active'?'域名已启用':'域名已停用');return renderOfficialDomains()}
    if(makeDefault){await api(`/api/admin/official-domains/${makeDefault.dataset.domainDefault}`,{method:'PATCH',body:JSON.stringify({is_default:true})});toast('默认短链域名已更新');return renderOfficialDomains()}
    if(remove){if(!await confirmDomainDelete())return;await api(`/api/admin/official-domains/${remove.dataset.domainDelete}`,{method:'DELETE'});toast('短链域名已删除');return renderOfficialDomains()}
  }catch(err){fail(err.message)}
});
})();