(()=>{
const UQ=(s,r=document)=>r.querySelector(s),UQA=(s,r=document)=>[...r.querySelectorAll(s)],UE=v=>esc(v??'');
const value=(o,k,d='')=>o?.[k]??d;
const bool=(v,d=false)=>v===undefined?d:Boolean(v);
const input=(k,l,v,type='text',attrs='')=>`<label><span>${UE(l)}</span><input name="${UE(k)}" type="${type}" value="${UE(v??'')}" ${attrs}></label>`;
const secret=(k,l,configured=false,help='')=>`<label class="full"><span>${UE(l)}</span><input name="${UE(k)}" type="password" value="" autocomplete="new-password" data-sensitive="1" placeholder="${configured?'已配置，留空保持不变':'请输入密钥'}">${help?`<small class="settingHelp">${UE(help)}</small>`:''}</label>`;
const text=(k,l,v,help='')=>`<label class="full"><span>${UE(l)}</span><textarea name="${UE(k)}" rows="4" placeholder="${UE(help)}">${UE(v??'')}</textarea></label>`;
const check=(k,l,v,help='')=>`<label class="ah-switch full"><span><b>${UE(l)}</b>${help?`<small>${UE(help)}</small>`:''}</span><input name="${UE(k)}" type="checkbox" ${v?'checked':''}></label>`;
const select=(k,l,v,opts)=>`<label><span>${UE(l)}</span><select name="${UE(k)}">${opts.map(([x,t])=>`<option value="${UE(x)}" ${String(v)===String(x)?'selected':''}>${UE(t)}</option>`).join('')}</select></label>`;
const configured=(o,k)=>value(o,k,'')==='********';
function pane(id,title,desc,body){return `<form class="ah-settings-pane hidden" data-ah-pane="${id}" data-section="${id}"><div class="ah-pane-head"><div><h2>${UE(title)}</h2><p>${UE(desc)}</p></div><button class="btn primary">保存设置</button></div><div class="ah-settings-grid">${body}</div><div class="ah-save-result"></div></form>`}
function tab(id,label,desc){return `<button type="button" data-ah-tab="${id}"><b>${UE(label)}</b><small>${UE(desc)}</small></button>`}
function provider(title,desc,body){return `<section class="paymentProvider"><div class="paymentProviderHead"><h3>${UE(title)}</h3><p>${UE(desc)}</p></div><div class="ah-settings-grid">${body}</div></section>`}
const assetLabels={logo:'主标志', 'logo-dark':'深色背景标志','logo-light':'浅色背景标志','logo-square':'方形标志',favicon:'浏览器图标','apple-touch-icon':'Apple 触控图标','pwa-icon':'应用图标','share-image':'分享封面','login-image':'登录页图片','mail-logo':'邮件标志'};

renderSettings=async function(){
 const settings=await api('/api/admin/settings'),basic=settings.basic||{},seo=settings.seo||{},reg=settings.registration||{},links=settings.links||{},brand=settings.brand||{},pay=settings.payments||{};
 const basicPane=pane('basic','站点信息','用于官网、控制台、邮件与账单中的站点和企业信息。',
  input('site.name','网站名称',value(basic,'site.name','GoJet'))+input('site.short_name','网站简称',value(basic,'site.short_name','GoJet'))+
  input('site.tagline','品牌标语',value(basic,'site.tagline'))+select('site.language','默认语言',value(basic,'site.language','zh-CN'),[['zh-CN','简体中文']])+
  text('site.description','网站简介',value(basic,'site.description'))+input('site.timezone','时区',value(basic,'site.timezone','Asia/Shanghai'))+
  input('site.contact_email','联系邮箱',value(basic,'site.contact_email'),'email')+input('site.support_email','客服邮箱',value(basic,'site.support_email'),'email')+
  input('site.company_name','公司名称',value(basic,'site.company_name'))+input('site.company_address','公司地址',value(basic,'site.company_address'))+
  input('site.copyright','版权信息',value(basic,'site.copyright'))
 );
 const searchPane=pane('seo','搜索与分享','设置公开网页在搜索结果和社交分享中的标题与摘要。',
  input('seo.default_title','默认网页标题',value(seo,'seo.default_title'))+input('seo.title_template','标题格式',value(seo,'seo.title_template','%s | GoJet'))+
  text('seo.meta_description','页面摘要',value(seo,'seo.meta_description'))+input('seo.meta_keywords','搜索关键词',value(seo,'seo.meta_keywords'))+
  input('seo.canonical_url','网站规范地址',value(seo,'seo.canonical_url'),'url')+text('seo.robots','搜索抓取规则',value(seo,'seo.robots'))+
  check('seo.sitemap','生成站点地图',bool(value(seo,'seo.sitemap',true)))+text('seo.verification','站点所有权验证代码',value(seo,'seo.verification'))
 );
 const accountPane=pane('registration','注册与账户','控制公开注册、邮箱验证、密码安全和登录失败限制。',
  check('registration.enabled','允许新用户注册',bool(value(reg,'registration.enabled',true)),'关闭后注册页面会提示当前暂停注册。')+
  check('registration.require_email_verification','注册后验证邮箱',bool(value(reg,'registration.require_email_verification',false)),'邮件服务测试成功后才能开启。')+
  check('registration.forgot_password','允许找回密码',bool(value(reg,'registration.forgot_password',true)))+
  input('registration.password_min_length','最短密码长度',value(reg,'registration.password_min_length',10),'number','min="10" max="72"')+
  input('registration.login_rate_limit','登录失败次数限制',value(reg,'registration.login_rate_limit',10),'number','min="1" max="100"')+
  text('registration.blocked_domains','禁止注册的邮箱域名',value(reg,'registration.blocked_domains'),'每行填写一个域名')
 );
 const linkPane=pane('links','短链接','设置新建短链接时采用的默认规则。',
  input('links.default_domain','默认短链域名',value(links,'links.default_domain'))+
  select('links.default_redirect_status','默认跳转方式',value(links,'links.default_redirect_status',302),[[301,'永久跳转（301）'],[302,'临时跳转（302）'],[307,'临时跳转（307）'],[308,'永久跳转（308）']])+
  input('links.code_length','自动短码长度',value(links,'links.code_length',6),'number','min="3" max="32"')+
  input('links.allowed_characters','短码可用字符',value(links,'links.allowed_characters','abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'))+
  text('links.reserved_codes','保留短码',value(links,'links.reserved_codes'),'每行填写一个不可创建的短码')+
  text('links.blocked_keywords','禁止关键词',value(links,'links.blocked_keywords'),'每行填写一个关键词')+
  input('links.default_expiry_days','默认有效天数',value(links,'links.default_expiry_days',0),'number','min="0" max="3650"')+
  input('links.default_click_limit','默认访问上限',value(links,'links.default_click_limit',0),'number','min="0"')+
  check('links.force_https','目标网址必须使用 HTTPS',bool(value(links,'links.force_https',false)))
 );
 const paymentPane=pane('payments','支付方式','启用并配置可用于在线支付账单的渠道。只有配置完整并启用的渠道才会显示给用户。',
  check('payments.enabled','启用在线支付',bool(value(pay,'payments.enabled',false)),'关闭后用户仍可查看账单，但不会显示在线支付入口。')+
  select('payments.default_provider','默认支付方式',value(pay,'payments.default_provider','alipay'),[['alipay','支付宝'],['wechat','微信支付'],['epay','易支付兼容协议'],['paypal','PayPal'],['stripe','Stripe']])+
  `<div class="full paymentProviders">`+
  provider('支付宝','适用于人民币账单，使用支付宝开放平台网页支付。',
   check('payments.alipay.enabled','启用支付宝',bool(value(pay,'payments.alipay.enabled',false)))+
   input('payments.alipay.app_id','应用编号',value(pay,'payments.alipay.app_id'))+input('payments.alipay.gateway','支付网关',value(pay,'payments.alipay.gateway','https://openapi.alipay.com/gateway.do'),'url')+
   secret('payments.alipay.private_key','应用私钥',configured(pay,'payments.alipay.private_key'))+secret('payments.alipay.public_key','支付宝公钥',configured(pay,'payments.alipay.public_key')))+
  provider('微信支付','适用于人民币账单，控制台生成微信支付付款二维码。',
   check('payments.wechat.enabled','启用微信支付',bool(value(pay,'payments.wechat.enabled',false)))+
   input('payments.wechat.app_id','应用编号',value(pay,'payments.wechat.app_id'))+input('payments.wechat.mch_id','商户号',value(pay,'payments.wechat.mch_id'))+
   input('payments.wechat.mch_serial_no','商户证书序列号',value(pay,'payments.wechat.mch_serial_no'))+input('payments.wechat.platform_serial_no','平台公钥编号',value(pay,'payments.wechat.platform_serial_no'))+
   secret('payments.wechat.private_key','商户私钥',configured(pay,'payments.wechat.private_key'))+secret('payments.wechat.api_v3_key','接口安全密钥',configured(pay,'payments.wechat.api_v3_key'),'32 字节密钥')+
   secret('payments.wechat.platform_public_key','微信支付平台公钥',configured(pay,'payments.wechat.platform_public_key')))+
  provider('易支付兼容协议','兼容常见易支付 V1 接口。不同服务商存在差异，上线前请使用实际服务商完成支付与回调测试。',
   check('payments.epay.enabled','启用易支付兼容协议',bool(value(pay,'payments.epay.enabled',false)))+
   input('payments.epay.gateway','接口地址',value(pay,'payments.epay.gateway'),'url')+input('payments.epay.pid','商户编号',value(pay,'payments.epay.pid'))+
   select('payments.epay.default_type','默认付款类型',value(pay,'payments.epay.default_type','alipay'),[['alipay','支付宝'],['wxpay','微信支付'],['qqpay','QQ 钱包']])+
   secret('payments.epay.key','商户密钥',configured(pay,'payments.epay.key')))+
  provider('PayPal','支持沙盒和正式环境，使用 PayPal 商户应用完成付款。',
   check('payments.paypal.enabled','启用 PayPal',bool(value(pay,'payments.paypal.enabled',false)))+
   select('payments.paypal.environment','运行环境',value(pay,'payments.paypal.environment','sandbox'),[['sandbox','沙盒环境'],['live','正式环境']])+
   input('payments.paypal.client_id','客户端编号',value(pay,'payments.paypal.client_id'))+
   secret('payments.paypal.client_secret','客户端密钥',configured(pay,'payments.paypal.client_secret'))+secret('payments.paypal.webhook_id','通知编号',configured(pay,'payments.paypal.webhook_id')))+
  provider('Stripe','使用 Stripe 托管结账页完成付款。',
   check('payments.stripe.enabled','启用 Stripe',bool(value(pay,'payments.stripe.enabled',false)))+
   secret('payments.stripe.secret_key','服务端密钥',configured(pay,'payments.stripe.secret_key'))+secret('payments.stripe.webhook_secret','通知签名密钥',configured(pay,'payments.stripe.webhook_secret')))+
  `</div>`
 );
 const assets=['logo','logo-dark','logo-light','logo-square','favicon','apple-touch-icon','pwa-icon','share-image','login-image','mail-logo'];
 const brandPane=`<section class="ah-settings-pane hidden" data-ah-pane="brand"><div class="ah-pane-head"><div><h2>品牌与视觉</h2><p>这些品牌资产会统一用于官网、控制台、公开分享页、邮件与账单。</p></div></div><form class="ah-brand-color" data-section="brand">${input('brand.primary_color','主品牌色',value(brand,'brand.primary_color','#16A66A'),'color')}<button class="btn primary">保存品牌色</button><span class="ah-save-result"></span></form><div class="ah-assets">${assets.map(a=>`<article class="ah-asset"><div class="ah-asset-preview">${brand[a]?`<img src="${UE(brand[a])}?v=brand" alt="${UE(assetLabels[a])}">`:'<span>未设置</span>'}</div><div><b>${UE(assetLabels[a])}</b><small>${brand[a]?UE(brand[a]):'尚未上传'}</small><input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon" data-ah-file="${a}"><div class="row-actions"><button type="button" class="btn small" data-ah-upload="${a}">上传</button>${brand[a]?`<button type="button" class="btn small danger" data-ah-delete="${a}">删除</button>`:''}</div></div></article>`).join('')}</div></section>`;
 UQ('#content').innerHTML=pageHead('系统设置','管理站点信息、账户规则、短链接、支付方式和品牌视觉。')+`<div class="ah-settings-shell"><aside class="ah-settings-nav">${tab('basic','站点信息','名称、企业信息与联系方式')}${tab('seo','搜索与分享','网页标题与摘要')}${tab('registration','注册与账户','注册、验证与密码安全')}${tab('links','短链接','默认短码与跳转规则')}${tab('payments','支付方式','账单在线支付渠道')}${tab('brand','品牌与视觉','标志、图标与主品牌色')}</aside><div class="ah-settings-main">${basicPane}${searchPane}${accountPane}${linkPane}${paymentPane}${brandPane}</div></div>`;
 UQA('[data-ah-tab]').forEach(b=>b.onclick=()=>openUnifiedTab(b.dataset.ahTab));
 UQA('form[data-section],.ah-brand-color').forEach(f=>f.onsubmit=saveUnifiedSection);
 UQA('[data-ah-upload]').forEach(b=>b.onclick=()=>{const i=UQ(`[data-ah-file="${b.dataset.ahUpload}"]`);i.click();i.onchange=()=>uploadUnifiedAsset(b.dataset.ahUpload,i.files?.[0])});
 UQA('[data-ah-delete]').forEach(b=>b.onclick=()=>deleteUnifiedAsset(b.dataset.ahDelete));
 openUnifiedTab(sessionStorage.getItem('gojet_settings_tab')||'basic');
};
function openUnifiedTab(id){sessionStorage.setItem('gojet_settings_tab',id);UQA('[data-ah-tab]').forEach(b=>b.classList.toggle('active',b.dataset.ahTab===id));UQA('[data-ah-pane]').forEach(p=>p.classList.toggle('hidden',p.dataset.ahPane!==id))}
async function saveUnifiedSection(e){e.preventDefault();const form=e.currentTarget,payload={};UQA('input,select,textarea',form).forEach(el=>{if(!el.name)return;if(el.dataset.sensitive==='1'&&!el.value.trim())return;if(el.type==='checkbox')payload[el.name]=el.checked;else if(el.type==='number')payload[el.name]=Number(el.value);else payload[el.name]=el.value});const result=UQ('.ah-save-result',form);try{await api(`/api/admin/settings/${form.dataset.section}`,{method:'PUT',body:JSON.stringify(payload)});if(result){result.textContent='已保存';result.className='ah-save-result ok'}toast('设置已保存');if(form.dataset.section==='payments')renderSettings()}catch(err){if(result){result.textContent=err.message;result.className='ah-save-result bad'}fail(err.message)}}
async function uploadUnifiedAsset(asset,file){if(!file)return;try{await upload(`/api/admin/brand/${asset}`,file);toast('品牌资产已上传');renderSettings()}catch(err){fail(err.message)}}
async function deleteUnifiedAsset(asset){if(!confirm('确定删除这个品牌资产？'))return;try{await api(`/api/admin/brand/${asset}`,{method:'DELETE'});toast('品牌资产已删除');renderSettings()}catch(err){fail(err.message)}}
})();
