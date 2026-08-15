(()=>{
'use strict';

const BQ=s=>document.querySelector(s);
const BQA=s=>[...document.querySelectorAll(s)];
const BE=v=>escapeHTML(v??'');
let billingData=null;
let paymentPoll=null;
let returnPoll=null;

const statusName={active:'使用中',past_due:'待处理',cancelled:'已取消',pending:'待支付',paid:'已支付',void:'已作废',overdue:'已逾期'};
const typeName={purchase:'购买套餐',upgrade:'变更套餐',renewal:'续费'};
const providerName={alipay:'支付宝',wechat:'微信支付',epay:'易支付',paypal:'PayPal',stripe:'Stripe'};
const billingCycles=[
  {id:'monthly',label:'月付',months:1},
  {id:'quarterly',label:'季付',months:3},
  {id:'semiannual',label:'半年付',months:6},
  {id:'annual',label:'年付',months:12}
];
const cycleName=Object.fromEntries(billingCycles.map(item=>[item.id,item.label]));

function money(cents,currency='CNY'){
  try{return new Intl.NumberFormat('zh-CN',{style:'currency',currency:currency||'CNY'}).format(Number(cents||0)/100)}
  catch{return `${currency} ${(Number(cents||0)/100).toFixed(2)}`}
}
function fmtDate(value){
  if(!value)return'—';
  const dateValue=new Date(value);
  return Number.isNaN(dateValue.valueOf())?String(value):dateValue.toLocaleString('zh-CN',{hour12:false});
}
function modal(title,body){
  const layer=document.createElement('div');
  layer.className='productModalLayer';
  layer.innerHTML=`<div class="productModal billingDialog"><div class="productModalHead"><h2>${BE(title)}</h2><button type="button" data-close aria-label="关闭">×</button></div><div class="billingDialogBody">${body}</div></div>`;
  document.body.appendChild(layer);
  const close=()=>{clearInterval(paymentPoll);paymentPoll=null;layer.remove()};
  layer.querySelector('[data-close]').onclick=close;
  return{layer,close};
}

async function render(){
  clearInterval(paymentPoll);paymentPoll=null;
  clearInterval(returnPoll);returnPoll=null;
  const content=BQ('.content');
  content.innerHTML=`<div class="productPageHead"><div><h1>套餐与账单</h1><p>管理套餐、续费周期与付款记录。</p></div><button id="billingRefresh">刷新</button></div><div id="billingWorkspace" class="productLoading">正在加载账单…</div>`;
  BQ('#billingRefresh').onclick=render;
  await load();
  beginReturnReconcile();
}

async function load(){
  const host=BQ('#billingWorkspace');
  try{
    billingData=await api(`/api/workspaces/${state.workspace}/billing`);
    const data=billingData;
    const subscription=data.subscription||{};
    const plans=data.plans||[];
    const invoices=data.invoices||[];
    host.innerHTML=`${paymentNotice()}
      <section class="subscriptionSummary billingSummary">
        <div><small>当前套餐</small><h2>${BE(subscription.plan_name||'基础套餐')}</h2><p>${subscription.period_ends_at?'当前周期至 '+fmtDate(subscription.period_ends_at):'当前套餐长期有效'}</p></div>
        <span class="productStatus">${BE(statusName[subscription.status]||subscription.status||'使用中')}</span>
        ${subscription.plan_code&&subscription.plan_code!=='starter'?`<button id="billingCancellation">${subscription.cancel_at_period_end?'继续订阅':'到期后取消'}</button>`:''}
      </section>
      ${subscription.cancel_at_period_end?'<div class="notice">当前套餐将在本周期结束后停止续订。你可以在到期前恢复续订。</div>':''}
      <section class="billingSection"><div class="billingSectionHead"><div><h2>选择套餐</h2><p>选择适合你的套餐，付款前再确定月付、季付、半年付或年付。</p></div></div><div class="planGrid billingPlans">${plans.map(plan=>planCard(plan,subscription)).join('')}</div></section>
      <section class="billingSection"><div class="billingSectionHead"><div><h2>账单记录</h2><p>在这里查看付款状态、账单周期和历史记录。</p></div></div>${invoices.length?`<div class="billingInvoiceList">${invoices.map(invoiceCard).join('')}</div>`:'<div class="billingEmpty"><b>暂无账单记录</b><p>购买套餐或续费后，账单会显示在这里。</p></div>'}</section>`;
    wire(subscription);
  }catch(error){
    host.innerHTML=`<div class="productError">${BE(error.message)}</div>`;
  }
}

function paymentResult(){return new URLSearchParams(location.search).get('payment')||''}
function paymentNotice(){
  const result=paymentResult();
  if(result==='success')return '<div class="productSuccess billingNotice"><b>支付成功。</b> 套餐与账单已更新。</div>';
  if(result==='return')return '<div class="notice billingNotice"><b>已返回 GoJet。</b> 正在核对付款结果，请勿重复支付。</div>';
  if(result==='cancelled')return '<div class="notice billingNotice">本次付款未完成，账单已保留，你可以稍后继续支付。</div>';
  if(result==='failed')return '<div class="productError billingNotice">暂时无法确认付款结果。若已经扣款，请勿重复支付，并提交工单附上账单号。</div>';
  return'';
}

function beginReturnReconcile(){
  if(paymentResult()!=='return'||returnPoll)return;
  let attempts=0;
  returnPoll=setInterval(async()=>{
    if(++attempts>20){clearInterval(returnPoll);returnPoll=null;return}
    try{
      const fresh=await api(`/api/workspaces/${state.workspace}/billing`);
      const latest=(fresh.invoices||[])[0];
      if(latest?.status==='paid'){
        clearInterval(returnPoll);returnPoll=null;
        const url=new URL(location.href);url.searchParams.set('payment','success');history.replaceState(null,'',url);
        await load();
      }
    }catch{}
  },2000);
}

function planCard(plan,subscription){
  const current=plan.code===subscription.plan_code;
  const starter=plan.code==='starter';
  return `<article class="planCard ${current?'current':''}">
    <div class="planCardTop"><span class="planLabel">${current?'当前套餐':'可选套餐'}</span>${current?'<span class="planCurrentMark" aria-label="当前套餐">✓</span>':''}</div>
    <h3>${BE(plan.name)}</h3>
    <div class="planPrice"><strong>${money(plan.monthly_price_cents,plan.currency)}</strong><span>/ 月</span></div>
    <p>${BE(plan.description||'')}</p>
    <ul>${(plan.features||[]).map(feature=>`<li>${BE(feature)}</li>`).join('')}</ul>
    <div class="planCardFoot"><small>付款周期可在下一步选择</small>${current&&starter?'<button disabled>当前套餐</button>':`<button data-plan="${BE(plan.code)}" data-type="${current?'renewal':starter?'purchase':'upgrade'}">${current?'续费当前套餐':'选择套餐'}</button>`}</div>
  </article>`;
}

function invoiceCard(invoice){
  const payable=['pending','overdue'].includes(invoice.status)&&Number(invoice.amount_cents)>0;
  const cycle=cycleName[invoice.billing_cycle]||`${Number(invoice.period_months||1)} 个月`;
  return `<article class="invoiceCard">
    <div class="invoiceMain"><div class="invoiceTitle"><b>${BE(invoice.invoice_number)}</b><span class="productStatus">${BE(statusName[invoice.status]||invoice.status)}</span></div><div class="invoiceMeta"><span>${BE(invoice.plan_name)}</span><span>${BE(typeName[invoice.invoice_type]||invoice.invoice_type)}</span><span>${BE(cycle)}</span><span>开具 ${fmtDate(invoice.created_at)}</span>${invoice.status==='paid'&&invoice.paid_at?`<span>支付 ${fmtDate(invoice.paid_at)}</span>`:invoice.due_at?`<span>支付期限 ${fmtDate(invoice.due_at)}</span>`:''}</div></div>
    <strong class="invoiceAmount">${money(invoice.amount_cents,invoice.currency)}</strong>
    <div class="invoiceActions">${payable?`<button class="primary" data-pay-invoice="${Number(invoice.id)}">立即支付</button>`:''}<button data-download-invoice="${Number(invoice.id)}" data-invoice-number="${BE(invoice.invoice_number)}">下载账单</button></div>
  </article>`;
}

function wire(subscription){
  if(BQ('#billingCancellation'))BQ('#billingCancellation').onclick=()=>toggleCancellation(!subscription.cancel_at_period_end);
  BQA('[data-plan]').forEach(button=>button.onclick=()=>requestInvoice(button.dataset.plan,button.dataset.type));
  BQA('[data-pay-invoice]').forEach(button=>button.onclick=()=>choosePayment(Number(button.dataset.payInvoice)));
  BQA('[data-download-invoice]').forEach(button=>button.onclick=()=>downloadPDF(Number(button.dataset.downloadInvoice),button.dataset.invoiceNumber));
}

function cycleChooser(plan){
  return `<fieldset class="billingCycleChooser"><legend>选择付款周期</legend>${billingCycles.map(cycle=>`<label><input type="radio" name="billing_cycle" value="${BE(cycle.id)}" ${cycle.id==='monthly'?'checked':''}><span><span class="billingCycleMeta"><b>${BE(cycle.label)}</b><small>${cycle.months} 个月</small></span><strong>${money(Number(plan.monthly_price_cents||0)*cycle.months,plan.currency)}</strong></span></label>`).join('')}</fieldset><div class="billingCycleTotal" data-cycle-total><span><small>本次应付</small><b data-cycle-summary>月付 · 1 个月</b></span><strong>${money(plan.monthly_price_cents,plan.currency)}</strong></div>`;
}

async function requestInvoice(planCode,type){
  const plan=(billingData?.plans||[]).find(item=>item.code===planCode);
  if(!plan){return}
  const title=type==='renewal'?`续费 ${plan.name}`:`选择 ${plan.name}`;
  const dialog=modal(title,`<form id="invoiceRequestForm"><p>选择本次订阅周期，我们会在付款前显示应付总额。</p>${cycleChooser(plan)}<div data-error></div><div class="productModalFoot"><button type="button" data-cancel>取消</button><button class="primary">继续支付</button></div></form>`);
  dialog.layer.querySelector('[data-cancel]').onclick=dialog.close;
  dialog.layer.querySelectorAll('input[name="billing_cycle"]').forEach(input=>input.addEventListener('change',()=>{
    const cycle=billingCycles.find(item=>item.id===input.value)||billingCycles[0];
    const amount=dialog.layer.querySelector('[data-cycle-total] strong');
    const summary=dialog.layer.querySelector('[data-cycle-summary]');
    if(amount)amount.textContent=money(Number(plan.monthly_price_cents||0)*cycle.months,plan.currency);
    if(summary)summary.textContent=`${cycle.label} · ${cycle.months} 个月`;
  }));
  dialog.layer.querySelector('form').onsubmit=async event=>{
    event.preventDefault();
    const submit=event.currentTarget.querySelector('button.primary');
    const cycle=event.currentTarget.querySelector('input[name="billing_cycle"]:checked')?.value||'monthly';
    submit.disabled=true;
    submit.textContent='正在创建账单…';
    try{
      const invoice=await api(`/api/workspaces/${state.workspace}/billing/invoices`,{method:'POST',body:JSON.stringify({plan_code:planCode,type,billing_cycle:cycle})});
      dialog.close();
      if(Number(invoice.amount_cents||0)<=0){await load();return}
      await choosePayment(Number(invoice.id));
    }catch(error){
      submit.disabled=false;
      submit.textContent='继续支付';
      dialog.layer.querySelector('[data-error]').innerHTML=`<div class="productError">${BE(error.message)}</div>`;
    }
  };
}

async function choosePayment(invoiceID){
  const dialog=modal('选择支付方式','<div id="paymentMethods" class="productLoading">正在读取可用支付方式…</div>');
  const originalClose=dialog.close;
  const closeAndRefresh=()=>{originalClose();load()};
  dialog.layer.querySelector('[data-close]').onclick=closeAndRefresh;
  try{
    const methods=(await api(`/api/workspaces/${state.workspace}/billing/payment-methods`)).data||[];
    const host=dialog.layer.querySelector('#paymentMethods');
    host.innerHTML=methods.length
      ?`<div class="paymentMethodList">${methods.map(method=>`<button data-provider="${BE(method.code)}"><span class="paymentMark">${paymentMark(method.code)}</span><span><b>${BE(method.name||providerName[method.code])}</b><small>${method.mode==='qr'?'扫码完成付款':'进入付款页面完成支付'}</small></span><i>›</i></button>`).join('')}</div>`
      :'<div class="billingEmpty"><b>当前没有可用的在线支付方式。</b><p>账单已经保留，可以稍后从账单记录继续支付，或提交工单联系管理员。</p></div>';
    host.querySelectorAll('[data-provider]').forEach(button=>button.onclick=()=>startPayment(invoiceID,button.dataset.provider,dialog));
  }catch(error){dialog.layer.querySelector('#paymentMethods').innerHTML=`<div class="productError">${BE(error.message)}</div>`}
}

function paymentMark(code){return({alipay:'支',wechat:'微',epay:'易',paypal:'P',stripe:'S'})[code]||'付'}

async function startPayment(invoiceID,provider,dialog){
  const host=dialog.layer.querySelector('#paymentMethods');
  host.innerHTML='<div class="productLoading">正在创建支付订单…</div>';
  try{
    const checkout=await api(`/api/workspaces/${state.workspace}/billing/invoices/${invoiceID}/pay`,{method:'POST',body:JSON.stringify({provider})});
    if(checkout.mode==='qr'&&checkout.transaction_id){
      host.innerHTML=`<div class="qrPayment"><h3>${BE(checkout.provider_name||providerName[provider])}</h3><p>请使用对应应用扫描二维码完成付款。</p><div class="paymentQR"><span>正在生成二维码…</span></div><b>等待支付确认</b><small>付款完成后本页会自动更新账单和套餐状态。</small></div>`;
      await loadPaymentQR(checkout.transaction_id,host.querySelector('.paymentQR'));
      beginPaymentPoll(invoiceID,dialog);
    }else if(checkout.redirect_url){location.assign(checkout.redirect_url)}
    else throw new Error('支付渠道没有返回可用的付款入口');
  }catch(error){host.innerHTML=`<div class="productError">${BE(error.message)}</div>`}
}

async function loadPaymentQR(transactionID,host){
  const response=await fetch(`/api/workspaces/${state.workspace}/billing/payments/${transactionID}/qr.png`,{headers:{Authorization:`Bearer ${state.token}`},cache:'no-store'});
  if(!response.ok)throw new Error((await response.json().catch(()=>({}))).error||'无法加载支付二维码');
  const blob=await response.blob();
  const objectURL=URL.createObjectURL(blob);
  const image=new Image();image.alt='支付二维码';image.onload=()=>URL.revokeObjectURL(objectURL);image.src=objectURL;host.innerHTML='';host.appendChild(image);
}

function beginPaymentPoll(invoiceID,dialog){
  clearInterval(paymentPoll);
  let count=0;
  paymentPoll=setInterval(async()=>{
    if(++count>60){clearInterval(paymentPoll);paymentPoll=null;return}
    try{
      const fresh=await api(`/api/workspaces/${state.workspace}/billing`);
      const invoice=(fresh.invoices||[]).find(item=>Number(item.id)===Number(invoiceID));
      if(invoice?.status==='paid'){
        clearInterval(paymentPoll);paymentPoll=null;dialog.close();await load();
      }
    }catch{}
  },3000);
}

async function downloadPDF(invoiceID,number){
  const dialog=modal('正在准备账单','<div id="invoiceDownloadState" class="productLoading">正在生成 PDF，请稍候…</div>');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),90000);
  try{
    const response=await fetch(`/api/workspaces/${state.workspace}/billing/invoices/${invoiceID}/pdf`,{headers:{Authorization:`Bearer ${state.token}`,'Cache-Control':'no-cache'},cache:'no-store',signal:controller.signal});
    if(!response.ok){let message='';try{message=(await response.json()).error||''}catch{}throw new Error(message||`账单下载失败（HTTP ${response.status}）`)}
    const contentType=String(response.headers.get('Content-Type')||'').toLowerCase();
    if(!contentType.includes('application/pdf'))throw new Error('服务器返回的不是 PDF 文件，请刷新后重试。');
    const blob=await response.blob();
    if(blob.size<1000)throw new Error('生成的账单文件不完整，请稍后重试。');
    const objectURL=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    const safeNumber=String(number||'Document').replace(/[^a-z0-9]/gi,'');
    anchor.href=objectURL;anchor.download=`GoJetInvoice${safeNumber}.pdf`;document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(objectURL),5000);dialog.close();
  }catch(error){showDownloadError(dialog,error?.name==='AbortError'?'账单生成超过 90 秒，请稍后重试。':error?.message||'账单下载连接中断，请稍后重试。')}finally{clearTimeout(timeout)}
}

function showDownloadError(dialog,message){
  const host=dialog.layer.querySelector('#invoiceDownloadState');
  host.className='productError';
  host.innerHTML=`<b>无法下载账单</b><p>${BE(message)}</p>`;
}

async function toggleCancellation(cancel){
  const dialog=modal(cancel?'到期后取消':'继续订阅',`<form><p>${cancel?'当前周期结束前仍可继续使用，周期结束后不再续订。':'恢复后会保留当前订阅，并可继续正常续费。'}</p><div data-error></div><div class="productModalFoot"><button type="button" data-cancel>取消</button><button class="primary">确认</button></div></form>`);
  dialog.layer.querySelector('[data-cancel]').onclick=dialog.close;
  dialog.layer.querySelector('form').onsubmit=async event=>{event.preventDefault();try{await api(`/api/workspaces/${state.workspace}/billing/cancellation`,{method:'PATCH',body:JSON.stringify({cancel})});dialog.close();await load()}catch(error){dialog.layer.querySelector('[data-error]').innerHTML=`<div class="productError">${BE(error.message)}</div>`}};
}

window.GoJetPages=window.GoJetPages||{};
window.GoJetPages.billing=render;
})();