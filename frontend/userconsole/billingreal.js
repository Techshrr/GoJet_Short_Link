(()=>{
'use strict';
const improve=()=>{
  document.querySelectorAll('#invoiceRequestForm').forEach(form=>{
    if(form.dataset.realAcceptance==='1')return;
    form.dataset.realAcceptance='1';
    const intro=form.querySelector(':scope > p');
    if(intro)intro.textContent='选择适合你的付款周期。费用会按当前套餐月价自动计算，支付成功后相应延长服务期限。';
    const legend=form.querySelector('.billingCycleChooser legend');
    if(legend)legend.textContent='选择付款周期';
  });
};
const observer=new MutationObserver(improve);observer.observe(document.body,{childList:true,subtree:true});improve();
})();