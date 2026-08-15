'use strict';

const adminBillingCycles=[['月付',1],['季付',3],['半年付',6],['年付',12]];
const adminCycleNames={monthly:'月付',quarterly:'季付',semiannual:'半年付',annual:'年付'};

function planFeatures(plan){
  if(Array.isArray(plan?.features))return plan.features.filter(Boolean);
  if(typeof plan?.features==='string'){
    try{const value=JSON.parse(plan.features);return Array.isArray(value)?value.filter(Boolean):[]}catch{}
  }
  return [];
}
function planFeatureLines(plan){return planFeatures(plan).join('\n')}
function centsToYuan(value){return (Number(value||0)/100).toFixed(2)}
function bytesToGB(value){return (Number(value||0)/1073741824).toFixed(Number(value||0)%1073741824===0?0:2)}
function featureList(value){return String(value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}
function cyclePrices(monthlyCents,currency='CNY'){
  return `<div class="adminCyclePrices">${adminBillingCycles.map(([label,months])=>`<span><b>${label}</b>${centsToYuan(Number(monthlyCents||0)*months)} ${esc(currency)}</span>`).join('')}</div>`;
}
function existingPlanPayload(plan,status=plan.status){return{name:plan.name,description:plan.description||'',status,monthly_price_cents:Number(plan.monthly_price_cents||0),link_limit:Number(plan.link_limit||0),qr_limit:Number(plan.qr_limit||0),text_limit:Number(plan.text_limit||0),bio_limit:Number(plan.bio_limit||0),file_storage_bytes:Number(plan.file_storage_bytes||0),member_limit:Number(plan.member_limit||0),analytics_retention_days:Number(plan.analytics_retention_days||0),features:planFeatures(plan)}}

async function renderBilling(){
  const [plansResult,invoicesResult]=await Promise.all([api('/api/admin/plans'),api('/api/admin/invoices?limit=100')]);
  const plans=plansResult.data||[],invoices=invoicesResult.data||[];
  const planRows=plans.map(plan=>{
    const active=plan.status==='active';
    const actions=[`<button class="btn small" data-plan-edit="${plan.id}">编辑</button>`];
    if(active&&plan.code!=='starter')actions.push(`<button class="btn small danger" data-plan-archive="${plan.id}">归档</button>`);
    if(!active)actions.push(`<button class="btn small" data-plan-reactivate="${plan.id}">重新启用</button>`);
    return `<tr><td><b>${esc(plan.name)}</b><br><small>${esc(plan.code)}</small></td><td>${state(plan.status)}</td><td>${cyclePrices(plan.monthly_price_cents,plan.currency)}</td><td>${num(plan.link_limit)}</td><td>${num(plan.qr_limit)}</td><td>${num(plan.member_limit)}</td><td>${bytesToGB(plan.file_storage_bytes)} GB</td><td>${num(plan.analytics_retention_days)} 天</td><td><div class="row-actions">${actions.join('')}</div></td></tr>`;
  }).join('');
  const invoiceRows=invoices.map(invoice=>`<tr><td>${esc(invoice.invoice_number)}</td><td>#${invoice.workspace_id}</td><td>${esc(invoice.plan_name)}</td><td>${esc(adminCycleNames[invoice.billing_cycle]||`${Number(invoice.period_months||1)} 个月`)}</td><td>${(Number(invoice.amount_cents||0)/100).toFixed(2)} ${esc(invoice.currency)}</td><td>${state(invoice.status)}</td><td>${dt(invoice.due_at)}</td><td>${['pending','overdue'].includes(invoice.status)?`<div class="row-actions"><button class="btn small" data-invoice-paid="${invoice.id}">标记已支付</button><button class="btn small danger" data-invoice-void="${invoice.id}">作废</button></div>`:esc(invoice.admin_note||'—')}</td></tr>`).join('');

  $('#content').innerHTML=pageHead('套餐与账单','维护可售套餐、月价、真实账单周期、资源配额和账单状态。季付、半年付、年付均由月价自动计算。','<button class="btn blue" data-plan-create>新增套餐</button>')+
    panelTable(['套餐','状态','月 / 季 / 半年 / 年','短链接','二维码','成员','文件空间','分析保留','操作'],planRows,'暂无套餐')+
    panelTable(['账单号','工作区','套餐','周期','金额','状态','到期','操作 / 备注'],invoiceRows,'暂无账单');

  $('[data-plan-create]').onclick=()=>planModal();
  $$('[data-plan-edit]').forEach(button=>button.onclick=()=>planModal(plans.find(x=>x.id===Number(button.dataset.planEdit))));
  $$('[data-plan-archive]').forEach(button=>button.onclick=()=>archivePlan(plans.find(x=>x.id===Number(button.dataset.planArchive))));
  $$('[data-plan-reactivate]').forEach(button=>button.onclick=()=>reactivatePlan(plans.find(x=>x.id===Number(button.dataset.planReactivate))));
  $$('[data-invoice-paid]').forEach(button=>button.onclick=()=>invoiceSettle(button.dataset.invoicePaid,'paid'));
  $$('[data-invoice-void]').forEach(button=>button.onclick=()=>invoiceSettle(button.dataset.invoiceVoid,'void'));
}

function planModal(plan=null){
  const editing=Boolean(plan),title=editing?`编辑套餐 · ${esc(plan.name)}`:'新增套餐';
  const description=editing?'修改客户看到的月价、说明和资源配额；四种账单周期由月价自动推导。套餐代码与币种创建后保持不变。':'定义面向客户的套餐信息和工作区资源上限。月价保存后，系统自动计算月付、季付、半年付和年付金额。';
  const codeField=editing?`<label><span>套餐代码</span><input value="${esc(plan.code)}" disabled><small>创建后不可修改</small></label>`:`<label><span>套餐代码</span><input name="code" pattern="[a-z0-9_]{2,40}" placeholder="例如 team" required><small>仅小写字母、数字和下划线</small></label>`;
  const currencyField=editing?`<label><span>币种</span><input value="${esc(plan.currency)}" disabled><small>避免影响历史账单，创建后不可修改</small></label>`:`<label><span>币种</span><select name="currency"><option value="CNY">CNY · 人民币</option><option value="USD">USD · 美元</option><option value="HKD">HKD · 港币</option></select></label>`;
  const currency=editing?plan.currency:'CNY';

  $('#content').innerHTML=`<div class="adminWorkflowHead"><div><button type="button" class="adminWorkflowBack" id="planBack">← 返回套餐与账单</button><span class="eyebrow">PLAN SETTINGS</span><h2>${title}</h2><p>${description}</p></div><div class="adminWorkflowActions"><button type="button" class="btn" id="planCancel">取消</button><button class="btn blue" type="submit" form="planForm">${editing?'保存修改':'创建套餐'}</button></div></div>
    <form id="planForm" class="adminWorkflowForm planPageForm">
      <section class="adminWorkflowSection"><div class="adminWorkflowSectionHead"><span>01</span><div><h3>基本信息与账单周期</h3><p>只维护单月价格；季度、半年和年度金额始终按月价 × 3 / 6 / 12 自动计算，避免多套价格漂移。</p></div></div><div class="form-grid adminWorkflowGrid">
        ${codeField}<label><span>套餐名称</span><input name="name" value="${esc(plan?.name||'')}" maxlength="80" required></label>${currencyField}
        <label><span>单月价格</span><div class="inputSuffix"><input name="monthly_price" type="number" min="0" step="0.01" value="${editing?centsToYuan(plan.monthly_price_cents):'0.00'}" required><b>/ 月</b></div></label>
        <div class="full adminCyclePreview"><div><b>客户可选账单周期</b><small>固定开放四个周期，金额自动计算。</small></div><div data-cycle-preview>${cyclePrices(plan?.monthly_price_cents||0,currency)}</div></div>
        <label class="full"><span>套餐说明</span><textarea name="description" rows="3" maxlength="255" placeholder="适合哪些客户和使用场景">${esc(plan?.description||'')}</textarea></label>
        <label class="full"><span>客户可见功能</span><textarea name="features" rows="5" placeholder="每行一项，例如：\n5,000 条短链接\n180 天访问分析\n10 位团队成员">${esc(planFeatureLines(plan))}</textarea><small>每行一项，不需要填写 JSON。</small></label>
      </div></section>
      <section class="adminWorkflowSection"><div class="adminWorkflowSectionHead"><span>02</span><div><h3>资源配额</h3><p>这些数值直接决定工作区可使用的资源上限。</p></div></div><div class="form-grid adminWorkflowGrid adminQuotaGrid">
        <label><span>短链接</span><input name="link_limit" type="number" min="1" value="${plan?.link_limit||100}" required></label><label><span>二维码</span><input name="qr_limit" type="number" min="1" value="${plan?.qr_limit||25}" required></label><label><span>文本分享</span><input name="text_limit" type="number" min="1" value="${plan?.text_limit||25}" required></label><label><span>个人主页</span><input name="bio_limit" type="number" min="1" value="${plan?.bio_limit||3}" required></label><label><span>成员上限</span><input name="member_limit" type="number" min="1" value="${plan?.member_limit||3}" required></label><label><span>分析保留</span><div class="inputSuffix"><input name="analytics_retention_days" type="number" min="1" value="${plan?.analytics_retention_days||30}" required><b>天</b></div></label><label><span>文件空间</span><div class="inputSuffix"><input name="file_storage_gb" type="number" min="0.01" step="0.01" value="${editing?bytesToGB(plan.file_storage_bytes):'1'}" required><b>GB</b></div></label>
      </div></section><div id="planError" class="alert hidden"></div><footer class="adminWorkflowFooter"><span>保存后月价与四种周期金额立即用于后续新账单；历史账单金额不会被改写。</span><div><button type="button" class="btn" id="planCancelBottom">取消</button><button class="btn blue">${editing?'保存修改':'创建套餐'}</button></div></footer>
    </form>`;

  const leave=()=>renderBilling();$('#planBack').onclick=leave;$('#planCancel').onclick=leave;$('#planCancelBottom').onclick=leave;
  const monthly=$('#planForm [name="monthly_price"]'),currencyInput=$('#planForm [name="currency"]');
  const refreshCyclePreview=()=>{const cents=Math.round(Number(monthly?.value||0)*100),cur=currencyInput?.value||currency;const host=$('[data-cycle-preview]');if(host)host.innerHTML=cyclePrices(cents,cur)};
  monthly?.addEventListener('input',refreshCyclePreview);currencyInput?.addEventListener('change',refreshCyclePreview);
  $('#planForm').onsubmit=async event=>{
    event.preventDefault();const form=Object.fromEntries(new FormData(event.currentTarget));
    const payload={...(editing?{}:{code:String(form.code||'').trim(),currency:form.currency}),name:String(form.name||'').trim(),description:String(form.description||'').trim(),...(editing?{status:plan.status}:{}),monthly_price_cents:Math.round(Number(form.monthly_price||0)*100),link_limit:Number(form.link_limit),qr_limit:Number(form.qr_limit),text_limit:Number(form.text_limit),bio_limit:Number(form.bio_limit),file_storage_bytes:Math.round(Number(form.file_storage_gb||0)*1073741824),member_limit:Number(form.member_limit),analytics_retention_days:Number(form.analytics_retention_days),features:featureList(form.features)};
    try{await api(editing?`/api/admin/plans/${plan.id}`:'/api/admin/plans',{method:editing?'PUT':'POST',body:JSON.stringify(payload)});toast(editing?'套餐已更新':'套餐已创建');await renderBilling()}catch(error){const host=$('#planError');host.textContent=error.message;host.classList.remove('hidden')}
  };
}

async function archivePlan(plan){
  const ok=confirm(`归档“${plan.name}”后，新客户将无法再选择该套餐。历史账单仍会保留。确认继续？`);if(!ok)return;
  try{await api(`/api/admin/plans/${plan.id}`,{method:'DELETE'});toast('套餐已归档');load('billing')}catch(error){fail(error.message)}
}
async function reactivatePlan(plan){try{await api(`/api/admin/plans/${plan.id}`,{method:'PUT',body:JSON.stringify(existingPlanPayload(plan,'active'))});toast('套餐已重新启用');load('billing')}catch(error){fail(error.message)}}
function invoiceSettle(id,status){
  const title=status==='paid'?'确认账单已支付':'作废账单';
  openModal(`<div class="modal-head"><div><h2>${title}</h2><p>${status==='paid'?'仅用于人工收款场景；在线支付中的账单必须等待支付渠道回调。':'作废后该账单不再参与结算。'}</p></div><button class="btn iconClose" data-modal-close aria-label="关闭">×</button></div><form id="invoiceForm"><div class="modal-body form-grid"><label class="full"><span>处理备注（可选）</span><textarea name="note" rows="3" placeholder="例如：银行流水已核验"></textarea></label><div id="invoiceError" class="alert hidden full"></div></div><div class="modal-foot"><button type="button" class="btn" data-modal-close>取消</button><button class="btn ${status==='paid'?'blue':'danger'}">确认</button></div></form>`);
  $('#invoiceForm').onsubmit=async event=>{event.preventDefault();try{await api(`/api/admin/invoices/${id}/settle`,{method:'POST',body:JSON.stringify({status,note:new FormData(event.currentTarget).get('note')||''})});closeModal();toast('账单状态已更新');load('billing')}catch(error){const host=$('#invoiceError');host.textContent=error.message;host.classList.remove('hidden')}};
}
