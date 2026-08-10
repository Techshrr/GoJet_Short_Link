(()=>{
const previousRenderSettings=renderSettings;
const escFX=v=>esc(v??'');
function manualRatesToLines(raw){
  if(!raw)return'';
  try{const obj=typeof raw==='string'?JSON.parse(raw):raw;return Object.entries(obj||{}).map(([pair,rate])=>`${pair}=${rate}`).join('\n')}catch{return''}
}
function linesToManualRates(text){
  const out={};
  for(const raw of String(text||'').split(/\r?\n/)){
    const line=raw.trim();if(!line)continue;
    const pos=line.indexOf('=');if(pos<1)throw new Error('手动汇率请按“USD/CNY=7.250000”格式逐行填写');
    const pair=line.slice(0,pos).trim().toUpperCase(),rate=line.slice(pos+1).trim();
    if(!/^[A-Z]{3}\/[A-Z]{3}$/.test(pair)||!/^\d+(?:\.\d{1,12})?$/.test(rate)||Number(rate)<=0)throw new Error(`手动汇率格式无效：${line}`);
    out[pair]=rate;
  }
  return JSON.stringify(out);
}
renderSettings=async function(){
  await previousRenderSettings();
  const all=await api('/api/admin/settings'),billing=all.billing||{};
  const nav=document.querySelector('.ah-settings-nav'),main=document.querySelector('.ah-settings-main');
  if(!nav||!main||document.querySelector('[data-ah-tab="billing"]'))return;
  nav.insertAdjacentHTML('beforeend',`<button type="button" data-ah-tab="billing"><b>账单与汇率</b><small>结算币种与锁定汇率</small></button>`);
  const settlement=billing['billing.settlement_currency']||'';
  const provider=billing['billing.fx.provider']||'ecb';
  const markup=Number(billing['billing.fx.markup_bps']??0);
  const cache=Number(billing['billing.fx.cache_hours']??24);
  main.insertAdjacentHTML('beforeend',`<form class="ah-settings-pane hidden" data-ah-pane="billing" data-section="billing">
    <div class="ah-pane-head"><div><h2>账单与汇率</h2><p>套餐保留原始计价币种；需要换算时，账单生成即锁定结算金额和汇率，之后付款金额不会随行情变化。</p></div><button class="btn primary">保存设置</button></div>
    <div class="ah-settings-grid">
      <label><span>结算币种</span><select name="billing.settlement_currency"><option value="" ${settlement===''?'selected':''}>按套餐计价币种结算</option><option value="CNY" ${settlement==='CNY'?'selected':''}>人民币（CNY）</option><option value="USD" ${settlement==='USD'?'selected':''}>美元（USD）</option><option value="EUR" ${settlement==='EUR'?'selected':''}>欧元（EUR）</option><option value="HKD" ${settlement==='HKD'?'selected':''}>港币（HKD）</option><option value="SGD" ${settlement==='SGD'?'selected':''}>新加坡元（SGD）</option><option value="GBP" ${settlement==='GBP'?'selected':''}>英镑（GBP）</option></select><small class="settingHelp">支付宝和微信支付仅适用于人民币账单；其他渠道按各自支持币种处理。</small></label>
      <label><span>汇率来源</span><select name="billing.fx.provider"><option value="ecb" ${provider==='ecb'?'selected':''}>欧洲中央银行参考汇率</option><option value="manual" ${provider==='manual'?'selected':''}>手动汇率</option></select><small class="settingHelp">参考汇率只用于形成 GoJet 账单报价，不代表支付机构实际换汇成交价。</small></label>
      <label><span>汇率调整（基点）</span><input name="billing.fx.markup_bps" type="number" min="-1000" max="5000" value="${markup}"><small class="settingHelp">100 个基点 = 1%。正数上调结算汇率，负数下调。</small></label>
      <label><span>参考汇率缓存时间（小时）</span><input name="billing.fx.cache_hours" type="number" min="1" max="168" value="${cache}"><small class="settingHelp">账单只使用有效缓存或重新获取的参考汇率；无法获得可靠汇率时不会生成跨币种账单。</small></label>
      <label class="full"><span>手动汇率</span><textarea id="manualFxRates" rows="7" placeholder="USD/CNY=7.250000\nEUR/CNY=7.900000">${escFX(manualRatesToLines(billing['billing.fx.manual_rates']))}</textarea><small class="settingHelp">仅在汇率来源选择“手动汇率”时使用。可填写正向或反向货币对，系统会自动计算反向汇率。</small></label>
    </div><div class="ah-save-result"></div>
  </form>`);
  const tab=document.querySelector('[data-ah-tab="billing"]'),pane=document.querySelector('[data-ah-pane="billing"]');
  tab.onclick=()=>{sessionStorage.setItem('gojet_settings_tab','billing');document.querySelectorAll('[data-ah-tab]').forEach(x=>x.classList.toggle('active',x===tab));document.querySelectorAll('[data-ah-pane]').forEach(x=>x.classList.toggle('hidden',x!==pane))};
  pane.onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,result=form.querySelector('.ah-save-result');try{const data=Object.fromEntries(new FormData(form));data['billing.fx.markup_bps']=Number(data['billing.fx.markup_bps']);data['billing.fx.cache_hours']=Number(data['billing.fx.cache_hours']);data['billing.fx.manual_rates']=linesToManualRates(document.querySelector('#manualFxRates').value);await api('/api/admin/settings/billing',{method:'PUT',body:JSON.stringify(data)});result.textContent='已保存';result.className='ah-save-result ok';toast('账单与汇率设置已保存')}catch(err){result.textContent=err.message;result.className='ah-save-result bad';fail(err.message)}};
  if(sessionStorage.getItem('gojet_settings_tab')==='billing')tab.click();
};
})();
