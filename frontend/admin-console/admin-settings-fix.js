(() => {
  const sameValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);

  // Keep the existing API surface, but make retries safe for both JSON and FormData.
  api = async function(path, options = {}) {
    const {_stepUp = false, headers: extraHeaders = {}, ...request} = options;
    const headers = {Authorization: `Bearer ${token}`, ...extraHeaders};
    if (!(request.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const response = await fetch(path, {...request, headers});
    const data = await response.json().catch(() => ({}));
    if (response.status === 428 && data.step_up_required && !_stepUp) {
      const code = prompt('此敏感操作需要管理员二次验证码。验证成功后 10 分钟内无需重复输入。');
      if (!code) throw new Error('已取消敏感操作');
      return api(path, {...options, _stepUp: true, headers: {...extraHeaders, 'X-GoJet-TOTP': code}});
    }
    if (!response.ok) throw new Error(data.error || `请求失败 ${response.status}`);
    return data;
  };

  // Every ordinary settings save is followed by a server read-back. A success
  // message therefore means the value was really persisted, not merely submitted.
  bindSettingForm = function(id, section) {
    const form = $('#'+id);
    if (!form) return;
    form.onsubmit = async event => {
      event.preventDefault();
      const values = {};
      for (const input of form.elements) {
        if (!input.name) continue;
        values[input.name] = input.type === 'checkbox'
          ? input.checked
          : input.type === 'number'
            ? Number(input.value)
            : input.dataset.list !== undefined
              ? input.value.split(',').map(value => value.trim()).filter(Boolean)
              : input.value;
      }
      try {
        await api(`/api/admin/settings/${section}`, {method: 'PUT', body: JSON.stringify(values)});
        const current = await api('/api/admin/settings');
        for (const [key, value] of Object.entries(values)) {
          if (!sameValue(current?.[section]?.[key], value)) {
            throw new Error(`服务器回读不一致：${key}`);
          }
        }
        alert('设置已保存，并已从服务器重新读取确认。');
        load('settings');
      } catch (error) {
        alert('保存失败：' + error.message);
      }
    };
  };

  uploadBrand = async function(event) {
    event.preventDefault();
    const form = event.target;
    const asset = form.dataset.brand;
    try {
      const result = await api(`/api/admin/brand/${asset}`, {method: 'POST', body: new FormData(form)});
      alert('品牌资产已上传并持久化：' + result.url);
      load('settings');
    } catch (error) {
      alert('品牌资产上传失败：' + error.message);
    }
  };

  function hydrateMail(settings) {
    const form = document.querySelector('#mailSettings');
    if (!form || !settings?.mail) return;
    const mail = settings.mail;
    for (const key of ['host','port','encryption','ehlo','username','from_email','from_name','reply_to']) {
      if (form.elements[key] && mail[key] !== undefined && mail[key] !== null) {
        form.elements[key].value = mail[key];
      }
    }
    if (form.elements.password) {
      form.elements.password.value = '';
      form.elements.password.placeholder = mail.password_configured
        ? '已保存密码；留空保持不变'
        : '尚未配置 SMTP 密码';
    }
    form.dataset.gojetHydrated = '1';
    form.onsubmit = async event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      values.port = Number(values.port);
      try {
        await api('/api/admin/settings/mail', {method: 'PUT', body: JSON.stringify(values)});
        const current = await api('/api/admin/settings');
        const saved = current.mail || {};
        for (const key of ['host','port','encryption','ehlo','username','from_email','from_name','reply_to']) {
          if (!sameValue(saved[key] ?? '', values[key] ?? '')) {
            throw new Error(`SMTP 设置回读不一致：${key}`);
          }
        }
        alert('SMTP 设置已加密保存，并已从服务器重新读取确认。');
        hydrateMail(current);
      } catch (error) {
        alert('SMTP 保存失败：' + error.message);
      }
    };
  }

  let hydrationRunning = false;
  async function patchSettingsView() {
    const mailForm = document.querySelector('#mailSettings');
    if (!mailForm || mailForm.dataset.gojetHotfixBound === '1' || hydrationRunning) return;
    mailForm.dataset.gojetHotfixBound = '1';
    hydrationRunning = true;
    try {
      const current = await api('/api/admin/settings');
      hydrateMail(current);
      document.querySelectorAll('.mailTemplate button').forEach(button => {
        if (button.textContent.includes('二次验证')) button.textContent = '保存模板';
      });
      const runtimeButton = document.querySelector('#runtimeSettings button');
      if (runtimeButton) runtimeButton.textContent = '保存运行时设置';
    } catch (error) {
      mailForm.dataset.gojetHotfixBound = '';
      console.error('GoJet settings hydration failed', error);
    } finally {
      hydrationRunning = false;
    }
  }

  const observer = new MutationObserver(() => patchSettingsView());
  observer.observe(document.documentElement, {childList: true, subtree: true});
  patchSettingsView();
})();
