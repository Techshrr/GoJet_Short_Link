(()=>{
'use strict';

let installed=false;
let latestRisks=new Map();
const riskLabels={allow:'正常使用',review:'安全审核中',block:'安全阻止'};

async function fetchRisks(){
  const result=await api(`/api/workspaces/${state.workspace}/link-risks`);
  latestRisks=new Map((result.data||[]).map(item=>[Number(item.link_id),item]));
  return latestRisks;
}
function linkID(item){return Number(item?.ID??item?.id??0)}
function effectiveRisk(id){return latestRisks.get(Number(id))||null}
function statusClass(decision){return decision==='allow'?'status-active':decision==='block'?'status-block':'status-review'}

async function decorateLinkCards(){
  let risks;
  try{risks=await fetchRisks()}catch(error){risks=new Map();console.warn('GoJet link risk state unavailable',error)}
  const items=Array.isArray(state?.links)?state.links:[];
  const cards=[...document.querySelectorAll('#lhLinks .shareCard')];
  cards.forEach((card,index)=>{
    const item=items[index];
    if(!item)return;
    const id=linkID(item),status=String(item.Status??item.status??'');
    const risk=risks.get(id);
    const badge=card.querySelector('.resourceTitleRow .productStatus');
    if(badge){
      badge.classList.remove('status-active','status-review','status-block');
      if(status==='paused'){
        badge.textContent='已暂停';
        badge.classList.add('status-paused');
        badge.title='链接已由用户暂停';
      }else if(!risk){
        badge.textContent='安全状态未知';
        badge.classList.add('status-review');
        badge.title='暂时无法确认目标安全状态；平台外跳策略保持安全优先';
      }else{
        const decision=risk.pending?'review':risk.effective_decision;
        badge.textContent=riskLabels[decision]||'安全审核中';
        badge.classList.add(statusClass(decision));
        badge.title=decision==='allow'?'目标安全审核已通过':decision==='block'?'目标已被安全策略阻止':'目标正在安全审核，暂不视为正常外跳';
      }
    }
    card.querySelectorAll('button').forEach(button=>{
      const handler=button.getAttribute('onclick')||'';
      if(!handler.includes('gojetOpenQR('))return;
      const allowed=status==='active'&&risk&&!risk.pending&&risk.effective_decision==='allow';
      button.disabled=!allowed;
      button.title=allowed?'为已通过安全审核的短链接生成二维码':'安全审核通过后才能生成二维码';
    });
  });
}

async function requireAllow(id){
  try{await fetchRisks()}catch{return false}
  const risk=effectiveRisk(id);
  return Boolean(risk&&!risk.pending&&risk.effective_decision==='allow');
}

async function protectQRPage(){
  let risks;
  try{risks=await fetchRisks()}catch{risks=new Map()}
  const select=document.querySelector('#qrEditor select[name="link_id"]');
  if(!select)return;
  [...select.options].forEach(option=>{
    const risk=risks.get(Number(option.value));
    if(!risk||risk.pending||risk.effective_decision!=='allow')option.remove();
  });
  if(select.options.length){
    const note=document.createElement('small');
    note.className='settingHelp';
    note.textContent='这里只列出已通过目标安全审核的短链接。修改目标后需要重新审核。';
    select.closest('label')?.appendChild(note);
    return;
  }
  const editor=document.querySelector('#qrEditor');
  if(editor){
    editor.innerHTML='<div class="notice"><b>暂无可生成二维码的短链接</b><p>二维码只能绑定已通过目标安全审核的短链接。请等待审核完成或先处理被阻止的目标。</p></div>';
  }
}

function install(){
  if(installed||!window.GoJetPages?.links||!window.GoJetPages?.qrs||typeof window.gojetOpenQR!=='function')return false;
  installed=true;
  const baseLinks=window.GoJetPages.links;
  window.GoJetPages.links=async(...args)=>{const result=await baseLinks(...args);await decorateLinkCards();return result};

  const baseQRPage=window.GoJetPages.qrs;
  window.GoJetPages.qrs=async(...args)=>{const result=await baseQRPage(...args);await protectQRPage();return result};

  const baseOpenQR=window.gojetOpenQR;
  window.gojetOpenQR=async id=>{
    if(!await requireAllow(id)){
      if(window.gojetMessage)await window.gojetMessage('二维码暂不可生成','该短链接尚未通过当前目标的安全审核。目标审核通过后才能生成二维码。');
      return;
    }
    return baseOpenQR(id);
  };

  // If the router rendered the link page before this late-loaded guard installed,
  // reconcile the already-visible badges immediately.
  if(document.querySelector('#lhLinks .shareCard'))void decorateLinkCards();
  if(document.querySelector('#qrEditor'))void protectQRPage();
  return true;
}

if(!install()){
  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    if(install()||attempts>100)clearInterval(timer);
  },40);
}
})();