(()=>{
  const bool=(v,d=false)=>v===undefined?d:Boolean(v);
  const val=(obj,key,fallback='')=>obj?.[key]??fallback;
  const input=(key,label,value,type='text',opts='')=>`<label><span>${esc(label)}</span><input name="${esc(key)}" type="${type}" value="${esc(value??'')}" ${opts}></label>`;
  const checkbox=(key,label,value,help='')=>`<label class="switch-row full"><span><b>${esc(label)}</b>${help?`<small>${esc(help)}</small>`:''}</span><input name="${esc(key)}" type="checkbox" ${value?'checked':''}></label>`;
  const textarea=(key,label,value,help='')=>`<label class="full"><span>${esc(label)}</span><textarea name="${esc(key)}" rows="3" ${help?`placeholder="${esc(help)}"`:''}>${esc(value??'')}</textarea></label>`;
  const select=(key,label,value,options)=>`<label><span>${esc(label)}</span><select name="${esc(key)}">${options.map(([v,t])=>`<option value="${esc(v)}" ${String(value)===String(v)?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
  const save=(section,label,body)=>`<form class="settings-section form-grid" data-complete-settings="${section}"><h3 class="full">${esc(label)}</h3>${body}<div class="full"><button class="btn blue">保存${esc(label)}</button><span class="settings-save-result" style="margin-left:10px;font-size:12px"></span></div></form>`;

  renderSettings=async function(){
    const s=await api('/api/admin/settings');
    const b=s.basic||{},seo=s.seo||{},reg=s.registration||{},links=s.links||{},privacy=s.privacy||{},runtime=s.runtime||{},brand=s.brand||{};
    const basic=save('basic','基础信息',
      input('site.name','网站名称',val(b,'site.name','GoJet'))+
      input('site.short_name','网站简称',val(b,'site.short_name','GoJet'))+
      input('site.tagline','网站标语',val(b,'site.tagline'))+
      textarea('site.description','网站描述',val(b,'site.description'))+
      input('site.language','默认语言',val(b,'site.language','zh-CN'))+
      input('site.timezone','时区',val(b,'site.timezone','UTC'))+
      input('site.contact_email','联系邮箱',val(b,'site.contact_email'),'email')+
      input('site.support_email','支持邮箱',val(b,'site.support_email'),'email')+
      input('site.company_name','公司名称',val(b,'site.company_name'))+
      input('site.company_address','公司地址',val(b,'site.company_address'))+
      input('site.copyright','版权文字',val(b,'site.copyright'))
    );
    const seoForm=save('seo','SEO 与分享',
      input('seo.default_title','默认标题',val(seo,'seo.default_title'))+
      input('seo.title_template','标题模板',val(seo,'seo.title_template','%s | GoJet'))+
      textarea('seo.meta_description','Meta Description',val(seo,'seo.meta_description'))+
      input('seo.meta_keywords','Meta Keywords',val(seo,'seo.meta_keywords'))+
      input('seo.canonical_url','Canonical URL',val(seo,'seo.canonical_url'),'url')+
      textarea('seo.open_graph','Open Graph 配置',val(seo,'seo.open_graph'),'可保存 JSON 或模板配置')+
      textarea('seo.twitter_card','Twitter Card 配置',val(seo,'seo.twitter_card'))+
      textarea('seo.robots','Robots 配置',val(seo,'seo.robots'))+
      checkbox('seo.sitemap','启用 Sitemap',bool(val(seo,'seo.sitemap',true)))+
      textarea('seo.verification','站点验证代码',val(seo,'seo.verification'))
    );
    const registration=save('registration','注册、登录与安全',
      checkbox('registration.enabled','开放公开注册',bool(val(reg,'registration.enabled',true)),'关闭后 /register 显示暂停注册。')+
      checkbox('registration.require_email_verification','要求邮箱验证',bool(val(reg,'registration.require_email_verification',false)),'必须先通过 SMTP 测试才能开启。')+
      checkbox('registration.forgot_password','允许找回密码',bool(val(reg,'registration.forgot_password',true)))+
      checkbox('registration.invitation_only','仅邀请注册',bool(val(reg,'registration.invitation_only',false)))+
      checkbox('registration.admin_mfa','允许管理员登录 MFA',bool(val(reg,'registration.admin_mfa',true)),'MFA 只用于管理员登录，不用于后台每次保存。')+
      input('registration.password_min_length','最短密码长度',val(reg,'registration.password_min_length',10),'number','min="10" max="128"')+
      input('registration.login_rate_limit','登录频率限制',val(reg,'registration.login_rate_limit',10),'number','min="1" max="100"')+
      textarea('registration.blocked_domains','禁止注册的邮箱域名',val(reg,'registration.blocked_domains'),'多个域名可换行或逗号分隔')+
      input('turnstile.site_key','Turnstile Site Key',val(reg,'turnstile.site_key'))+
      `<label><span>Turnstile Secret</span><input name="turnstile.secret" type="password" value="" placeholder="${val(reg,'turnstile.secret')?'已配置；留空保持不变':'尚未配置'}"></label>`
    );
    const linkPolicy=save('links','短链接默认策略',
      input('links.default_domain','默认短链域名',val(links,'links.default_domain'))+
      select('links.default_redirect_status','默认跳转状态码',val(links,'links.default_redirect_status',302),[[301,'301 永久'],[302,'302 临时'],[307,'307 临时'],[308,'308 永久']])+
      input('links.code_length','自动短码长度',val(links,'links.code_length',6),'number','min="3" max="32"')+
      input('links.allowed_characters','短码允许字符',val(links,'links.allowed_characters','abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'))+
      textarea('links.reserved_codes','保留短码',val(links,'links.reserved_codes'),'例如：admin, api, login')+
      textarea('links.blocked_keywords','禁止关键词',val(links,'links.blocked_keywords'))+
      checkbox('links.anonymous_creation','允许匿名创建',bool(val(links,'links.anonymous_creation',false)))+
      input('links.default_expiry_days','默认有效天数（0=永久）',val(links,'links.default_expiry_days',0),'number','min="0" max="3650"')+
      input('links.default_click_limit','默认点击上限（0=不限）',val(links,'links.default_click_limit',0),'number','min="0"')+
      checkbox('links.force_https','强制 HTTPS 目标',bool(val(links,'links.force_https',false)))+
      checkbox('links.safe_browsing','启用安全检查',bool(val(links,'links.safe_browsing',true)))
    );
    const analytics=save('privacy','Analytics 与隐私',
      checkbox('analytics.enabled','启用访问分析',bool(val(privacy,'analytics.enabled',true)))+
      input('analytics.retention_days','分析数据保留天数',val(privacy,'analytics.retention_days',365),'number','min="1"')+
      checkbox('analytics.record_full_referer','记录完整 Referer',bool(val(privacy,'analytics.record_full_referer',false)))+
      checkbox('analytics.record_city','记录城市维度',bool(val(privacy,'analytics.record_city',false)))+
      checkbox('analytics.exclude_bots','统计中排除 Bot',bool(val(privacy,'analytics.exclude_bots',true)))+
      input('analytics.visitor_window_hours','独立访客窗口（小时）',val(privacy,'analytics.visitor_window_hours',24),'number','min="1"')+
      textarea('privacy.cookie_policy','Cookie / 隐私策略',val(privacy,'privacy.cookie_policy'))+
      checkbox('privacy.periodic_cleanup','定期清理超期数据',bool(val(privacy,'privacy.periodic_cleanup',true)))
    );
    const runtimeForm=save('runtime','API 与缓存',
      checkbox('api.enabled','启用 Platform API',bool(val(runtime,'api.enabled',true)),'关闭后普通用户 API 暂停，管理员控制接口保持可用。')+
      checkbox('cache.enabled','启用 Redis 应用缓存',bool(val(runtime,'cache.enabled',true)))+
      input('cache.default_ttl_seconds','默认缓存 TTL（秒）',val(runtime,'cache.default_ttl_seconds',300),'number','min="10" max="86400"')
    );
    const brandForm=`<div class="panel"><form class="settings-section form-grid" data-complete-settings="brand"><h3 class="full">品牌颜色</h3>${input('brand.primary_color','主品牌色',val(brand,'brand.primary_color','#315efb'),'text')}<div class="full"><button class="btn blue">保存品牌颜色</button><span class="settings-save-result" style="margin-left:10px;font-size:12px"></span></div></form><div class="panel-head"><div><h3>品牌图片资产</h3><p>上传成功后 URL 会立即写入设置并从 /uploads/ 公开读取。</p></div></div><div class="panel-body asset-grid">${['logo','logo-dark','logo-light','logo-square','favicon','apple-touch-icon','pwa-icon','share-image','login-image','mail-logo'].map(a=>`<div class="asset"><b>${a}</b>${brand[a]?`<img src="${esc(brand[a])}" alt="${a}"><small>${esc(brand[a])}</small>`:'<div class="empty" style="padding:25px 0">未上传</div>'}<input type="file" accept="image/*" data-brand-file="${a}"><div style="margin-top:8px;display:flex;gap:5px"><button class="btn small" data-brand-upload="${a}">上传</button>${brand[a]?`<button class="btn small danger" data-brand-delete="${a}">删除</button>`:''}</div></div>`).join('')}</div></div>`;
    $('#content').innerHTML=pageHead('系统设置','超级管理员可以编辑全部平台设置；普通管理员只能看到被授予的设置模块。')+`<div class="panel">${basic}${seoForm}${registration}${linkPolicy}${analytics}${runtimeForm}</div>${brandForm}`;
    $$('[data-complete-settings]').forEach(f=>f.onsubmit=saveCompleteSection);
    $$('[data-brand-upload]').forEach(b=>b.onclick=()=>saveBrand(b.dataset.brandUpload));
    $$('[data-brand-delete]').forEach(b=>b.onclick=()=>deleteBrand(b.dataset.brandDelete));
  };

  async function saveCompleteSection(e){
    e.preventDefault();
    const f=e.currentTarget,payload={};
    $$('input,select,textarea',f).forEach(el=>{
      if(!el.name)return;
      if(el.name==='turnstile.secret'&&!el.value.trim())return;
      if(el.type==='checkbox')payload[el.name]=el.checked;
      else if(el.type==='number')payload[el.name]=Number(el.value);
      else payload[el.name]=el.value;
    });
    const result=$('.settings-save-result',f);
    try{
      await api(`/api/admin/settings/${f.dataset.completeSettings}`,{method:'PUT',body:JSON.stringify(payload)});
      result.textContent='已保存';result.style.color='#067647';toast('设置已保存');
    }catch(err){result.textContent=err.message;result.style.color='#b42318';fail(err.message)}
  }
})();
