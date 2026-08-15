(()=>{
'use strict';
let timer=null,busy=false,lastRisks=new Map();
const normalise=value=>String(value??'').trim();
function effective(item){
  if(!item)return'review';
  if(item.manual_decision)return String(item.manual_decision);
  const due=item.next_scan_at&&new Date(item.next_scan_at).getTime()<=Date.now();
  if(!item.scanned_at||due)return'review';
  return String(item.effective_decision||item.decision||'review');
}
function pill(decision,operational){
  if(decision==='block')return'<span class="state risk-blocked" title="目标风险审核已阻止该链接外跳">安全阻止</span>';
  if(decision==='review')return'<span class="state risk-review" title="目标正在安全审核；审核通过前不应视为正常链接">安全审核中</span>';
  if(operational==='paused')return'<span class="state paused">已暂停</span>';
  return'<span class="state risk-allow" title="目标风险审核已通过">正常</span>';
}
function decorate(){
  if(typeof currentView!=='undefined'&&currentView!=='links')return;
  const table=document.querySelector('#content table');if(!table)return;
  const rows=[...table.querySelectorAll('tbody tr')];
  rows.forEach(row=>{
    const cells=row.children;if(cells.length<7)return;
    const id=Number(cells[0].textContent.trim()||0),destination=normalise(cells[2].textContent);
    const item=lastRisks.get(id)||[...lastRisks.values()].find(x=>normalise(x.destination)===destination);
    const decision=effective(item),operational=String(item?.link_status||row.dataset.operationalStatus||'active');
    if(!row.dataset.operationalStatus)row.dataset.operationalStatus=operational;
    row.dataset.riskDecision=decision;
    row.classList.toggle('adminLinkRiskBlocked',decision==='block');
    row.classList.toggle('adminLinkRiskReview',decision==='review');
    cells[5].innerHTML=pill(decision,operational);
  });
}
async function refresh(){
  if(busy||(typeof currentView!=='undefined'&&currentView!=='links'))return;
  busy=true;
  try{
    const result=await api('/api/admin/destination-risks?limit=100&offset=0');
    const items=result.data||result.items||[];
    lastRisks=new Map(items.map(item=>[Number(item.link_id),item]));
    decorate();
  }catch(error){
    console.warn('GoJet admin link-risk synchronization unavailable',error);
    decorate();
  }finally{busy=false}
}
function start(){
  if(timer)return;
  timer=setInterval(()=>void refresh(),3500);
  void refresh();
}
const observer=new MutationObserver(()=>{
  if(typeof currentView!=='undefined'&&currentView==='links'){
    decorate();start();
  }
});
observer.observe(document.getElementById('content')||document.body,{childList:true,subtree:true});
document.getElementById('nav')?.addEventListener('click',event=>{if(event.target.closest('[data-view="links"]'))setTimeout(()=>void refresh(),80)});
start();
})();