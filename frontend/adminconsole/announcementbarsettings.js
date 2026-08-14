(()=>{
'use strict';
const q=(s,r=document)=>r.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let busy=false;
const toLocal=value=>{if(!value)return'';const date=new Date(value);if(Number.isNaN(date.valueOf()))return'';const local=new Date(date.getTime()-date.getTimezoneOffset()*60000);return local.toISOString().slice(0,16)};
const toISO=value=>{if(!value)return'';const date=new Date(value);return Number.isNaN(date.valueOf())?'':date.toISOString()};
async function install(){
  const nav=q('.ah-settings-nav'),main=q('.ah-settings-main');
  if(!nav||!main||q('[data-announcementbar-tab]')||busy)return;
  busy=true;
  try{
    const all=await api('/api/admin/settings'),settings=all.announcementbar||{};
    const tab=document.createElement('button');tab.type='button';tab.dataset.announcementbarTab='1';tab.innerHTML='<b>顶部飘窗</b><small>导航栏上方的优惠与重要事项</small>';
    const pane=document.createElement('form');pane.className='ah-settings-pane hidden';pane.dataset.announcementbarPane='1';
    pane.innerHTML=`<div class="ah-pane-head"><div><h2>顶部飘窗</h2><p>在官网导航栏上方显示一条全宽公告。内容、链接、展示时间和关闭方式均由这里控制。</p></div><button class="btn primary">保存设置</button></div><div class="ah-settings-grid">
      <label class="ah-switch full"><span><b>启用顶部飘窗</b><small>关闭后官网立即停止显示，不影响公告中心。</small></span><input name="announcementbar.enabled" type="checkbox" ${settings['announcementbar.enabled']?'checked':''}></label>
      <label><span>短标题</span><input name="announcementbar.title" maxlength="80" value="${esc(settings['announcementbar.title']||'')}"></label>
      <label><span>提示级别</span><select name="announcementbar.tone"><option value="info" ${settings['announcementbar.tone']==='info'?'selected':''}>信息</option><option value="success" ${settings['announcementbar.tone']==='success'?'selected':''}>优惠 / 成功</option><option value="warning" ${settings['announcementbar.tone']==='warning'?'selected':''}>重要提醒</option></select></label>
      <label class="full"><span>正文</span><textarea name="announcementbar.message" rows="3" maxlength="240" placeholder="例如：年度套餐限时优惠，活动将在本月底结束。">${esc(settings['announcementbar.message']||'')}</textarea></label>
      <label><span>链接文字</span><input name="announcementbar.link_text" maxlength="40" value="${esc(settings['announcementbar.link_text']||'')}"></label>
      <label><span>链接地址</span><input name="announcementbar.link_url" placeholder="/pricing 或 https://..." value="${esc(settings['announcementbar.link_url']||'')}"></label>
      <label><span>开始显示（可选）</span><input name="announcementbar.starts_at" type="datetime-local" value="${esc(toLocal(settings['announcementbar.starts_at']))}"></label>
      <label><span>停止显示（可选）</span><input name="announcementbar.ends_at" type="datetime-local" value="${esc(toLocal(settings['announcementbar.ends_at']))}"></label>
      <label class="ah-switch full"><span><b>允许访客关闭</b><small>访客关闭后，本次浏览器会话内不再显示。</small></span><input name="announcementbar.dismissible" type="checkbox" ${settings['announcementbar.dismissible']!==false?'checked':''}></label>
      <div class="announcementBarPreview full"><small>官网预览</small><div data-announcement-preview></div></div>
    </div><div class="ah-save-result"></div>`;
    nav.append(tab);main.append(pane);
    const preview=()=>{const title=q('[name="announcementbar.title"]',pane).value.trim(),message=q('[name="announcementbar.message"]',pane).value.trim(),link=q('[name="announcementbar.link_text"]',pane).value.trim();q('[data-announcement-preview]',pane).innerHTML=`<b>${esc(title||'最新消息')}</b><span>${esc(message||'这里显示优惠、维护通知或重要事项。')}</span>${link?`<em>${esc(link)} →</em>`:''}`};
    pane.addEventListener('input',preview);preview();
    tab.onclick=()=>{document.querySelectorAll('[data-ah-tab]').forEach(node=>node.classList.remove('active'));document.querySelectorAll('[data-ah-pane]').forEach(node=>node.classList.add('hidden'));nav.querySelectorAll('button').forEach(node=>node.classList.remove('active'));main.querySelectorAll('.ah-settings-pane').forEach(node=>node.classList.add('hidden'));tab.classList.add('active');pane.classList.remove('hidden')};
    pane.onsubmit=async event=>{event.preventDefault();const payload={};pane.querySelectorAll('input,select,textarea').forEach(el=>{if(!el.name)return;if(el.type==='checkbox')payload[el.name]=el.checked;else if(el.type==='datetime-local')payload[el.name]=toISO(el.value);else payload[el.name]=el.value.trim()});const result=q('.ah-save-result',pane);try{await api('/api/admin/settings/announcementbar',{method:'PUT',body:JSON.stringify(payload)});result.textContent='已保存，官网会读取最新设置。';result.className='ah-save-result ok';if(typeof toast==='function')toast('顶部飘窗设置已保存')}catch(error){result.textContent=error.message;result.className='ah-save-result bad';if(typeof fail==='function')fail(error.message)}};
  }catch(error){console.error('announcement bar settings',error)}finally{busy=false}
}
new MutationObserver(()=>void install()).observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void install(),{once:true});else void install();
})();