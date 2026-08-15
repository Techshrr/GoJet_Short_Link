(()=>{
'use strict';
const params=new URLSearchParams(location.search);
const rawReason=(params.get('reason')||'review').trim();
const reason=rawReason==='blocked'?'blocked':rawReason==='unavailable'?'unavailable':'review';
const rawKind=(params.get('kind')||'link').trim();
const kind=['link','text','file','bio'].includes(rawKind)?rawKind:'link';
const code=(params.get('code')||params.get('ref')||'').trim().slice(0,80);
const labels={link:'链接',text:'文本分享',file:'文件分享',bio:'个人主页'};
const resource=labels[kind];
document.body.dataset.safety=reason;
const title=document.querySelector('#safetyTitle'),description=document.querySelector('#safetyDescription'),state=document.querySelector('#safetyState'),note=document.querySelector('#safetyNote');
if(reason==='blocked'){
  document.title=`${resource}已被安全阻止 · GoJet`;
  title.textContent=`此${resource}已被安全阻止`;
  description.textContent=kind==='link'?'GoJet 的目标安全审核发现该链接存在违反平台安全政策的风险，因此已停止继续跳转。':`GoJet 的安全检查发现此${resource}当前不符合平台安全策略，因此已停止公开访问。`;
  state.textContent='安全阻止';
  note.textContent=`如果你是${resource}创建者，并认为审核结论有误，可以提交工单并附上参考编号申请人工复核。`;
}else if(reason==='unavailable'){
  document.title=`${resource}暂不可用 · GoJet`;
  title.textContent=`此${resource}暂不可用`;
  description.textContent=`此${resource}可能已过期、已关闭、达到使用限制，或当前无法通过安全检查。为保护访问者，GoJet 不会继续提供该内容。`;
  state.textContent='暂不可用';
  note.textContent=`如果你是${resource}创建者，并认为当前状态有误，可以提交工单并附上参考编号。`;
}else{
  document.title=`${resource}正在安全审核 · GoJet`;
  title.textContent=`此${resource}正在安全审核`;
  description.textContent=kind==='link'?'GoJet 暂时无法确认目标页面的安全状态。审核完成并确认可以访问前，我们不会继续跳转。':`GoJet 正在核验此${resource}的安全状态。确认可安全访问前，公开访问将暂时停止。`;
  state.textContent='安全审核中';
}
if(code){document.querySelector('#safetyReference')?.classList.remove('hidden');const target=document.querySelector('#safetyCode');if(target)target.textContent=code}
const appeal=document.querySelector('#safetyAppeal');
if(appeal){
  const appealParams=new URLSearchParams({mode:'appeal',resource_kind:kind,safety_state:reason});
  if(code)appealParams.set('resource_ref',code);
  appeal.href=`/app/support?${appealParams.toString()}`;
}
})();