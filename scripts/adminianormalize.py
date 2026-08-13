#!/usr/bin/env python3
from pathlib import Path


def replace_once(path, old, new):
    p=Path(path); text=p.read_text(encoding='utf-8')
    count=text.count(old)
    if count!=1: raise SystemExit(f'{path}: expected one occurrence, got {count}: {old}')
    p.write_text(text.replace(old,new,1),encoding='utf-8')

replace_once('frontend/adminconsole/index.html','      <button data-view="mail" data-permission="mail.manage">邮件服务</button>\n','')

replace_once('frontend/adminconsole/app.js',",mail:'邮件中心'",'')
replace_once('frontend/adminconsole/app.js',"if(view==='mail')return renderMail();",'')
replace_once('frontend/adminconsole/app.js','async function renderMail(){','async function renderMailSettings(){')

replace_once('frontend/adminconsole/mailstatus.js','const originalRenderMail=renderMail;\nrenderMail=async function(){','const originalRenderMail=renderMailSettings;\nrenderMailSettings=async function(){')

support=Path('frontend/adminconsole/supportsecurity.js')
text=support.read_text(encoding='utf-8')
old='''const mailButton=nav.querySelector('[data-view="mail"]');
function addNav(view,permission,label){if(nav.querySelector(`[data-view="${view}"]`))return;const b=document.createElement('button');b.dataset.view=view;b.dataset.permission=permission;b.textContent=label;nav.insertBefore(b,mailButton||null)}
addNav('tickets','tickets.manage','客户工单');
addNav('botprotection','settings.manage','人机验证');
titles.tickets='客户工单';titles.botprotection='人机验证';permissionNames['tickets.manage']='工单管理';
const oldGeneric=renderGeneric;
renderGeneric=async function(view){if(view==='tickets')return renderSupportQueue();if(view==='botprotection')return renderBotProtection();return oldGeneric(view)};'''
new='''const billingButton=nav.querySelector('[data-view="billing"]');
function addNav(view,permission,label){if(nav.querySelector(`[data-view="${view}"]`))return;const b=document.createElement('button');b.dataset.view=view;b.dataset.permission=permission;b.textContent=label;nav.insertBefore(b,billingButton||null)}
addNav('tickets','tickets.manage','客户工单');
titles.tickets='客户工单';permissionNames['tickets.manage']='工单管理';
const oldGeneric=renderGeneric;
renderGeneric=async function(view){if(view==='tickets')return renderSupportQueue();return oldGeneric(view)};'''
if text.count(old)!=1: raise SystemExit('support navigation contract not found')
text=text.replace(old,new,1)
if text.count('async function renderBotProtection(){')!=1: raise SystemExit('bot protection renderer not found')
text=text.replace('async function renderBotProtection(){','async function renderBotProtectionSettings(){',1)
ending='''await api('/api/admin/bot-protection',{method:'PUT',body:JSON.stringify(payload)});toast('人机验证设置已保存');renderBotProtection()}}
})();'''
replacement='''await api('/api/admin/bot-protection',{method:'PUT',body:JSON.stringify(payload)});toast('人机验证设置已保存');renderBotProtectionSettings()}}
window.renderBotProtectionSettings=renderBotProtectionSettings;
})();'''
if text.count(ending)!=1: raise SystemExit('bot protection ending contract not found')
text=text.replace(ending,replacement,1)
support.write_text(text,encoding='utf-8')

settings=Path('frontend/adminconsole/settings.js')
text=settings.read_text(encoding='utf-8')
old="${tab('payments','支付方式','账单在线支付渠道')}${tab('brand','品牌与视觉','Logo、浏览器图标与主品牌色')}"
new="${tab('payments','支付方式','账单在线支付渠道')}${tab('mail','邮件服务','SMTP、模板与投递状态')}${tab('botprotection','人机验证','Turnstile 与防机器人场景')}${tab('brand','品牌与视觉','Logo、浏览器图标与主品牌色')}"
if text.count(old)!=1: raise SystemExit('settings tab insertion point not found')
text=text.replace(old,new,1)
old="function openUnifiedTab(id){sessionStorage.setItem('gojet_settings_tab',id);UQA('[data-ah-tab]').forEach(b=>b.classList.toggle('active',b.dataset.ahTab===id));UQA('[data-ah-pane]').forEach(p=>p.classList.toggle('hidden',p.dataset.ahPane!==id))}"
new="""async function openUnifiedTab(id){
 sessionStorage.setItem('gojet_settings_tab',id);
 if(id==='mail'){await renderMailSettings();attachSettingsBack('邮件服务');return}
 if(id==='botprotection'){await window.renderBotProtectionSettings();attachSettingsBack('人机验证');return}
 UQA('[data-ah-tab]').forEach(b=>b.classList.toggle('active',b.dataset.ahTab===id));UQA('[data-ah-pane]').forEach(p=>p.classList.toggle('hidden',p.dataset.ahPane!==id))
}
function attachSettingsBack(label){const actions=UQ('.page-actions');if(actions&&!UQ('[data-settings-back]',actions)){actions.insertAdjacentHTML('afterbegin',`<button type=\"button\" class=\"btn\" data-settings-back>返回系统设置</button>`);UQ('[data-settings-back]',actions).onclick=()=>{sessionStorage.setItem('gojet_settings_tab','basic');renderSettings()}}const head=UQ('.page-head h2');if(head)head.textContent=`系统设置 · ${label}`}"""
if text.count(old)!=1: raise SystemExit('openUnifiedTab contract not found')
text=text.replace(old,new,1)
text=text.replace("pageHead('系统设置','管理站点信息、账户规则、短链接、支付方式和品牌视觉。')","pageHead('系统设置','管理站点、账户、短链接、支付、邮件、人机验证与品牌视觉。')",1)
settings.write_text(text,encoding='utf-8')

for path in ['frontend/adminconsole/index.html','frontend/adminconsole/app.js','frontend/adminconsole/mailstatus.js','frontend/adminconsole/settings.js','frontend/adminconsole/supportsecurity.js']:
    text=Path(path).read_text(encoding='utf-8')
    if 'data-view="botprotection"' in text or 'data-view="mail"' in Path('frontend/adminconsole/index.html').read_text(encoding='utf-8'):
        raise SystemExit('top-level configuration navigation remains')
print('Administrator settings information architecture normalized')
