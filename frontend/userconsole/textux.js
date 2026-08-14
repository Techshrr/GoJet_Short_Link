(()=>{
'use strict';
const $=s=>document.querySelector(s),E=v=>escapeHTML(v??''),origin=()=>location.origin.replace(/\/$/,'');
const textURL=x=>`${origin()}/t/${encodeURIComponent(x.slug)}`;
const statusText={active:'正常分享',paused:'暂停分享',expired:'已过期',consumed:'已读取'};
const modeText={plain:'纯文本',markdown:'Markdown',code:'代码'};
let currentItems=[];
function fmt(v){if(!v)return'—';const d=new Date(v);return Number.isNaN(d.valueOf())?String(v):d.toLocaleString('zh-CN',{hour12:false})}
function localDT(v){if(!v)return'';const d=new Date(v);if(Number.isNaN(d.valueOf()))return'';const z=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`}
function js(v){return String(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,' ')}
function safeMarkdown(source){
 let html=E(source||'');
 html=html.replace(/```([\s\S]*?)```/g,(_,code)=>`<pre><code>${code.replace(/^\n|\n$/g,'')}</code></pre>`);
 html=html.replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>');
 html=html.replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>').replace(/^[-*] (.+)$/gm,'<li>$1</li>');
 html=html.replace(/(<li>.*<\/li>\n?)+/g,m=>`<ul>${m}</ul>`);
 html=html.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
 html=html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
 return html.split(/\n{2,}/).map(block=>/^<(h\d|pre|ul|blockquote)/.test(block)?block:`<p>${block.replace(/\n/g,'<br>')}</p>`).join('');
}
function copyAddress(url,button){if(window.gojetCopy)return window.gojetCopy(url,button);return navigator.clipboard?.writeText(url)}
async function renderTexts(){
 const c=$('.content');
 c.innerHTML=`<div class="productPageHead textPageHead"><div><span class="eyebrow">CONTENT SHARE</span><h1>文本分享</h1><p>用同一个工作台创建纯文本、Markdown 或代码内容；编辑与内容列表不会同时争抢页面空间。</p></div><button class="primary" id="textCreate">创建文本</button></div><div id="textWorkspace"></div>`;
 $('#textCreate').onclick=()=>renderEditor();
 await renderList();
}
async function renderList(){
 const host=$('#textWorkspace');if(!host)return;
 host.innerHTML='<div class="productLoading">正在加载文本…</div>';
 try{currentItems=(await api(`/api/workspaces/${state.workspace}/text-shares`)).data||[];}catch(err){host.innerHTML=`<div class="productError">${E(err.message)}</div>`;return}
 if(!currentItems.length){host.innerHTML=`<section class="textEmptyState"><div class="textEmptyGlyph">T</div><h2>还没有文本分享</h2><p>创建第一份内容后，这里会显示分享地址、状态和阅读数据。</p><button class="primary" id="textEmptyCreate">创建第一份文本</button></section>`;$('#textEmptyCreate').onclick=()=>renderEditor();return}
 host.innerHTML=`<div class="textLibrary">${currentItems.map(item=>{const url=textURL(item);return`<article class="textLibraryItem"><div class="textLibraryMain"><div class="textModeBadge">${E(modeText[item.format]||item.format)}</div><div class="textLibraryCopy"><div class="textLibraryTitle"><h2>${E(item.title)}</h2><span class="productStatus status-${E(item.status)}">${E(statusText[item.status]||item.status)}</span></div><a href="${E(url)}" target="_blank" rel="noopener" class="textShareURL">${E(url)}</a><div class="textLibraryMeta"><span>${Number(item.views||0).toLocaleString()} 次阅读</span><span>${item.protected?'密码保护':'公开访问'}</span><span>${item.one_time?'读取一次后失效':'可重复读取'}</span><span>${item.expires_at?'有效至 '+fmt(item.expires_at):'长期有效'}</span></div></div></div><div class="textLibraryActions"><button onclick="gojetTextCopy('${js(url)}',this)">复制地址</button><a class="button" href="${E(url)}" target="_blank" rel="noopener">打开</a><button onclick="gojetTextEdit(${Number(item.id)})">编辑</button><button class="danger" onclick="gojetTextDelete(${Number(item.id)})">删除</button></div></article>`}).join('')}</div>`;
}
async function renderEditor(id=0){
 let item={title:'',content:'',format:'plain',status:'active',one_time:false,protected:false,expires_at:null};
 if(id){try{item=await api(`/api/workspaces/${state.workspace}/text-shares/${id}`)}catch(err){window.gojetMessage?.('无法打开文本',err.message);return}}
 const host=$('#textWorkspace');if(!host)return;
 $('#textCreate')?.classList.add('hidden');
 host.innerHTML=`<section class="textAuthoring"><header class="textAuthoringHead"><div><button type="button" class="textBack" id="textBack">← 返回文本列表</button><h2>${id?'编辑文本分享':'创建文本分享'}</h2><p>${id?'修改内容与访问规则，原分享地址保持不变。':'先选择内容类型，再专注编辑；需要的访问限制放在下方设置。'}</p></div><div class="textAuthoringActions"><button type="button" id="textCancel">取消</button><button class="primary" type="submit" form="textAuthorForm">${id?'保存修改':'创建并获取地址'}</button></div></header><form id="textAuthorForm"><div class="textAuthorTop"><label class="textTitleField"><span>标题</span><input name="title" value="${E(item.title||'')}" maxlength="255" placeholder="给这份内容一个清晰的标题" required></label><fieldset class="textModePicker"><legend>内容类型</legend><div role="radiogroup" aria-label="内容类型">${[['plain','纯文本','适合说明、便签和原样文字'],['markdown','Markdown','适合文档、列表和结构化说明'],['code','代码','适合代码片段、配置和日志']].map(([v,n,d])=>`<label class="textModeOption ${item.format===v?'selected':''}" data-text-mode-option="${v}"><input type="radio" name="format" value="${v}" ${item.format===v?'checked':''}><span><b>${n}</b><small>${d}</small></span></label>`).join('')}</div></fieldset></div><div class="textEditorWorkspace" data-mode="${E(item.format)}"><section class="textSourcePane"><div class="textPaneHead"><b id="textSourceLabel">${item.format==='code'?'代码内容':item.format==='markdown'?'Markdown 源文':'正文'}</b><span id="textSourceHint"></span></div><textarea name="content" id="textContent" spellcheck="${item.format==='plain'?'true':'false'}" maxlength="1000000" required placeholder="开始输入内容…">${E(item.content||'')}</textarea></section><section class="textPreviewPane" id="textPreviewPane"><div class="textPaneHead"><b>预览</b><span id="textPreviewMode"></span></div><div class="textPreviewBody" id="textPreviewBody"></div></section></div><details class="textAccessSettings"><summary><span><b>访问设置</b><small>密码、有效期、状态和一次性读取</small></span><i aria-hidden="true"></i></summary><div class="textAccessGrid"><label>访问密码（可选）<input name="password" type="password" minlength="6" maxlength="128" placeholder="${id&&item.protected?'留空保持现有密码':'至少 6 位'}"></label><label>有效期（可选）<input name="expires_at" type="datetime-local" value="${E(localDT(item.expires_at))}"></label><label>分享状态<select name="status"><option value="active" ${item.status==='active'?'selected':''}>正常分享</option><option value="paused" ${item.status==='paused'?'selected':''}>暂停分享</option></select></label><label class="productCheck"><input name="one_time" type="checkbox" ${item.one_time?'checked':''}> 读取一次后自动失效</label>${id&&item.protected?'<label class="productCheck"><input name="clear_password" type="checkbox"> 清除现有访问密码</label>':''}</div></details><div id="textAuthorError"></div></form></section>`;
 const leave=async()=>{$('#textCreate')?.classList.remove('hidden');await renderList()};$('#textBack').onclick=leave;$('#textCancel').onclick=leave;
 const modeInputs=[...document.querySelectorAll('input[name="format"]')],content=$('#textContent');
 function refreshMode(){const mode=document.querySelector('input[name="format"]:checked')?.value||'plain';document.querySelectorAll('[data-text-mode-option]').forEach(x=>x.classList.toggle('selected',x.dataset.textModeOption===mode));const workspace=document.querySelector('.textEditorWorkspace');workspace.dataset.mode=mode;content.spellcheck=mode==='plain';$('#textSourceLabel').textContent=mode==='code'?'代码内容':mode==='markdown'?'Markdown 源文':'正文';$('#textSourceHint').textContent=mode==='code'?'按原样展示，不执行代码':mode==='markdown'?'支持标题、列表、引用、链接与代码块':'保持换行与空格';$('#textPreviewMode').textContent=modeText[mode];renderPreview()}
 function renderPreview(){const mode=document.querySelector('input[name="format"]:checked')?.value||'plain',value=content.value||'';const out=$('#textPreviewBody');if(mode==='markdown')out.innerHTML=value?safeMarkdown(value):'<p class="textPreviewEmpty">输入 Markdown 后，这里显示阅读效果。</p>';else if(mode==='code')out.innerHTML=value?`<pre><code>${E(value)}</code></pre>`:'<p class="textPreviewEmpty">输入代码后，这里显示原样预览。</p>';else out.innerHTML=value?`<div class="plainPreview">${E(value).replace(/\n/g,'<br>')}</div>`:'<p class="textPreviewEmpty">输入正文后，这里显示阅读效果。</p>'}
 modeInputs.forEach(x=>x.onchange=refreshMode);content.oninput=renderPreview;refreshMode();
 $('#textAuthorForm').onsubmit=async event=>{event.preventDefault();const f=Object.fromEntries(new FormData(event.currentTarget));const payload={title:String(f.title||'').trim(),content:f.content,format:f.format,status:f.status,one_time:f.one_time==='on',expires_at:f.expires_at?new Date(f.expires_at).toISOString():null};if(id){if(f.clear_password==='on')payload.password='';else if(f.password)payload.password=f.password}else if(f.password)payload.password=f.password;const button=document.querySelector('[form="textAuthorForm"]');button.disabled=true;try{let saved;if(id){saved=await api(`/api/workspaces/${state.workspace}/text-shares/${id}`,{method:'PUT',body:JSON.stringify(payload)})}else{saved=await api(`/api/workspaces/${state.workspace}/text-shares`,{method:'POST',body:JSON.stringify(payload)})}if(!id){const url=textURL(saved);host.innerHTML=`<section class="textCreated"><span class="eyebrow">CREATED</span><h2>文本分享已经创建</h2><p>分享地址已经可用。</p><div class="textCreatedURL"><a href="${E(url)}" target="_blank" rel="noopener">${E(url)}</a><button onclick="gojetTextCopy('${js(url)}',this)">复制地址</button></div><div class="textCreatedActions"><button id="textCreatedDone" class="primary">完成</button></div></section>`;$('#textCreatedDone').onclick=leave}else{await leave()}}catch(err){$('#textAuthorError').innerHTML=`<div class="productError">${E(err.message)}</div>`;button.disabled=false}}
}
window.gojetTextCopy=copyAddress;
window.gojetTextEdit=id=>renderEditor(id);
window.gojetTextDelete=async id=>{const ok=window.gojetConfirm?await window.gojetConfirm('删除文本分享','删除后分享地址会立即失效，且无法恢复。','确认删除'):false;if(!ok)return;await api(`/api/workspaces/${state.workspace}/text-shares/${id}`,{method:'DELETE'});await renderList()};
window.showProductTextEditor=()=>renderEditor();
window.editTextShare=id=>renderEditor(id);
window.GoJetPages=window.GoJetPages||{};window.GoJetPages.texts=renderTexts;
})();