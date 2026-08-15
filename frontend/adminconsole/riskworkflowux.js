(()=>{
'use strict';

const modalRoot=()=>document.querySelector('#modal');
const selectedRiskID=()=>Number(document.querySelector('[data-risk-id].active')?.dataset?.riskId||0);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function normalizeModalClose(root=document){
  root.querySelectorAll?.('.modal-head [data-modal-close]').forEach(button=>{
    button.textContent='×';
    button.classList.add('gojetDialogClose');
    button.setAttribute('aria-label','关闭');
    button.setAttribute('title','关闭');
  });
}

async function confirmAction(title,message,confirmText='确认',tone='primary'){
  if(typeof window.openModal!=='function'||typeof window.closeModal!=='function')return false;
  return new Promise(resolve=>{
    let settled=false;
    const finish=value=>{
      if(settled)return;
      settled=true;
      window.closeModal();
      resolve(value);
    };
    window.openModal(`<div class="modal-head"><div><h2>${esc(title)}</h2><p>${esc(message)}</p></div><button type="button" class="gojetDialogClose" data-risk-confirm-close aria-label="关闭">×</button></div><div class="modal-body"><div class="info">此操作会立即影响当前短链的安全决策，请确认后继续。</div></div><div class="modal-foot"><button type="button" class="btn" data-risk-confirm-cancel>取消</button><button type="button" class="btn ${tone}" data-risk-confirm-ok>${esc(confirmText)}</button></div>`);
    const root=modalRoot();
    root?.querySelector('[data-risk-confirm-close]')?.addEventListener('click',()=>finish(false),{once:true});
    root?.querySelector('[data-risk-confirm-cancel]')?.addEventListener('click',()=>finish(false),{once:true});
    root?.querySelector('[data-risk-confirm-ok]')?.addEventListener('click',()=>finish(true),{once:true});
  });
}
window.gojetAdminConfirm=confirmAction;

function refreshRiskView(id){
  const selected=document.querySelector(`[data-risk-id="${Number(id)}"]`);
  if(selected){selected.click();return;}
  document.querySelector('[data-risk-refresh]')?.click();
}

function setRiskActionBusy(button,busy,label='处理中…'){
  if(!button)return;
  if(busy){
    button.dataset.previousLabel=button.textContent;
    button.textContent=label;
    button.disabled=true;
    button.setAttribute('aria-busy','true');
  }else{
    button.textContent=button.dataset.previousLabel||button.textContent;
    button.disabled=false;
    button.removeAttribute('aria-busy');
    delete button.dataset.previousLabel;
  }
}

async function pollRescan(id,before){
  const previousScan=String(before?.risk?.scanned_at||'');
  const previousFingerprint=String(before?.risk?.target_fingerprint||'');
  for(let attempt=0;attempt<20;attempt++){
    await sleep(attempt<5?700:1100);
    try{
      const detail=await api(`/api/admin/destination-risks/${id}`);
      const risk=detail?.risk||{};
      const scanChanged=String(risk.scanned_at||'')!==previousScan;
      const fingerprintChanged=String(risk.target_fingerprint||'')!==previousFingerprint;
      if(scanChanged||fingerprintChanged)return detail;
    }catch(error){
      if(attempt===19)throw error;
    }
  }
  return null;
}

async function handleRescan(button){
  const id=selectedRiskID();
  if(!id)return fail('请先选择一条风险记录');
  const ok=await confirmAction('重新扫描目标','扫描期间短链保持安全阻断；新结果完成后页面会自动刷新。','开始扫描','blue');
  if(!ok)return;
  setRiskActionBusy(button,true,'扫描中…');
  try{
    const before=await api(`/api/admin/destination-risks/${id}`);
    await api(`/api/admin/destination-risks/${id}/rescan`,{method:'POST'});
    toast('重新扫描已提交，正在等待新结果');
    const completed=await pollRescan(id,before);
    if(completed){
      toast('重新扫描完成，风险结论已更新');
    }else{
      toast('扫描任务仍在队列中，可稍后刷新查看结果');
    }
    refreshRiskView(id);
  }catch(error){
    fail(error.message||'重新扫描失败');
    refreshRiskView(id);
  }finally{
    setRiskActionBusy(button,false);
  }
}

async function handleOverride(button){
  const id=selectedRiskID();
  if(!id)return fail('请先选择一条风险记录');
  const decision=button.dataset.decision;
  const reason=document.querySelector('[data-risk-review-form] [name="reason"]')?.value?.trim()||'';
  if(reason.length<3)return fail('请填写至少 3 个字的审核依据');
  const meta={
    allow:['人工放行','放行后该链接会恢复外跳。请确认已经核验所有可达目标。','确认放行','blue'],
    review:['保持安全审核','该链接将继续停止外跳，并保持待审核状态。','保持审核',''],
    block:['人工阻止','阻止后该链接将停止外跳。','确认阻止','danger']
  }[decision]||['确认审核','确认保存当前人工风险结论。','确认',''];
  const ok=await confirmAction(...meta);
  if(!ok)return;
  setRiskActionBusy(button,true);
  try{
    await api(`/api/admin/destination-risks/${id}/override`,{method:'POST',body:JSON.stringify({decision,reason})});
    toast('人工风险结论已保存');
    refreshRiskView(id);
  }catch(error){fail(error.message)}finally{setRiskActionBusy(button,false)}
}

async function handleClearOverride(button){
  const id=selectedRiskID();
  if(!id)return fail('请先选择一条风险记录');
  const ok=await confirmAction('恢复自动判断','人工结论会被清除，随后立即按当前自动扫描结果执行。','恢复自动判断','blue');
  if(!ok)return;
  setRiskActionBusy(button,true);
  try{
    await api(`/api/admin/destination-risks/${id}/override`,{method:'DELETE'});
    toast('已恢复自动判断');
    refreshRiskView(id);
  }catch(error){fail(error.message)}finally{setRiskActionBusy(button,false)}
}

// Capture these actions before destinationrisk.js reaches its legacy native-confirm
// handlers. This keeps all risk decisions inside the same accessible GoJet dialog
// system and lets rescans behave like asynchronous work rather than a one-shot refresh.
document.addEventListener('click',event=>{
  const rescan=event.target.closest('[data-risk-rescan]');
  const override=event.target.closest('[data-decision]');
  const clear=event.target.closest('[data-clear-override]');
  if(!rescan&&!override&&!clear)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if(rescan){void handleRescan(rescan);return;}
  if(override){void handleOverride(override);return;}
  void handleClearOverride(clear);
},true);

const modal=modalRoot();
if(modal){
  normalizeModalClose(modal);
  new MutationObserver(()=>normalizeModalClose(modal)).observe(modal,{subtree:true,childList:true});
}
})();