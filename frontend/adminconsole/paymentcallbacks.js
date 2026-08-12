'use strict';

const renderBillingBase=renderBilling;
renderBilling=async function(){
  await renderBillingBase();
  let callbacks=[];
  let error='';
  try{
    const result=await api('/api/admin/payment-callbacks?limit=100');
    callbacks=result.data||[];
  }catch(reason){
    error=reason.message||'支付回调记录暂时不可用';
  }

  const rows=callbacks.map(item=>`<tr>
    <td>${dt(item.created_at)}</td>
    <td><b>${esc(String(item.provider||'').toUpperCase())}</b></td>
    <td>${item.outcome==='accepted'?'<span class="status active">已接受</span>':'<span class="status suspended">已拒绝</span>'}</td>
    <td>${Number(item.response_status||0)}</td>
    <td>${esc(item.merchant_order_no||'—')}</td>
    <td>${esc(item.provider_reference||'—')}</td>
    <td>${item.transaction_id?`#${Number(item.transaction_id)}`:'—'}</td>
    <td>${item.invoice_id?`#${Number(item.invoice_id)}`:'—'}</td>
    <td><small>${esc(item.request_id||'—')}</small></td>
    <td>${esc(item.remote_ip||'—')}</td>
  </tr>`).join('');

  const title='<div class="page-head"><div><h2>最近支付回调</h2><p>记录支付渠道实际进入 GoJet 的通知结果。仅保存摘要、关联编号和载荷 SHA256，不保存支付密钥或原始回调正文。</p></div></div>';
  const content=error
    ?`<div class="panel"><div class="alert">${esc(error)}</div></div>`
    :panelTable(['时间','渠道','验证结果','HTTP','商户订单','渠道引用','交易','账单','Request ID','来源 IP'],rows,'暂无支付回调');
  $('#content').insertAdjacentHTML('beforeend',title+content);
};
