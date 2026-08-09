(() => {
  const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const value = (object, key, fallback = '') => object && object[key] !== undefined && object[key] !== null ? object[key] : fallback;
  const attr = input => esc(input ?? '');
  const checked = input => input ? 'checked' : '';
  const option = (actual, expected) => actual === expected ? 'selected' : '';

  // Authoritative admin request helper. JSON and FormData use the same auth and
  // step-up retry path. The browser never stores a TOTP code after the request.
  api = async function(path, options = {}) {
    const {_stepUp = false, headers: extraHeaders = {}, ...request} = options;
    const headers = {Authorization: `Bearer ${token}`, ...extraHeaders};
    if (!(request.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const response = await fetch(path, {...request, headers, cache: 'no-store'});
    const data = await response.json().catch(() => ({}));
    if (response.status === 428 && data.step_up_required && !_stepUp) {
      const code = prompt('此敏感操作需要管理员二次验证码。验证成功后，本管理员会话 10 分钟内不再重复验证。');
      if (!code) throw new Error('已取消敏感操作');
      return api(path, {...options, _stepUp: true, headers: {...extraHeaders, 'X-GoJet-TOTP': code}});
    }
    if (!response.ok) throw new Error(data.error || `请求失败 ${response.status}`);
    return data;
  };

  function field(name, label, current, type = 'text') {
    return `<label>${label}<input name="${name}" type="${type}" value="${attr(current)}"></label>`;
  }
  function checkField(name, label, current) {
    return `<label><span>${label}</span><input name="${name}" type="checkbox" ${checked(current)}></label>`;
  }
  function listFieldV2(name, label, current) {
    const text = Array.isArray(current) ? current.join(', ') : (current || '');
    return `<label>${label}<input name="${name}" data-list value="${attr(text)}"></label>`;
  }
  function brandField(asset, url) {
    const preview = url
      ? `<div class="brandPreview"><img src="${attr(url)}" alt="${attr(asset)}" style="max-height:64px;max-width:220px" loading="lazy"><small>${attr(url)}</small><button type="button" onclick="deleteBrand('${asset}')">删除</button></div>`
      : '<small>尚未上传</small>';
    return `<form class="brandUpload" data-brand="${asset}"><label>${asset}<input name="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon" required></label>${preview}<button>上传并替换</button></form>`;
  }

  function collect(form) {
    const values = {};
    for (const input of form.elements) {
      if (!input.name) continue;
      if (input.type === 'checkbox') values[input.name] = input.checked;
      else if (input.type === 'number') values[input.name] = Number(input.value);
      else if (input.dataset.list !== undefined) values[input.name] = input.value.split(',').map(item => item.trim()).filter(Boolean);
      else values[input.name] = input.value;
    }
    return values;
  }

  async function saveSection(form, section) {
    const submitted = collect(form);
    await api(`/api/admin/settings/${section}`, {method: 'PUT', body: JSON.stringify(submitted)});
    const reloaded = await api('/api/admin/settings');
    const saved = reloaded[section] || {};
    for (const [key, expected] of Object.entries(submitted)) {
      if (!equal(saved[key], expected)) throw new Error(`服务器回读不一致：${key}`);
    }
    alert('设置已保存，并已从数据库重新读取确认。');
    await settings();
  }

  async function saveSMTP(form) {
    const submitted = Object.fromEntries(new FormData(form));
    submitted.port = Number(submitted.port);
    await api('/api/admin/settings/mail', {method: 'PUT', body: JSON.stringify(submitted)});
    const reloaded = await api('/api/admin/settings');
    const saved = reloaded.mail || {};
    for (const key of ['host','port','encryption','ehlo','username','from_email','from_name','reply_to']) {
      if (!equal(saved[key] ?? '', submitted[key] ?? '')) throw new Error(`SMTP 设置回读不一致：${key}`);
    }
    if (submitted.password && !saved.password_configured) throw new Error('SMTP 密码未写入服务器');
    alert('SMTP 设置已保存，并已从数据库重新读取确认。');
    await settings();
  }

  async function uploadBrandV2(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const asset = form.dataset.brand;
    try {
      const result = await api(`/api/admin/brand/${asset}`, {method: 'POST', body: new FormData(form)});
      const publicFile = await fetch(result.url, {cache: 'no-store'});
      if (!publicFile.ok) throw new Error(`文件已写入，但公开地址返回 HTTP ${publicFile.status}：${result.url}`);
      alert('品牌资产已上传，并确认公开地址可以访问。');
      await settings();
    } catch (error) {
      alert('品牌资产上传失败：' + error.message);
    }
  }

  window.deleteBrand = async asset => {
    if (!confirm('确认删除该品牌资产？')) return;
    try {
      await api(`/api/admin/brand/${asset}`, {method: 'DELETE'});
      await settings();
    } catch (error) {
      alert('删除失败：' + error.message);
    }
  };

  // Replace the old two-stage DOM hotpatch entirely. Settings are fetched first
  // and the form is rendered from that exact server response in one pass.
  settings = async function() {
    $('#content').innerHTML = '<div class="notice">正在从服务器读取当前设置…</div>';
    try {
      const current = await api('/api/admin/settings');
      const mail = current.mail || {};
      const basic = current.basic || {};
      const seo = current.seo || {};
      const brand = current.brand || {};
      const registration = current.registration || {};
      const links = current.links || {};
      const privacy = current.privacy || {};
      const runtime = current.runtime || {};

      $('#content').innerHTML = `
        <div class="panel"><h2>SMTP 邮件设置</h2>
          <form id="mailSettings" class="settingGrid">
            ${field('host','SMTP Host',value(mail,'host'))}
            ${field('port','端口',value(mail,'port',587),'number')}
            <label>加密<select name="encryption">
              <option value="starttls" ${option(value(mail,'encryption','starttls'),'starttls')}>STARTTLS</option>
              <option value="tls" ${option(value(mail,'encryption','starttls'),'tls')}>TLS</option>
              <option value="none" ${option(value(mail,'encryption','starttls'),'none')}>无加密</option>
            </select></label>
            ${field('ehlo','EHLO 域名',value(mail,'ehlo'))}
            ${field('username','用户名',value(mail,'username'))}
            <label>密码<input name="password" type="password" placeholder="${mail.password_configured ? '已保存密码；留空保持不变' : '尚未配置 SMTP 密码'}"></label>
            ${field('from_email','发件邮箱',value(mail,'from_email'),'email')}
            ${field('from_name','发件人名称',value(mail,'from_name','GoJet'))}
            ${field('reply_to','回复邮箱',value(mail,'reply_to'),'email')}
            <button>保存 SMTP 设置</button>
          </form>
        </div>
        <div class="panel"><h2>连接并发送测试邮件</h2>
          <form id="mailTest" class="settingGrid"><label>测试收件人<input name="recipient" type="email" required></label><button>连接、认证并实际发送</button></form>
          <p id="mailResult" class="notice hidden"></p>
        </div>
        <div class="panel"><h2>基础信息与 SEO</h2>
          <form id="basicSettings" class="settingGrid">
            ${field('site.name','网站名称',value(basic,'site.name','GoJet'))}
            ${field('site.short_name','网站简称',value(basic,'site.short_name','GoJet'))}
            ${field('site.tagline','网站标语',value(basic,'site.tagline'))}
            ${field('site.description','网站描述',value(basic,'site.description'))}
            ${field('site.language','默认语言',value(basic,'site.language','zh-CN'))}
            ${field('site.timezone','时区',value(basic,'site.timezone','UTC'))}
            ${field('site.contact_email','联系邮箱',value(basic,'site.contact_email'),'email')}
            ${field('site.support_email','支持邮箱',value(basic,'site.support_email'),'email')}
            <button>保存基础信息</button>
          </form>
          <form id="seoSettings" class="settingGrid">
            ${field('seo.default_title','默认页面标题',value(seo,'seo.default_title'))}
            ${field('seo.title_template','标题模板',value(seo,'seo.title_template','%s | GoJet'))}
            ${field('seo.meta_description','Meta Description',value(seo,'seo.meta_description'))}
            ${field('seo.meta_keywords','Meta Keywords',value(seo,'seo.meta_keywords'))}
            ${field('seo.canonical_url','Canonical URL',value(seo,'seo.canonical_url'),'url')}
            <button>保存 SEO</button>
          </form>
        </div>
        <div class="panel"><h2>品牌资产</h2>
          <p class="notice">上传成功后会立即检查公开 URL；如果 Nginx 无法读取文件，这里会直接报错而不是显示假成功。</p>
          <form id="brandColor" class="settingGrid">${field('brand.primary_color','品牌主色',value(brand,'brand.primary_color','#1769e0'),'color')}<button>保存品牌颜色</button></form>
          <div id="brandAssets" class="settingGrid">${['logo','logo-dark','logo-light','logo-square','favicon','apple-touch-icon','pwa-icon','share-image','login-image','mail-logo'].map(asset => brandField(asset, brand[asset])).join('')}</div>
        </div>
        <div class="panel"><h2>注册、短链与统计隐私</h2>
          <form id="registrationSettings" class="settingGrid">
            ${checkField('registration.enabled','开放注册',value(registration,'registration.enabled',false))}
            ${checkField('registration.require_email_verification','强制邮箱验证',value(registration,'registration.require_email_verification',false))}
            ${field('registration.password_min_length','最短密码长度',value(registration,'registration.password_min_length',10),'number')}
            ${field('registration.login_rate_limit','登录频率限制',value(registration,'registration.login_rate_limit',10),'number')}
            <button>保存注册设置</button>
          </form>
          <form id="linkSettings" class="settingGrid">
            <h3>短链创建默认策略</h3>
            ${field('links.default_domain','默认短域名',value(links,'links.default_domain'))}
            ${field('links.default_redirect_status','默认跳转状态码',value(links,'links.default_redirect_status',302),'number')}
            ${field('links.code_length','自动短码长度',value(links,'links.code_length',7),'number')}
            ${field('links.allowed_characters','允许的短码字符',value(links,'links.allowed_characters','abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'))}
            ${listFieldV2('links.reserved_codes','保留短码（逗号分隔）',value(links,'links.reserved_codes',[]))}
            ${listFieldV2('links.blocked_keywords','禁用关键词（逗号分隔）',value(links,'links.blocked_keywords',[]))}
            ${field('links.default_expiry_days','默认有效天数（0 为永久）',value(links,'links.default_expiry_days',0),'number')}
            ${field('links.default_click_limit','默认点击上限（0 为不限）',value(links,'links.default_click_limit',0),'number')}
            ${checkField('links.force_https','目标地址强制 HTTPS',value(links,'links.force_https',false))}
            <button>保存短链策略</button>
          </form>
          <form id="privacySettings" class="settingGrid">
            ${checkField('analytics.enabled','启用统计',value(privacy,'analytics.enabled',true))}
            ${field('analytics.retention_days','数据保留天数',value(privacy,'analytics.retention_days',30),'number')}
            ${checkField('analytics.record_full_referer','记录完整 Referer',value(privacy,'analytics.record_full_referer',false))}
            ${checkField('analytics.record_city','记录城市',value(privacy,'analytics.record_city',false))}
            ${checkField('analytics.exclude_bots','分析中排除 Bot',value(privacy,'analytics.exclude_bots',true))}
            <button>保存隐私设置</button>
          </form>
        </div>
        <div class="panel"><h2>API 与缓存运行时</h2>
          <p class="notice">普通保存不要求二次验证；只有关闭用户 API 等真正高风险变更才会触发敏感操作验证。</p>
          <form id="runtimeSettings" class="settingGrid">
            ${checkField('api.enabled','开放用户与工作区 API',value(runtime,'api.enabled',true))}
            ${checkField('cache.enabled','启用公开设置 Redis 缓存',value(runtime,'cache.enabled',true))}
            ${field('cache.default_ttl_seconds','公开设置缓存 TTL（秒）',value(runtime,'cache.default_ttl_seconds',300),'number')}
            <button>保存运行时设置</button>
          </form>
        </div>`;

      for (const [id, section] of [['basicSettings','basic'],['seoSettings','seo'],['brandColor','brand'],['registrationSettings','registration'],['linkSettings','links'],['privacySettings','privacy'],['runtimeSettings','runtime']]) {
        const form = document.getElementById(id);
        form.onsubmit = async event => {
          event.preventDefault();
          try { await saveSection(form, section); } catch (error) { alert('保存失败：' + error.message); }
        };
      }

      document.getElementById('mailSettings').onsubmit = async event => {
        event.preventDefault();
        try { await saveSMTP(event.currentTarget); } catch (error) { alert('SMTP 保存失败：' + error.message); }
      };
      document.getElementById('mailTest').onsubmit = async event => {
        event.preventDefault();
        const out = document.getElementById('mailResult');
        out.classList.remove('hidden');
        out.textContent = '正在连接 SMTP 并实际发送测试邮件…';
        try {
          await api('/api/admin/mail/test', {method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))});
          out.textContent = '测试邮件发送成功。';
        } catch (error) {
          out.textContent = error.message;
        }
      };
      document.querySelectorAll('[data-brand]').forEach(form => form.onsubmit = uploadBrandV2);
    } catch (error) {
      $('#content').innerHTML = `<p class="notice">系统设置读取失败：${esc(error.message)}</p>`;
    }
  };
})();
