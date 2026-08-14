(()=>{
'use strict';
const q=(selector,root=document)=>root.querySelector(selector);
const qa=(selector,root=document)=>[...root.querySelectorAll(selector)];
const categoryNames={
  adult_content:'色情 / 成人内容',gambling:'赌博',fraud_phishing_impersonation:'诈骗 / 钓鱼 / 冒充',malware:'恶意软件',
  extremism_disinformation:'极端主义 / 有组织虚假信息',violence_hate_terrorism:'暴力 / 仇恨 / 恐怖主义',
  copyright_redistribution:'侵权 / 未授权再分发',pyramid_deceptive_marketing:'传销 / 欺骗性营销',
  unauthorized_account_resale:'未经授权账户转售',harmful_automation:'高风险自动化流量',bulk_spam:'批量垃圾信息',platform_security:'平台安全 / SSRF'
};
const decisionNames={allow:'放行',review:'待审核',block:'阻止'};
const model={filter:'',items:[],total:0,offset:0,limit:50,selected:null,detail:null,busy:false};
let baseReload=null;
function safeEsc(value){return typeof window.esc==='function'?window.esc(value):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmtDate(value){return typeof window.dt==='function'?window.dt(value):value||'—'}
function notify(value){if(typeof window.toast==='function')window.toast(value)}
function report(value){if(typeof window.fail==='function')window.fail(value);else console.error(value)}
function request(path,options){if(typeof window.api!=='function')throw new Error('管理端 API 尚未初始化');return window.api(path,options)}
function badge(value){const key=['allow','review','block'].includes(value)?value:'pending';return `<span class="riskDecision ${key}">${safeEsc(decisionNames[value]||'扫描中')}</span>`}
function categories(items=[]){return items.length?items.map(item=>`<span class="riskCategory">${safeEsc(categoryNames[item]||item)}</span>`).join(''):'<span class="riskCategory">未发现分类信号</span>'}
function evidenceRows(raw){const list=Array.isArray(raw)?raw:[];if(!list.length)return '<div class="riskEmpty">暂无扫描证据</div>';return list.map(item=>`<article><b>${safeEsc(item.final_url||item.url||'目标')}</b>${item.error?`<p>${safeEsc(item.error)}</p>`:''}<p>HTTP ${safeEsc(item.status_code||'—')} · ${safeEsc(item.content_type||'未知类型')}</p>${Array.isArray(item.signals)&&item.signals.length?`<div class="riskSignals">${item.signals.map(signal=>`<span>${safeEsc(signal)}</span>`).join('')}</div>`:''}</article>`).join('')}
function currentButton(){return q('#nav [data-risk-review]')}
function enter(){
  qa('#nav [data-view],#nav [data-risk-review]').forEach(node=>node.classList.toggle('active',node===currentButton()));
  q('#pageTitle').textContent='目标风险审核';
  if(!baseReload)baseReload=q('#reload').onclick;
  q('#reload').onclick=()=>void loadQueue(model.selected);
  renderShell();void loadQueue(model.selected);
}
function leave(){if(baseReload)q('#reload').onclick=baseReload;currentButton()?.classList.remove('active')}
function renderShell(){
  q('#content').innerHTML=`<div class="riskWorkspace">
    <div class="page-head"><div><h2>目标风险审核</h2><p>复核短链目标的自动风险判断。只有 ALLOW 才允许外跳；重新扫描和异常状态会立即进入安全阻断。</p></div><div class="page-actions"><button class="btn" data-risk-refresh>刷新队列</button></div></div>
    <div class="riskSummary"><article><span>当前记录</span><strong data-risk-total>—</strong></article><article><span>待人工审核</span><strong data-risk-review-count>—</strong></article><article><span>已自动阻止</span><strong data-risk-block-count>—</strong></article><article><span>当前筛选</span><strong data-risk-filter-name>全部</strong></article></div>
    <div class="riskLayout"><section class="riskQueue"><div class="riskQueueHead"><div><h3>风险队列</h3><p>优先展示阻止和待审核项；列表不会自动替你作法律定性。</p></div><div class="riskFilters"><button data-risk-filter="" class="active">全部</button><button data-risk-filter="review">待审核</button><button data-risk-filter="block">已阻止</button><button data-risk-filter="allow">已放行</button></div></div><div class="riskList" data-risk-list><div class="riskEmpty">正在读取风险队列…</div></div><div class="riskPager" data-risk-pager></div></section>
    <section class="riskDetail"><div class="riskDetailHead"><div><h3>审核工作区</h3><p>选择一条记录查看目标、证据和人工审核状态。</p></div></div><div class="riskDetailBody" data-risk-detail><div class="riskEmpty">从左侧选择一条风险记录。</div></div></section></div></div>`;
  q('[data-risk-refresh]').onclick=()=>void loadQueue(model.selected);
  qa('[data-risk-filter]').forEach(button=>button.onclick=()=>{model.filter=button.dataset.riskFilter||'';model.offset=0;model.selected=null;qa('[data-risk-filter]').forEach(x=>x.classList.toggle('active',x===button));void loadQueue()});
}
async function loadQueue(selectID){
  if(model.busy)return;model.busy=true;
  try{
    const params=new URLSearchParams({limit:String(model.limit),offset:String(model.offset)});if(model.filter)params.set('decision',model.filter);
    const payload=await request('/api/admin/destination-risks?'+params);
    model.items=Array.isArray(payload.data)?payload.data:[];model.total=Number(payload.total||0);
    q('[data-risk-total]').textContent=String(model.total);
    q('[data-risk-review-count]').textContent=String(model.items.filter(x=>x.effective_decision==='review').length)+(model.filter?' / 本页':'');
    q('[data-risk-block-count]').textContent=String(model.items.filter(x=>x.effective_decision==='block').length)+(model.filter?' / 本页':'');
    q('[data-risk-filter-name]').textContent=model.filter?(decisionNames[model.filter]||model.filter):'全部';
    renderList();
    if(selectID&&model.items.some(x=>Number(x.link_id)===Number(selectID)))model.selected=Number(selectID);
    if(model.selected)await loadDetail(model.selected);else if(model.items.length)await loadDetail(Number(model.items[0].link_id));else q('[data-risk-detail]').innerHTML='<div class="riskEmpty">当前筛选下没有风险记录。</div>';
  }catch(error){q('[data-risk-list]').innerHTML=`<div class="riskEmpty">${safeEsc(error.message)}</div>`;report(error.message)}finally{model.busy=false}
}
function renderList(){
  const list=q('[data-risk-list]');
  list.innerHTML=model.items.length?model.items.map(item=>`<button class="riskRow ${Number(item.link_id)===Number(model.selected)?'active':''}" data-risk-id="${Number(item.link_id)}"><div class="riskRowMain"><div class="riskRowTitle"><strong>${safeEsc(item.domain?item.domain+'/'+item.code:item.code||('链接 #'+item.link_id))}</strong>${badge(item.effective_decision)}</div><span class="riskRowTarget">${safeEsc(item.destination||'')}</span><div class="riskRowMeta"><span>自动：${safeEsc(decisionNames[item.decision]||item.decision)}</span><span>${safeEsc((item.categories||[]).map(x=>categoryNames[x]||x).slice(0,2).join(' · ')||'无分类')}</span><span>${safeEsc(fmtDate(item.scanned_at))}</span></div></div><div class="riskScore"><span>风险分</span><strong>${Number(item.score||0)}</strong></div></button>`).join(''):'<div class="riskEmpty">当前筛选下没有风险记录。</div>';
  qa('[data-risk-id]',list).forEach(button=>button.onclick=()=>void loadDetail(Number(button.dataset.riskId)));
  const from=model.total?model.offset+1:0,to=Math.min(model.offset+model.limit,model.total);q('[data-risk-pager]').innerHTML=`<span>${from}–${to} / ${model.total}</span><div><button data-risk-prev ${model.offset<=0?'disabled':''}>上一页</button><button data-risk-next ${model.offset+model.limit>=model.total?'disabled':''}>下一页</button></div>`;
  q('[data-risk-prev]')?.addEventListener('click',()=>{model.offset=Math.max(0,model.offset-model.limit);model.selected=null;void loadQueue()});
  q('[data-risk-next]')?.addEventListener('click',()=>{model.offset+=model.limit;model.selected=null;void loadQueue()});
}
async function loadDetail(id){
  model.selected=id;qa('[data-risk-id]').forEach(row=>row.classList.toggle('active',Number(row.dataset.riskId)===id));q('[data-risk-detail]').innerHTML='<div class="riskEmpty">正在读取扫描证据…</div>';
  try{model.detail=await request(`/api/admin/destination-risks/${id}`);renderDetail(model.detail)}catch(error){q('[data-risk-detail]').innerHTML=`<div class="riskEmpty">${safeEsc(error.message)}</div>`;report(error.message)}
}
function renderDetail(payload){
  const risk=payload.risk||{},manual=risk.manual_decision||'',effective=risk.effective_decision||risk.decision||'review',targets=Array.isArray(payload.targets)?payload.targets:[];
  q('[data-risk-detail]').innerHTML=`
    ${payload.stale?'<div class="riskStale">当前目标已经变化，旧扫描结论已失效。请重新扫描后再进行人工审核。</div>':''}
    <div class="riskSection"><div class="riskDecisionGrid"><div class="riskDecisionCard"><span>当前有效决策</span><strong>${badge(effective)}</strong></div><div class="riskDecisionCard"><span>自动判断</span><strong>${badge(risk.decision||'review')}</strong></div><div class="riskDecisionCard"><span>风险分数</span><strong>${Number(risk.score||0)} / 100</strong></div></div></div>
    <div class="riskSection"><h4>可达目标</h4><div class="riskTargets">${targets.map(target=>`<div class="riskTarget">${safeEsc(target)}</div>`).join('')||'<div class="riskTarget">暂无目标</div>'}</div></div>
    <div class="riskSection"><h4>风险分类</h4><div class="riskCategories">${categories(risk.categories||[])}</div></div>
    <div class="riskSection"><h4>扫描证据</h4><div class="riskEvidence">${evidenceRows(risk.evidence)}</div></div>
    <div class="riskSection"><h4>扫描状态</h4><div class="riskDecisionGrid"><div class="riskDecisionCard"><span>扫描器</span><strong>${safeEsc(risk.provider||'builtin')}</strong></div><div class="riskDecisionCard"><span>最后扫描</span><strong>${safeEsc(fmtDate(risk.scanned_at))}</strong></div><div class="riskDecisionCard"><span>计划复扫</span><strong>${safeEsc(fmtDate(risk.next_scan_at))}</strong></div></div><p class="riskRowMeta">Fingerprint：${safeEsc(risk.target_fingerprint||'—')}</p></div>
    <div class="riskSection"><h4>人工审核</h4>${manual?`<div class="riskWarning">当前存在人工结论：${safeEsc(decisionNames[manual]||manual)}。理由：${safeEsc(risk.manual_reason||'—')}</div>`:''}<form class="riskReviewForm" data-risk-review-form><textarea name="reason" maxlength="500" minlength="3" placeholder="填写审核依据，例如：已人工核验站点归属、页面内容及跳转目标。" required></textarea><div class="riskReviewActions"><button type="button" class="btn" data-decision="allow">人工放行</button><button type="button" class="btn" data-decision="review">保持审核</button><button type="button" class="btn" data-decision="block">人工阻止</button>${manual?'<button type="button" class="btn" data-clear-override>恢复自动判断</button>':''}<button type="button" class="btn" data-risk-rescan>重新扫描</button></div><small>人工结论只绑定当前目标 fingerprint；目标地址变化后自动失效。</small></form></div>`;
  qa('[data-decision]').forEach(button=>button.onclick=()=>void applyOverride(risk.link_id,button.dataset.decision));
  q('[data-clear-override]')?.addEventListener('click',()=>void clearOverride(risk.link_id));
  q('[data-risk-rescan]')?.addEventListener('click',()=>void rescan(risk.link_id));
}
async function applyOverride(id,decision){const form=q('[data-risk-review-form]'),reason=q('[name=reason]',form).value.trim();if(reason.length<3){report('请填写至少 3 个字的审核依据');return}const message=decision==='allow'?'人工放行后该链接会恢复跳转。确认已核验所有可达目标？':decision==='block'?'人工阻止后该链接将停止外跳。确认继续？':'该链接将保持安全审核状态并停止外跳。确认继续？';if(!confirm(message))return;try{await request(`/api/admin/destination-risks/${id}/override`,{method:'POST',body:JSON.stringify({decision,reason})});notify('人工风险结论已保存');await loadQueue(id)}catch(error){report(error.message)}}
async function clearOverride(id){if(!confirm('恢复自动判断后，将立即按当前自动风险决策执行。确认继续？'))return;try{await request(`/api/admin/destination-risks/${id}/override`,{method:'DELETE'});notify('已恢复自动判断');await loadQueue(id)}catch(error){report(error.message)}}
async function rescan(id){if(!confirm('重新扫描期间该短链接会立即停止外跳，直到新扫描完成。确认继续？'))return;try{await request(`/api/admin/destination-risks/${id}/rescan`,{method:'POST'});notify('已进入重新扫描，当前链接保持安全阻断');await loadQueue(id)}catch(error){report(error.message)}}
function install(){const button=currentButton();if(!button)return;button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();enter()});q('#nav').addEventListener('click',event=>{if(event.target.closest('[data-view]'))leave()},true)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
