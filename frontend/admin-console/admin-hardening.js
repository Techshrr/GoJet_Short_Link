(()=>{
const ahEsc=v=>esc(v??''), ahVal=(o,k,d='')=>o?.[k]??d;
const ahBool=(v,d=false)=>v===undefined?d:Boolean(v);
const ahInput=(k,l,v,type='text',attrs='')=>`<label><span>${ahEsc(l)}</span><input name="${ahEsc(k)}" type="${type}" value="${ahEsc(v??'')}" ${attrs}></label>`;
const ahText=(k,l,v,help='')=>`<label class="full"><span>${ahEsc(l)}</span><textarea name="${ahEsc(k)}" rows="4" placeholder="${ahEsc(help)}">${ahEsc(v??'')}</textarea></label>`;
const ahCheck=(k,l,v,help='')=>`<label class="ah-switch full"><span><b>${ahEsc(l)}</b>${help?`<small>${ahEsc(help)}</small>`:''}</span><input name="${ahEsc(k)}" type="checkbox" ${v?'checked':''}></label>`;
const ahSelect=(k,l,v,opts)=>`<label><span>${ahEsc(l)}</span><select name="${ahEsc(k)}">${opts.map(([x,t])=>`<option value="${ahEsc(x)}" ${String(v)===String(x)?'selected':''}>${ahEsc(t)}</option>`).join('')}</select></label>`;
function section(id,title,desc,body){return `<form class="ah-settings-pane hidden" data-ah-pane="${id}" data-section="${id}"><div class="ah-pane-head"><div><span class="eyebrow">SYSTEM SETTINGS</span><h2>${ahEsc(title)}</h2><p>${ahEsc(desc)}</p></div><button class="btn blue">保存更改</button></div><div class="ah-settings-grid">${body}</div><div class="ah-save-result"></div></form>`}
function tab(id,label,desc){return `<button type="button" data-ah-tab="${id}"><b>${label}</b><small>${desc}</small></button>`}

renderSettings=async function(){
 const s=await api('/api/admin/settings'),b=s.basic||{},seo=s.seo||{},reg=s.registration||{},links=s.links||{},brand=s.brand||{};
 const general=section('basic','站点基础信息','网站名称、默认语言和公开联系方式。',
  ahInput('site.name','网站名称',ahVal(b,'site.name','GoJet'))+ahInput('site.short_name','网站简称',ahVal(b,'site.short_name','GoJet'))+
  ahInput('site.tagline','网站标语',ahVal(b,'site.tagline'))+ahInput('site.language','默认语言',ahVal(b,'site.language','zh-CN'))+
  ahText('site.description','网站描述',ahVal(b,'site.description'))+ahInput('site.timezone','时区',ahVal(b,'site.timezone','UTC'))+
  ahInput('site.contact_email','联系邮箱',ahVal(b,'site.contact_email'),'email')+ahInput('site.support_email','支持邮箱',ahVal(b,'site.support_email'),'email')+
  ahInput('site.company_name','公司名称',ahVal(b,'site.company_name'))+ahInput('site.company_address','公司地址',ahVal(b,'site.company_address'))+
  ahInput('site.copyright','版权文字',ahVal(b,'site.copyright'))
 );
 const seoPane=section('seo','SEO 与分享元数据','只保留公开页面当前能够消费和输出的元数据配置。',
  ahInput('seo.default_title','默认标题',ahVal(seo,'seo.default_title'))+ahInput('seo.title_template','标题模板',ahVal(seo,'seo.title_template','%s | GoJet'))+
  ahText('seo.meta_description','Meta Description',ahVal(seo,'seo.meta_description'))+ahInput('seo.meta_keywords','Meta Keywords',ahVal(seo,'seo.meta_keywords'))+
  ahInput('seo.canonical_url','Canonical URL',ahVal(seo,'seo.canonical_url'),'url')+ahText('seo.robots','Robots 配置',ahVal(seo,'seo.robots'))+
  ahCheck('seo.sitemap','启用 Sitemap',ahBool(ahVal(seo,'seo.sitemap',true)))+ahText('seo.verification','站点验证代码',ahVal(seo,'seo.verification'))+
  ahText('seo.open_graph','Open Graph 配置',ahVal(seo,'seo.open_graph'),'JSON 或模板配置')+ahText('seo.twitter_card','Twitter Card 配置',ahVal(seo,'seo.twitter_card'))
 );
 const registration=section('registration','注册与登录','这些字段已经直接接入注册、登录限流、邮箱验证和找回密码运行时。',
  ahCheck('registration.enabled','开放公开注册',ahBool(ahVal(reg,'registration.enabled',true)),'关闭后 /register 直接显示暂停注册。')+
  ahCheck('registration.require_email_verification','要求邮箱验证',ahBool(ahVal(reg,'registration.require_email_verification',false)),'SMTP 测试成功后才能开启。')+
  ahCheck('registration.forgot_password','允许找回密码',ahBool(ahVal(reg,'registration.forgot_password',true)))+
  ahInput('registration.password_min_length','最短密码长度',ahVal(reg,'registration.password_min_length',10),'number','min="10" max="72"')+
  ahInput('registration.login_rate_limit','登录失败限流',ahVal(reg,'registration.login_rate_limit',10),'number','min="1" max="100"')+
  ahText('registration.blocked_domains','禁止注册的邮箱域名',ahVal(reg,'registration.blocked_domains'),'例如 disposable.test，每行或逗号分隔')
 );
 const linkPolicy=section('links','短链接默认策略','只展示 CreateWithPolicy 当前真实读取的规则，不展示没有消费者的假开关。',
  ahInput('links.default_domain','默认短链域名',ahVal(links,'links.default_domain'))+
  ahSelect('links.default_redirect_status','默认跳转状态码',ahVal(links,'links.default_redirect_status',302),[[301,'301 永久'],[302,'302 临时'],[307,'307 临时'],[308,'308 永久']])+
  ahInput('links.code_length','自动短码长度',ahVal(links,'links.code_length',6),'number','min="3" max="32"')+
  ahInput('links.allowed_characters','短码允许字符',ahVal(links,'links.allowed_characters','abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'))+
  ahText('links.reserved_codes','保留短码',ahVal(links,'links.reserved_codes'),'admin, api, login；支持换行或逗号')+
  ahText('links.blocked_keywords','禁止关键词',ahVal(links,'links.blocked_keywords'),'按换行或逗号分隔')+
  ahInput('links.default_expiry_days','默认有效天数（0=永久）',ahVal(links,'links.default_expiry_days',0),'number','min="0" max="3650"')+
  ahInput('links.default_click_limit','默认点击上限（0=不限）',ahVal(links,'links.default_click_limit',0),'number','min="0"')+
  ahCheck('links.force_https','强制 HTTPS 目标',ahBool(ahVal(links,'links.force_https',false)))
 );
 const brandPane=`<section class="ah-settings-pane hidden" data-ah-pane="brand"><div class="ah-pane-head"><div><span class="eyebrow">BRAND</span><h2>品牌与视觉资产</h2><p>上传后立即写入设置并通过 /uploads/ 提供，页面不再用巨大文件表单堆在设置末尾。</p></div></div><form class="ah-brand-color" data-section="brand">${ahInput('brand.primary_color','主品牌色',ahVal(brand,'brand.primary_color','#315efb'),'color')}<button class="btn blue">保存品牌色</button><span class="ah-save-result"></span></form><div class="ah-assets">${['logo','logo-dark','logo-light','logo-square','favicon','apple-touch-icon','pwa-icon','share-image','login-image','mail-logo'].map(a=>`<article class="ah-asset"><div class="ah-asset-preview">${brand[a]?`<img src="${ahEsc(brand[a])}?asset=hardening" alt="${a}">`:'<span>未上传</span>'}</div><div><b>${a}</b><small>${brand[a]?ahEsc(brand[a]):'尚未配置'}</small><input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon" data-ah-file="${a}"><div class="row-actions"><button class="btn small" data-ah-upload="${a}">选择并上传</button>${brand[a]?`<button class="btn small danger" data-ah-delete="${a}">删除</button>`:''}</div></div></article>`).join('')}</div></section>`;
 $('#content').innerHTML=pageHead('系统设置','按业务域分组；未接入运行时的装饰性设置已经从正式后台移除。')+`<div class="ah-settings-shell"><aside class="ah-settings-nav">${tab('basic','基础信息','名称、语言、联系方式')}${tab('seo','SEO','搜索与分享元数据')}${tab('registration','注册与登录','注册策略与账户安全')}${tab('links','短链接策略','短码、域名、跳转默认值')}${tab('brand','品牌资产','Logo、图标与品牌色')}</aside><div class="ah-settings-main">${general}${seoPane}${registration}${linkPolicy}${brandPane}</div></div>`;
 $$('[data-ah-tab]').forEach(b=>b.onclick=()=>openTab(b.dataset.ahTab));
 $$('[data-ah-pane] form,[data-ah-pane][data-section],.ah-brand-color').forEach(f=>{if(f.matches('form'))f.onsubmit=saveAHSection});
 $$('[data-ah-upload]').forEach(b=>b.onclick=()=>{const input=$(`[data-ah-file="${b.dataset.ahUpload}"]`);input.click();input.onchange=()=>uploadAHAsset(b.dataset.ahUpload,input.files?.[0])});
 $$('[data-ah-delete]').forEach(b=>b.onclick=()=>deleteAHAsset(b.dataset.ahDelete));
 openTab(sessionStorage.getItem('gojet_settings_tab')||'basic');
};
function openTab(id){sessionStorage.setItem('gojet_settings_tab',id);$$('[data-ah-tab]').forEach(b=>b.classList.toggle('active',b.dataset.ahTab===id));$$('[data-ah-pane]').forEach(p=>p.classList.toggle('hidden',p.dataset.ahPane!==id))}
async function saveAHSection(e){e.preventDefault();const f=e.currentTarget,payload={};$$('input,select,textarea',f).forEach(el=>{if(!el.name)return;if(el.type==='checkbox')payload[el.name]=el.checked;else if(el.type==='number')payload[el.name]=Number(el.value);else payload[el.name]=el.value});const result=$('.ah-save-result',f);try{await api(`/api/admin/settings/${f.dataset.section}`,{method:'PUT',body:JSON.stringify(payload)});if(result){result.textContent='已保存';result.className='ah-save-result ok'}toast('设置已保存')}catch(err){if(result){result.textContent=err.message;result.className='ah-save-result bad'}fail(err.message)}}
async function uploadAHAsset(asset,file){if(!file)return;try{await upload(`/api/admin/brand/${asset}`,file);toast('品牌资产已上传');renderSettings()}catch(err){fail(err.message)}}
async function deleteAHAsset(asset){if(!confirm('删除这个品牌资产？'))return;try{await api(`/api/admin/brand/${asset}`,{method:'DELETE'});toast('品牌资产已删除');renderSettings()}catch(err){fail(err.message)}}
})();
