(()=>{
'use strict';

const providerMeta={
  alipay:{label:'支付宝',note:'支付宝开放平台'},
  wechat:{label:'微信支付',note:'微信支付商户平台'},
  epay:{label:'易支付',note:'第三方聚合支付'},
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
    const head=section.querySelector('.paymentProviderHead');
    if(head){
      const heading=head.querySelector('h3,b,strong'),description=head.querySelector('p,small');
      if(heading)heading.textContent=meta.label;
      if(description)description.textContent=meta.note;
    }

    const displayKey=`payments.${key}.display_name`;
    const displayName=String(saved[displayKey]||meta.label).trim()||meta.label;
    const field=document.createElement('label');
    field.className='paymentDisplayName full';
    const title=document.createElement('span');title.textContent='前台名称';
    const input=document.createElement('input');
    input.name=displayKey;input.type='text';input.maxLength=60;input.value=displayName;input.placeholder=meta.label;input.setAttribute('aria-label',`${meta.label}前台名称`);
    const help=document.createElement('small');help.className='settingHelp';help.textContent='用户付款时看到的渠道名称。';
    field.append(title,input,help);
    head?.after(field);
    entries.push({key,meta,section,enabled,input});
  }
  if(!entries.length){delete form.dataset.paymentUxLoading;return}

  const chooser=document.createElement('section');
  chooser.className='paymentMethodChooser full';
  chooser.innerHTML=`
    <div class="paymentMethodChooserCopy">
      <span class="paymentEyebrow">收款渠道</span>
      <h3>选择启用的支付方式</h3>
      <p>可以同时启用多个渠道。下面只展示已启用渠道的参数配置。</p>
    </div>
    <details class="paymentMultiSelect">
      <summary>
        <span class="paymentSummaryCopy"><small>当前渠道</small><strong data-payment-summary>选择支付方式</strong></span>
        <i class="paymentSummaryArrow" aria-hidden="true"></i>
      </summary>
      <div class="paymentMultiSelectMenu" role="group" aria-label="选择支付方式"></div>
    </details>`;
  providers.before(chooser);

  const menu=chooser.querySelector('.paymentMultiSelectMenu');
  entries.forEach(({key,meta,enabled,input})=>{
    const label=document.createElement('label');label.dataset.paymentOption=key;
    const choice=document.createElement('input');choice.type='checkbox';choice.dataset.paymentChoice=key;choice.checked=enabled.checked;
    const copy=document.createElement('span');copy.className='paymentChoiceCopy';
    const name=document.createElement('b'),note=document.createElement('small'),state=document.createElement('i');state.className='paymentChoiceState';
    name.textContent=input.value||meta.label;note.textContent=meta.note;state.setAttribute('aria-hidden','true');
    copy.append(name,note);label.append(choice,copy,state);menu.append(label);
    input.addEventListener('input',()=>{name.textContent=input.value.trim()||meta.label;refresh()});
  });

  const summary=chooser.querySelector('[data-payment-summary]');
  const details=chooser.querySelector('.paymentMultiSelect');
  const refresh=()=>{
    const active=[];
    for(const entry of entries){
      const visible=entry.enabled.checked;
      entry.section.classList.toggle('paymentProviderHidden',!visible);
      const choice=chooser.querySelector(`[data-payment-choice="${entry.key}"]`);
      const option=chooser.querySelector(`[data-payment-option="${entry.key}"]`);
      if(choice&&choice.checked!==visible)choice.checked=visible;
      option?.classList.toggle('selected',visible);
      if(visible)active.push(entry);
    }
    if(!active.length)summary.textContent='尚未选择支付方式';
    else if(active.length===1)summary.textContent=active[0].input.value.trim()||active[0].meta.label;
    else summary.textContent=`${active[0].input.value.trim()||active[0].meta.label} 等 ${active.length} 个渠道`;
    providers.classList.toggle('paymentProvidersEmpty',active.length===0);
  };

  chooser.querySelectorAll('[data-payment-choice]').forEach(choice=>{
    choice.addEventListener('change',()=>{
      const entry=entries.find(item=>item.key===choice.dataset.paymentChoice);
      if(entry)entry.enabled.checked=choice.checked;
      refresh();
    });
  });
  menu.addEventListener('click',event=>event.stopPropagation());
  details.addEventListener('toggle',()=>details.classList.toggle('isOpen',details.open));

  form.dataset.paymentUxReady='1';
  delete form.dataset.paymentUxLoading;
  refresh();
}

const observer=new MutationObserver(schedule);
observer.observe(document.documentElement,{subtree:true,childList:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();