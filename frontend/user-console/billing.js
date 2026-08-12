(()=>{
'use strict';

const BQ=s=>document.querySelector(s);
const BQA=s=>[...document.querySelectorAll(s)];
const BE=v=>escapeHTML(v??'');
let billingData=null;
let paymentPoll=null;

const statusName={active:'使用中',past_due:'待处理',cancelled:'已取消',pending:'待支付',paid:'已支付',void:'已作废',overdue:'已逾期'};
const typeName={purchase:'购买套餐',upgrade:'变更套餐',renewal:'续费'};
const providerName={alipay:'支付宝',wechat:'微信支付',epay:'易支付',paypal:'PayPal',stripe:'Stripe'};

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
  layer.innerHTML=`<div class="productModal billingDialog"><div class="productModalHead"><h2>${BE(title)}</h2><button type="button" data-close>×</button></div><div class="billingDialogBody">${body}</div></div>`;
  document.body.appendChild(layer);
  const close=()=>{clearInterval(paymentPoll);paymentPoll=null;layer.remove()};
  layer.querySelector('[data-close]').onclick=close;
  return{layer,close};
}

async function render(){
  clearInterval(paymentPoll);
  const content=BQ('.content');
  content.innerHTML=`<div class="productPageHead"><div><h1>套餐与账单</h1><p>查看当前套餐、用量和账单；在线支付成功后会自动更新套餐状态。</p></div><button id="billingRefresh">刷新</button></div><div id="billingWorkspace" class="productLoading">正在加载账单…</div>`;
  BQ('#billingRefresh').onclick=render;
  await load();
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
      <section class="billingSection"><div class="billingSectionHead"><div><h2>选择套餐</h2><p>选择套餐后会直接进入支付步骤，付款确认后自动生效。</p></div></div><div class="planGrid billingPlans">${plans.map(plan=>planCard(plan,subscription)).join('')}</div></section>
      <section class="billingSection"><div class="billingSectionHead"><div><h2>账单记录</h2><p>账单状态以支付渠道通知和系统记录为准。</p></div></div>${invoices.length?`<div class="billingInvoiceList">${invoices.map(invoiceCard).join('')}</div>`:'<div class="billingEmpty">还没有账单。</div>'}</section>`;
    wire(subscription);
  }catch(error){
    host.innerHTML=`<div class="productError">${BE(error.message)}</div>`;
  }
}

function paymentNotice(){
  const result=new URLSearchParams(location.search).get('payment');
  if(result==='success'||result==='return')return '<div class="productSuccess billingNotice">付款页面已经返回，系统正在等待支付渠道确认。账单确认后套餐会自动生效。</div>';
  if(result==='cancelled')return '<div class="notice billingNotice">本次付款已取消，账单仍然保留，可以稍后重新支付。</div>';
  if(result==='failed')return '<div class="productError billingNotice">付款结果未能确认。请不要重复付款，先刷新账单状态；如已扣款但状态未更新，请提交工单。</div>';
  return'';
}

function planCard(plan,subscription){
  const current=plan.code===subscription.plan_code;
  const starter=plan.code==='starter';
  return `<article class="planCard ${current?'current':''}">
    <small>${current?'当前套餐':'可选套餐'}</small>
    <h3>${BE(plan.name)}</h3>
    <strong>${money(plan.monthly_price_cents,plan.currency)}<i>/月</i></strong>
    <p>${BE(plan.description||'')}</p>
    <ul>${(plan.features||[]).map(feature=>`<li>${BE(feature)}</li>`).join('')}</ul>
    ${current&&starter?'<button disabled>当前套餐</button>':`<button data-plan="${BE(plan.code)}" data-type="${current?'renewal':starter?'purchase':'upgrade'}">${current?'续费':'选择套餐'}</button>`}
  </article>`;
}

function invoiceCard(invoice){
  const payable=['pending','overdue'].includes(invoice.status)&&Number(invoice.amount_cents)>0;
  return `<article class="invoiceCard">
    <div class="invoiceMain"><div class="invoiceTitle"><b>${BE(invoice.invoice_number)}</b><span class="productStatus">${BE(statusName[invoice.status]||invoice.status)}</span></div><div class="invoiceMeta"><span>${BE(invoice.plan_name)}</span><span>${BE(typeName[invoice.invoice_type]||invoice.invoice_type)}</span><span>开具于 ${fmtDate(invoice.created_at)}</span>${invoice.due_at?`<span>支付期限 ${fmtDate(invoice.due_at)}</span>`:''}</div></div>
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

async function requestInvoice(planCode,type){
  const title=type==='renewal'?'确认续费':'确认选择套餐';
  const dialog=modal(title,`<form id="invoiceRequestForm"><p>下一步将创建账单并直接选择支付方式。付款确认后套餐自动生效，不需要再次返回账单页操作。</p><div data-error></div><div class="productModalFoot"><button type="button" data-cancel>取消</button><button class="primary">继续支付</button></div></form>`);
  dialog.layer.querySelector('[data-cancel]').onclick=dialog.close;
  dialog.layer.querySelector('form').onsubmit=async event=>{
    event.preventDefault();
    const submit=event.currentTarget.querySelector('button.primary');
    submit.disabled=true;
    submit.textContent='正在创建账单…';
    try{
      const invoice=await api(`/api/workspaces/${state.workspace}/billing/invoices`,{method:'POST',body:JSON.stringify({plan_code:planCode,type})});
      dialog.close();
      if(Number(invoice.amount_cents||0)<=0){
        await load();
        return;
      }
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
  }catch(error){
    dialog.layer.querySelector('#paymentMethods').innerHTML=`<div class="productError">${BE(error.message)}</div>`;
  }
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
    }else if(checkout.redirect_url){
      location.assign(checkout.redirect_url);
    }else{
      throw new Error('支付渠道没有返回可用的付款入口');
    }
  }catch(error){
    host.innerHTML=`<div class="productError">${BE(error.message)}</div>`;
  }
}

async function loadPaymentQR(transactionID,host){
  const response=await fetch(`/api/workspaces/${state.workspace}/billing/payments/${transactionID}/qr.png`,{headers:{Authorization:`Bearer ${state.token}`},cache:'no-store'});
  if(!response.ok)throw new Error((await response.json().catch(()=>({}))).error||'无法加载支付二维码');
  const blob=await response.blob();
  const objectURL=URL.createObjectURL(blob);
  const image=new Image();
  image.alt='支付二维码';
  image.onload=()=>URL.revokeObjectURL(objectURL);
  image.src=objectURL;
  host.innerHTML='';
  host.appendChild(image);
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
        clearInterval(paymentPoll);
        paymentPoll=null;
        dialog.close();
        await load();
      }
    }catch{}
  },3000);
}

function downloadPDF(invoiceID,number){
  const dialog=modal('正在准备账单','<div id="invoiceDownloadState" class="productLoading">正在生成 PDF…</div>');
  const xhr=new XMLHttpRequest();
  xhr.open('GET',`/api/workspaces/${state.workspace}/billing/invoices/${invoiceID}/pdf`);
  xhr.responseType='blob';
  xhr.timeout=30000;
  xhr.setRequestHeader('Authorization',`Bearer ${state.token}`);
  xhr.setRequestHeader('Cache-Control','no-cache');
  xhr.onload=()=>{
    if(xhr.status<200||xhr.status>=300){
      readBlobError(xhr.response).then(message=>showDownloadError(dialog,message||`账单下载失败（HTTP ${xhr.status}）`));
      return;
    }
    const contentType=String(xhr.getResponseHeader('Content-Type')||'').toLowerCase();
    if(!contentType.includes('application/pdf')){
      showDownloadError(dialog,'服务器返回的不是 PDF 文件，请刷新后重试。');
      return;
    }
    const objectURL=URL.createObjectURL(xhr.response);
    const anchor=document.createElement('a');
    anchor.href=objectURL;
    anchor.download=`GoJet-${number||'账单'}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(objectURL),3000);
    dialog.close();
  };
  xhr.onerror=()=>showDownloadError(dialog,'账单下载连接中断。请刷新页面后重试；如果仍然失败，请提交工单并附上账单号。');
  xhr.ontimeout=()=>showDownloadError(dialog,'账单生成超时。请稍后重试。');
  xhr.send();
}

async function readBlobError(blob){
  try{const text=await blob.text();const data=JSON.parse(text);return data.error||''}catch{return''}
}
function showDownloadError(dialog,message){
  const host=dialog.layer.querySelector('#invoiceDownloadState');
  host.className='productError';
  host.innerHTML=`<b>无法下载账单</b><p>${BE(message)}</p>`;
}

async function toggleCancellation(cancel){
  const dialog=modal(cancel?'到期后取消':'继续订阅',`<form><p>${cancel?'当前周期结束前仍可继续使用，周期结束后不再续订。':'恢复后会保留当前订阅，并可继续正常续费。'}</p><div data-error></div><div class="productModalFoot"><button type="button" data-cancel>取消</button><button class="primary">确认</button></div></form>`);
  dialog.layer.querySelector('[data-cancel]').onclick=dialog.close;
  dialog.layer.querySelector('form').onsubmit=async event=>{
    event.preventDefault();
    try{
      await api(`/api/workspaces/${state.workspace}/billing/cancellation`,{method:'PATCH',body:JSON.stringify({cancel})});
      dialog.close();
      await load();
    }catch(error){
      dialog.layer.querySelector('[data-error]').innerHTML=`<div class="productError">${BE(error.message)}</div>`;
    }
  };
}

window.GoJetPages=window.GoJetPages||{};
window.GoJetPages.billing=render;
})();
