(()=>{
'use strict';
const improve=()=>{
  const content=document.querySelector('.content');
  if(content)content.classList.toggle('billingAcceptancePage',Boolean(document.querySelector('#billingWorkspace')));
  document.querySelectorAll('#invoiceRequestForm').forEach(form=>{
    if(form.dataset.realAcceptance==='1')return;
    form.dataset.realAcceptance='1';
    const intro=form.querySelector(':scope > p');
    if(intro)intro.textContent='选择适合你的付款周期。支付前会明确显示本次应付金额与对应服务期限。';
    const legend=form.querySelector('.billingCycleChooser legend');
    if(legend)legend.textContent='选择付款周期';
  });
};
const observer=new MutationObserver(improve);observer.observe(document.body,{childList:true,subtree:true});improve();
})();
