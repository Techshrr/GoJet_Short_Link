(()=>{
'use strict';

let installed=false;
let latestRisks=new Map();
let syncTimer=null;
let syncWorkspace=0;
const riskLabels={allow:'正常使用',review:'安全审核中',block:'安全阻止'};

async function fetchRisks(){
  const workspace=Number(state.workspace||0);
  const result=await api(`/api/workspaces/${workspace}/link-risks`);
  if(workspace!==Number(state.workspace||0))return latestRisks;
  latestRisks=new Map((result.data||[]).map(item=>[Number(item.link_id),item]));
  return latestRisks;
}
function linkID(item){return Number(item?.ID??item?.id??0)}
function effectiveRisk(id){return latestRisks.get(Number(id))||null}
function statusClass(decision){return decision==='allow'?'status-active':decision==='block'?'status-block':'status-review'}
function cardLinkID(card,index){
  const stored=Number(card.dataset.linkId||0);
  if(stored)return stored;
  const qr=card.querySelector('button[onclick*="gojetOpenQR("]');
  const match=(qr?.getAttribute('onclick')||'').match(/gojetOpenQR\((\d+)\)/);
  const resolved=match?Number(match[1]):linkID((Array.isArray(state?.links)?state.links:[])[index]);
  if(resolved)card.dataset.linkId=String(resolved);
  return resolved;
}
function operationalStatus(id){
  const item=(Array.isArray(state?.links)?state.links:[]).find(link=>linkID(link)===Number(id));
  return String(item?.Status??item?.status??'active');
}

function applyRiskState(risks=latestRisks){
  const cards=[...document.querySelectorAll('#lhLinks .shareCard')];
  cards.forEach((card,index)=>{
    const id=cardLinkID(card,index);
    if(!id)return;
    const status=operationalStatus(id);
    const risk=risks.get(id);
    const badge=card.querySelector('.resourceTitleRow .productStatus');
    const decision=!risk||risk.pending?'review':risk.effective_decision;
    if(badge){
      badge.classList.remove('status-active','status-paused','status-review','status-block');
      if(decision==='block'){
        badge.textContent='安全阻止';
        badge.classList.add('status-block');
        badge.title=status==='paused'?'链接已暂停，且当前目标已被安全策略阻止':'当前目标已被安全策略阻止';
      }else if(decision==='review'){
        badge.textContent='安全审核中';
        badge.classList.add('status-review');
        badge.title=risk?'目标正在安全审核，暂不视为正常外跳':'暂时无法确认目标安全状态；平台按审核中处理';
      }else if(status==='paused'){
        badge.textContent='已暂停';
        badge.classList.add('status-paused');
        badge.title='目标安全审核已通过，但链接已由用户暂停';
      }else{
        badge.textContent=riskLabels.allow;
        badge.classList.add(statusClass('allow'));
        badge.title='目标安全审核已通过';
      }
    }
    card.dataset.riskDecision=decision;
    card.dataset.riskPending=String(Boolean(!risk||risk.pending));
    card.querySelectorAll('button').forEach(button=>{
      const handler=button.getAttribute('onclick')||'';
      if(!handler.includes('gojetOpenQR('))return;
      const allowed=status==='active'&&risk&&!risk.pending&&risk.effective_decision==='allow';
      button.disabled=!allowed;
      button.title=allowed?'为已通过安全审核的短链接生成二维码':'安全审核通过后才能生成二维码';
    });
  });
}

async function syncVisibleLinkRisks(){
  if(window.GoJetRouter?.currentView?.()!=='links'||!document.querySelector('#lhLinks')){
    stopRiskSync();
    return;
  }
  try{
    const risks=await fetchRisks();
    applyRiskState(risks);
  }catch(error){
    // Keep the last known state visible. A transient API failure must not turn
    // an already-blocked destination back into "正常使用".
    console.warn('GoJet link risk refresh unavailable',error);
    applyRiskState(latestRisks);
  }
}
function stopRiskSync(){if(syncTimer){clearInterval(syncTimer);syncTimer=null}syncWorkspace=0}
function startRiskSync(){
  const workspace=Number(state.workspace||0);
  if(syncTimer&&syncWorkspace===workspace)return;
  stopRiskSync();
  syncWorkspace=workspace;
  syncTimer=setInterval(()=>void syncVisibleLinkRisks(),4000);
}

async function decorateLinkCards(){
  try{await fetchRisks()}catch(error){console.warn('GoJet link risk state unavailable',error)}
  applyRiskState(latestRisks);
  startRiskSync();
}

async function requireAllow(id){
  try{await fetchRisks()}catch{return false}
  const risk=effectiveRisk(id);
  return Boolean(risk&&!risk.pending&&risk.effective_decision==='allow');
}

async function protectQRPage(){
  stopRiskSync();
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
  window.GoJetPages.links=async(...args)=>{stopRiskSync();const result=await baseLinks(...args);await decorateLinkCards();return result};

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
  // reconcile the already-visible badges immediately and keep them synchronized.
  if(document.querySelector('#lhLinks .shareCard'))void decorateLinkCards();
  if(document.querySelector('#qrEditor'))void protectQRPage();
  return true;
}

addEventListener('beforeunload',stopRiskSync);
if(!install()){
  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    if(install()||attempts>100)clearInterval(timer);
  },40);
}
})();