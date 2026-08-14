(()=>{
'use strict';

const providerMeta={
  alipay:{label:'支付宝',note:'支付宝开放平台'},
  wechat:{label:'微信支付',note:'微信支付商户平台'},
  epay:{label:'易支付',note:'第三方聚合支付接口'},
  paypal:{label:'PayPal',note:'PayPal Checkout'},
  stripe:{label:'Stripe',note:'Stripe Checkout'}
};

let scheduled=false;
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;void enhancePaymentPane()});
}

async function enhancePaymentPane(){
  const form=document.querySelector('form[data-section="payments"]');
  if(!form||form.dataset.paymentUxReady==='1'||form.dataset.paymentUxLoading==='1')return;
  const providers=form.querySelector('.paymentProviders');
  if(!providers)return;
  const sections=[...providers.querySelectorAll('.paymentProvider')];
  if(!sections.length)return;
  form.dataset.paymentUxLoading='1';

  let saved={};
  try{saved=(await api('/api/admin/settings'))?.payments||{}}catch{}

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

    const displayKey=`payments.${key}.display_name`;
    const displayName=String(saved[displayKey]||meta.label).trim()||meta.label;
    const field=document.createElement('label');
    field.className='paymentDisplayName full';
    const title=document.createElement('span');title.textContent='客户区显示名称';
    const input=document.createElement('input');
    input.name=displayKey;input.type='text';input.maxLength=60;input.value=displayName;input.placeholder=meta.label;
    const help=document.createElement('small');help.className='settingHelp';help.textContent='仅改变客户付款页面看到的名称，不影响支付接口类型与回调地址。';
    field.append(title,input,help);
    section.querySelector('.paymentProviderHead')?.after(field);
    entries.push({key,meta,section,enabled,input});
  }
  if(!entries.length){delete form.dataset.paymentUxLoading;return}

  const chooser=document.createElement('section');
  chooser.className='paymentMethodChooser full';
  chooser.innerHTML=`
    <div class="paymentMethodChooserCopy">
      <span class="paymentEyebrow">收款渠道</span>
      <h3>选择需要启用的支付方式</h3>
      <p>可同时启用多个渠道。下方只显示已选择渠道的配置。</p>
    </div>
    <details class="paymentMultiSelect">
      <summary><span data-payment-summary>选择支付方式</span><b aria-hidden="true">⌄</b></summary>
      <div class="paymentMultiSelectMenu"></div>
    </details>
    <div class="paymentSelectedChips" data-payment-chips></div>`;
  providers.before(chooser);

  const menu=chooser.querySelector('.paymentMultiSelectMenu');
  entries.forEach(({key,meta,enabled,input})=>{
    const label=document.createElement('label');
    const choice=document.createElement('input');choice.type='checkbox';choice.dataset.paymentChoice=key;choice.checked=enabled.checked;
    const copy=document.createElement('span'),name=document.createElement('b'),note=document.createElement('small'),check=document.createElement('i');
    name.textContent=input.value||meta.label;note.textContent=meta.note;check.textContent='✓';check.setAttribute('aria-hidden','true');
    copy.append(name,note);label.append(choice,copy,check);menu.append(label);
    input.addEventListener('input',()=>{name.textContent=input.value.trim()||meta.label;refresh()});
  });

  const summary=chooser.querySelector('[data-payment-summary]');
  const chips=chooser.querySelector('[data-payment-chips]');
  const defaultSelect=form.querySelector('select[name="payments.default_provider"]');
  if(defaultSelect){[...defaultSelect.options].forEach(option=>{const entry=entries.find(item=>item.key===option.value);if(entry)option.textContent=entry.meta.label})}

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
    chips.innerHTML='';
    if(active.length){active.forEach(entry=>{const chip=document.createElement('span');chip.textContent=entry.input.value.trim()||entry.meta.label;chips.append(chip)})}
    else{const none=document.createElement('span');none.className='paymentNone';none.textContent='尚未选择支付方式';chips.append(none)}
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
  delete form.dataset.paymentUxLoading;
  refresh();
}

const observer=new MutationObserver(schedule);
observer.observe(document.documentElement,{subtree:true,childList:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();