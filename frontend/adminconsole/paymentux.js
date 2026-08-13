(()=>{
'use strict';

const providerMeta={
  alipay:{label:'支付宝',note:'支付宝开放平台'},
  wechat:{label:'微信支付',note:'微信支付商户平台'},
  epay:{label:'易支付',note:'易支付兼容协议'},
  paypal:{label:'PayPal',note:'PayPal Checkout'},
  stripe:{label:'Stripe',note:'Stripe Checkout'}
};

let scheduled=false;
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;enhancePaymentPane()});
}

function enhancePaymentPane(){
  const form=document.querySelector('form[data-section="payments"]');
  if(!form||form.dataset.paymentUxReady==='1')return;
  const providers=form.querySelector('.paymentProviders');
  if(!providers)return;
  const sections=[...providers.querySelectorAll('.paymentProvider')];
  if(!sections.length)return;

  const entries=[];
  for(const section of sections){
    const enabled=section.querySelector('input[name^="payments."][name$=".enabled"]');
    if(!enabled)continue;
    const match=enabled.name.match(/^payments\.([^.]+)\.enabled$/);
    if(!match)continue;
    const key=match[1],meta=providerMeta[key]||{label:key,note:'支付渠道'};
    const originalSwitch=enabled.closest('.ah-switch,.check,label');
    if(originalSwitch)originalSwitch.classList.add('paymentProviderLegacySwitch');
    section.dataset.paymentProvider=key;
    entries.push({key,meta,section,enabled});
  }
  if(!entries.length)return;

  const chooser=document.createElement('section');
  chooser.className='paymentMethodChooser full';
  chooser.innerHTML=`
    <div class="paymentMethodChooserCopy">
      <span class="paymentEyebrow">收款渠道</span>
      <h3>选择需要启用的支付方式</h3>
      <p>可同时启用多个渠道。下方只显示已选择渠道的配置项。</p>
    </div>
    <details class="paymentMultiSelect">
      <summary><span data-payment-summary>选择支付方式</span><b aria-hidden="true">⌄</b></summary>
      <div class="paymentMultiSelectMenu">
        ${entries.map(({key,meta,enabled})=>`<label><input type="checkbox" data-payment-choice="${key}" ${enabled.checked?'checked':''}><span><b>${meta.label}</b><small>${meta.note}</small></span><i aria-hidden="true">✓</i></label>`).join('')}
      </div>
    </details>
    <div class="paymentSelectedChips" data-payment-chips></div>`;
  providers.before(chooser);

  const summary=chooser.querySelector('[data-payment-summary]');
  const chips=chooser.querySelector('[data-payment-chips]');
  const defaultSelect=form.querySelector('select[name="payments.default_provider"]');

  const refresh=()=>{
    const active=[];
    for(const entry of entries){
      const visible=entry.enabled.checked;
      entry.section.classList.toggle('paymentProviderHidden',!visible);
      const choice=chooser.querySelector(`[data-payment-choice="${entry.key}"]`);
      if(choice&&choice.checked!==visible)choice.checked=visible;
      if(visible)active.push(entry);
    }
    summary.textContent=active.length?`已选择 ${active.length} 个支付方式`:'选择支付方式';
    chips.innerHTML=active.length?active.map(({meta})=>`<span>${meta.label}</span>`).join(''):'<span class="paymentNone">尚未选择支付方式</span>';
    if(defaultSelect){
      [...defaultSelect.options].forEach(option=>{option.disabled=!active.some(item=>item.key===option.value)});
      if(active.length&&!active.some(item=>item.key===defaultSelect.value))defaultSelect.value=active[0].key;
      defaultSelect.disabled=active.length===0;
    }
    providers.classList.toggle('paymentProvidersEmpty',active.length===0);
  };

  chooser.querySelectorAll('[data-payment-choice]').forEach(choice=>{
    choice.addEventListener('change',()=>{
      const entry=entries.find(item=>item.key===choice.dataset.paymentChoice);
      if(entry)entry.enabled.checked=choice.checked;
      refresh();
    });
  });

  form.dataset.paymentUxReady='1';
  refresh();
}

const observer=new MutationObserver(schedule);
observer.observe(document.documentElement,{subtree:true,childList:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();