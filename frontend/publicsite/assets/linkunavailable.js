(()=>{
'use strict';
const params=new URLSearchParams(location.search),reason=params.get('reason')==='blocked'?'blocked':'review',code=(params.get('code')||'').trim().slice(0,80);
document.body.dataset.safety=reason;
const title=document.querySelector('#safetyTitle'),description=document.querySelector('#safetyDescription'),state=document.querySelector('#safetyState'),note=document.querySelector('#safetyNote');
if(reason==='blocked'){
  document.title='链接已被安全阻止 · GoJet';
  title.textContent='此链接已被安全阻止';
  description.textContent='GoJet 的目标安全审核发现该链接存在违反平台安全政策的风险，因此已停止继续跳转。';
  state.textContent='安全阻止';
  note.textContent='如果你是链接创建者，并认为审核结论有误，可以提交工单并附上链接参考编号申请人工复核。';
}else{
  document.title='链接正在安全审核 · GoJet';
  title.textContent='此链接正在安全审核';
  description.textContent='GoJet 暂时无法确认目标页面的安全状态。审核完成并确认可以访问前，我们不会继续跳转。';
  state.textContent='安全审核中';
}
if(code){document.querySelector('#safetyReference')?.classList.remove('hidden');const target=document.querySelector('#safetyCode');if(target)target.textContent=code}
})();