(()=>{
'use strict';
let timer=null,busy=false,lastRisks=new Map();
function effective(item){
  if(!item)return'review';
  if(item.manual_decision)return String(item.manual_decision);
  const due=item.next_scan_at&&new Date(item.next_scan_at).getTime()<=Date.now();
  if(!item.scanned_at||due)return'review';
  const decision=String(item.effective_decision||item.decision||'review');
  return decision==='allow'||decision==='block'?decision:'review';
}
function pill(decision){
  if(decision==='block')return'<span class="state risk-blocked" title="目标风险审核已阻止该链接外跳">安全阻止</span>';
  if(decision==='review')return'<span class="state risk-review" title="目标正在安全审核；审核通过前不会继续外跳">安全审核中</span>';
  return'<span class="state risk-allow" title="目标风险审核已通过">审核通过</span>';
}
function linkTable(){
  return[...document.querySelectorAll('#content table')].find(table=>{
    const labels=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
    return labels.includes('短码')&&labels.includes('目标');
  })||null;
}
function rowLinkID(row){
  const first=row.children[0];
  const id=Number(row.dataset.linkId||first?.textContent.trim()||0);
  return Number.isFinite(id)&&id>0?id:0;
}
function currentLinkIDs(){
  const table=linkTable();if(!table)return[];
  return[...new Set([...table.querySelectorAll('tbody tr')].map(row=>rowLinkID(row)).filter(Boolean))].slice(0,100);
}
function prepareTable(table){
  const headers=[...table.querySelectorAll('thead th')];
  let statusIndex=headers.findIndex(th=>['状态','运行状态'].includes(th.textContent.trim()));
  if(statusIndex<0)return-1;
  const statusHeader=headers[statusIndex];
  if(statusHeader.textContent.trim()!=='运行状态')statusHeader.textContent='运行状态';
  let riskHeader=table.querySelector('thead th[data-link-risk-header]');
  if(!riskHeader){
    riskHeader=document.createElement('th');
    riskHeader.dataset.linkRiskHeader='1';
    riskHeader.textContent='目标安全';
    statusHeader.insertAdjacentElement('afterend',riskHeader);
  }
  const empty=table.querySelector('tbody tr td[colspan]');
  if(empty){const expected=table.querySelectorAll('thead th').length;if(Number(empty.getAttribute('colspan'))!==expected)empty.setAttribute('colspan',String(expected))}
  return statusIndex;
}
function decorate(){
  if(typeof currentView!=='undefined'&&currentView!=='links')return;
  const table=linkTable();if(!table)return;
  const statusIndex=prepareTable(table);if(statusIndex<0)return;
  [...table.querySelectorAll('tbody tr')].forEach(row=>{
    const cells=[...row.children];
    if(cells.length<=statusIndex||cells[0]?.hasAttribute('colspan'))return;
    const id=rowLinkID(row);
    if(!id)return;
    row.dataset.linkId=String(id);
    let riskCell=row.querySelector('[data-link-risk]');
    if(!riskCell){
      riskCell=document.createElement('td');
      riskCell.dataset.linkRisk='1';
      riskCell.className='adminLinkRiskCell';
      const operationalCell=row.children[statusIndex];
      operationalCell.insertAdjacentElement('afterend',riskCell);
    }
    const decision=effective(lastRisks.get(id));
    if(riskCell.dataset.decision!==decision){riskCell.dataset.decision=decision;riskCell.innerHTML=pill(decision)}
    row.dataset.riskDecision=decision;
    row.classList.toggle('adminLinkRiskBlocked',decision==='block');
    row.classList.toggle('adminLinkRiskReview',decision==='review');
  });
}
async function refresh(){
  if(busy||(typeof currentView!=='undefined'&&currentView!=='links'))return;
  const ids=currentLinkIDs();
  if(!ids.length){lastRisks=new Map();decorate();return}
  busy=true;
  try{
    // Ask for the exact links currently rendered. Review-queue severity ordering
    // and the first-100 pagination window must never decide what link management
    // thinks the safety state is.
    const query=new URLSearchParams({link_ids:ids.join(',')});
    const result=await api('/api/admin/destination-risks?'+query);
    const items=result.data||result.items||[];
    lastRisks=new Map(items.map(item=>[Number(item.link_id),item]).filter(([id])=>Number.isFinite(id)&&id>0));
  }catch(error){
    console.warn('GoJet admin link-risk synchronization unavailable',error);
  }finally{
    busy=false;
    decorate();
  }
}
function start(){if(timer)return;timer=setInterval(()=>void refresh(),3500);void refresh()}
const observer=new MutationObserver(()=>{
  if(typeof currentView!=='undefined'&&currentView==='links'){decorate();start()}
});
observer.observe(document.getElementById('content')||document.body,{childList:true,subtree:true});
document.getElementById('nav')?.addEventListener('click',event=>{if(event.target.closest('[data-view="links"]'))setTimeout(()=>void refresh(),80)});
start();
})();