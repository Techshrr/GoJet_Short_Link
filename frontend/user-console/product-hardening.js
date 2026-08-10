(()=>{
'use strict';
const q=s=>document.querySelector(s);
const esc=v=>escapeHTML(v??'');
const origin=()=>location.origin.replace(/\/$/,'');
const js=v=>String(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,' ');
const textURL=x=>`${origin()}/t/${encodeURIComponent(x.slug)}`;
const qrTarget=x=>x.domain?`https://${x.domain}/${encodeURIComponent(x.code)}`:`${origin()}/${encodeURIComponent(x.code)}`;
const formatName={plain:'纯文本',markdown:'Markdown 格式',code:'代码与日志'};
const textStatus={active:'正常分享',paused:'暂停分享',expired:'已过期',consumed:'已读取'};

function fmtDate(v){
  if(!v)return'—';
  const d=new Date(v);
  return Number.isNaN(d.valueOf())?String(v):d.toLocaleString('zh-CN',{hour12:false});
}
function toLocalDateTime(v){
  if(!v)return'';
  const d=new Date(v);if(Number.isNaN(d.valueOf()))return'';
  const z=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}
async function copy(value,button){
  try{
    if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(value);
    else{
      const input=document.createElement('textarea');input.value=value;input.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(input);input.select();
      if(!document.execCommand('copy'))throw new Error('copy failed');input.remove();
    }
    if(button){const old=button.textContent;button.textContent='已复制';setTimeout(()=>button.textContent=old,1200);}
  }catch{
    if(window.gojetMessage)await window.gojetMessage('无法自动复制','请选中页面中的分享地址后手动复制。');
  }
}
window.gojetCopy=copy;
function share(url,label='分享地址'){
  return `<div class="shareLine"><div><small>${esc(label)}</small><a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a></div><div class="shareActions"><button type="button" onclick="gojetCopy('${js(url)}',this)">复制</button><a class="button" href="${esc(url)}" target="_blank" rel="noopener">打开</a></div></div>`;
}
function badge(value,map){return `<span class="productStatus status-${esc(value)}">${esc(map[value]||value)}</span>`;}
function empty(icon,title,body,button){return `<div class="productEmpty"><div class="emptyIcon">${icon}</div><h3>${esc(title)}</h3><p>${esc(body)}</p>${button||''}</div>`;}

async function texts(){
  const c=q('.content');
  c.innerHTML=`<div class="productPageHead"><div><h1>文本分享</h1><p>创建普通文本、Markdown 格式或代码内容，每份内容都有可以直接复制的分享地址。</p></div><button class="primary" id="newTextShare">创建文本</button></div><div id="textEditorHost"></div><div id="textShareList" class="productLoading">正在加载文本…</div>`;
  q('#newTextShare').onclick=()=>openTextEditor();
  await loadTexts();
}
async function loadTexts(){
  const root=q('#textShareList');if(!root)return;
  try{
    const items=(await api(`/api/workspaces/${state.workspace}/text-shares`)).data||[];
    root.innerHTML=items.length?`<div class="resourceStack">${items.map(x=>{
      const url=textURL(x);
      return `<article class="shareCard"><div class="shareCardMain"><div class="resourceIcon textIcon">文</div><div class="resourceCopy"><div class="resourceTitleRow"><h2>${esc(x.title)}</h2>${badge(x.status,textStatus)}</div>${share(url)}<div class="miniMeta"><span>${esc(formatName[x.format]||x.format)}</span><span>${x.protected?'需要密码':'无需密码'}</span><span>${x.one_time?'一次性读取':'可重复读取'}</span><span>${Number(x.views||0).toLocaleString()} 次阅读</span><span>${x.expires_at?'有效至 '+fmtDate(x.expires_at):'长期有效'}</span></div></div></div><div class="resourceActions"><button onclick="gojetCopy('${js(url)}',this)">复制地址</button><a class="button" href="${esc(url)}" target="_blank" rel="noopener">打开</a><button onclick="editTextShare(${Number(x.id)})">编辑</button><button class="danger" onclick="deleteTextShare(${Number(x.id)})">删除</button></div></article>`;
    }).join('')}</div>`:empty('文','还没有文本分享','创建一份文本后，就可以复制分享地址发送给其他人。','<button class="primary" onclick="showProductTextEditor()">创建第一份文本</button>');
  }catch(err){root.innerHTML=`<div class="productError">${esc(err.message)}</div>`;}
}
async function openTextEditor(id=0){
  let item={title:'',content:'',format:'plain',status:'active',one_time:false,protected:false,expires_at:null};
  if(id)item=await api(`/api/workspaces/${state.workspace}/text-shares/${id}`);
  const host=q('#textEditorHost');if(!host)return;
  host.innerHTML=`<section class="textComposer"><div class="composerTop"><div><h2>${id?'编辑文本':'创建文本分享'}</h2><p>${id?'修改内容或访问规则，原分享地址保持不变。':'选择合适的展示方式，再设置密码、有效期和读取规则。'}</p></div><button type="button" id="closeTextEditor">关闭</button></div><form id="textShareEditor"><div class="formGrid"><label>标题<input name="title" value="${esc(item.title||'')}" maxlength="255" required></label><label>内容格式<select name="format" id="textFormat"><option value="plain" ${item.format==='plain'?'selected':''}>纯文本</option><option value="markdown" ${item.format==='markdown'?'selected':''}>Markdown 格式</option><option value="code" ${item.format==='code'?'selected':''}>代码与日志</option></select></label></div><div class="editorSplit"><label class="editorPane"><span>正文</span><textarea name="content" spellcheck="false" maxlength="1000000" required>${esc(item.content||'')}</textarea></label><div class="previewPane"><span>格式说明</span><div id="textFormatHelp"></div></div></div><div class="formGrid"><label>访问密码（可选）<input name="password" type="password" minlength="6" maxlength="128" placeholder="${id&&item.protected?'留空保持现有密码':'至少 6 位'}"></label><label>有效期（可选）<input name="expires_at" type="datetime-local" value="${esc(toLocalDateTime(item.expires_at))}"></label><label>分享状态<select name="status"><option value="active" ${item.status==='active'?'selected':''}>正常分享</option><option value="paused" ${item.status==='paused'?'selected':''}>暂停分享</option></select></label><label class="productCheck"><input name="one_time" type="checkbox" ${item.one_time?'checked':''}>读取一次后自动失效</label>${id&&item.protected?'<label class="productCheck"><input name="clear_password" type="checkbox">清除现有访问密码</label>':''}</div><div id="textEditorError"></div><button class="primary">${id?'保存修改':'创建并获取分享地址'}</button></form></section>`;
  q('#closeTextEditor').onclick=()=>{host.innerHTML='';};
  const updateHelp=()=>{
    const mode=q('#textFormat').value;
    q('#textFormatHelp').innerHTML=mode==='markdown'?'<h3>Markdown 格式</h3><p>适合说明文档和带标题、列表、引用的内容，分享页会按格式排版。</p>':mode==='code'?'<h3>代码与日志</h3><p>适合代码片段和日志，使用等宽字体展示，不会执行其中内容。</p>':'<h3>纯文本</h3><p>保持原有换行和空格，适合普通文字。</p>';
  };
  q('#textFormat').onchange=updateHelp;updateHelp();
  q('#textShareEditor').onsubmit=async e=>{
    e.preventDefault();
    const f=Object.fromEntries(new FormData(e.currentTarget));
    const payload={title:f.title,content:f.content,format:f.format,status:f.status,one_time:f.one_time==='on',expires_at:f.expires_at?new Date(f.expires_at).toISOString():null};
    if(id){if(f.clear_password==='on')payload.password='';else if(f.password)payload.password=f.password;}else if(f.password)payload.password=f.password;
    try{
      if(id){
        await api(`/api/workspaces/${state.workspace}/text-shares/${id}`,{method:'PUT',body:JSON.stringify(payload)});
        host.innerHTML='<div class="productSuccess">文本分享已经更新。</div>';
      }else{
        const created=await api(`/api/workspaces/${state.workspace}/text-shares`,{method:'POST',body:JSON.stringify(payload)});
        host.innerHTML=`<div class="shareCreated"><b>文本分享已经创建</b>${share(textURL(created))}</div>`;
      }
      await loadTexts();
    }catch(err){q('#textEditorError').innerHTML=`<div class="productError">${esc(err.message)}</div>`;}
  };
}
window.showProductTextEditor=()=>openTextEditor();
window.editTextShare=id=>openTextEditor(id);
window.deleteTextShare=async id=>{
  const ok=window.gojetConfirm?await window.gojetConfirm('删除文本分享','删除后分享地址会立即失效，且无法恢复。','确认删除'):false;
  if(!ok)return;
  await api(`/api/workspaces/${state.workspace}/text-shares/${id}`,{method:'DELETE'});
  await loadTexts();
};

async function qrs(preselected=0){
  const c=q('.content');
  c.innerHTML=`<div class="productPageHead"><div><h1>二维码</h1><p>从正在使用的短链接生成二维码。以后修改短链接目标时，二维码仍然可以继续使用。</p></div><button class="primary" id="newQRCode">创建二维码</button></div><div id="qrEditorHost"></div><div id="qrCodeList" class="productLoading">正在加载二维码…</div>`;
  q('#newQRCode').onclick=()=>openQREditor(preselected);
  await loadQRs();
  if(preselected)await openQREditor(preselected);
}
async function loadQRs(){
  const root=q('#qrCodeList');if(!root)return;
  try{
    const items=(await api(`/api/workspaces/${state.workspace}/qr-codes`)).data||[];
    root.innerHTML=items.length?`<div class="resourceCards qrCards">${items.map(x=>{
      const target=qrTarget(x);
      return `<article><div class="resourceTitleRow"><h2>${esc(x.name)}</h2><span class="productStatus">${Number(x.qr_visits||0).toLocaleString()} 次访问</span></div><img src="${esc(x.image_url)}" alt="二维码" loading="lazy"><div class="qrTarget"><small>二维码对应的短网址</small><a href="${esc(target)}" target="_blank" rel="noopener">${esc(target)}</a></div><div class="miniMeta"><span>${Number(x.size||0).toLocaleString()} 像素</span><span>${fmtDate(x.created_at)}</span></div><div class="resourceActions"><button onclick="gojetCopy('${js(target)}',this)">复制短网址</button><a class="button" href="${esc(target)}" target="_blank" rel="noopener">打开短网址</a><a class="button" href="${esc(x.image_url)}" download>下载图片</a><button class="danger" onclick="deleteQRCode(${Number(x.id)})">删除</button></div></article>`;
    }).join('')}</div>`:empty('▦','还没有二维码','选择一条正在使用的短链接，即可生成对应二维码。','<button class="primary" onclick="openQRCodeEditor()">创建第一个二维码</button>');
  }catch(err){root.innerHTML=`<div class="productError">${esc(err.message)}</div>`;}
}
async function openQREditor(linkID=0){
  const links=(await api(`/api/workspaces/${state.workspace}/links?limit=100&offset=0`)).data||[];
  const active=links.filter(x=>x.status==='active');
  const host=q('#qrEditorHost');if(!host)return;
  if(!active.length){host.innerHTML='<div class="notice">请先创建一条正在使用的短链接，再生成二维码。</div>';return;}
  const selected=active.some(x=>Number(x.id)===Number(linkID))?Number(linkID):Number(active[0].id);
  host.innerHTML=`<section class="resourceEditor"><div class="composerTop"><div><h2>创建二维码</h2><p>选择短链接并设置图片尺寸和颜色。</p></div><button type="button" id="closeQREditor">关闭</button></div><form id="qrEditor"><div class="formGrid"><label>二维码名称<input name="name" maxlength="120" placeholder="例如：产品宣传页" required></label><label>对应短链接<select name="link_id">${active.map(x=>`<option value="${Number(x.id)}" ${Number(x.id)===selected?'selected':''}>${esc('/'+x.code+' · '+(x.title||x.destination||''))}</option>`).join('')}</select></label><label>前景色<input name="foreground" type="color" value="#14231d"></label><label>背景色<input name="background" type="color" value="#ffffff"></label><label>图片尺寸<select name="size"><option value="512">512 像素</option><option value="768">768 像素</option><option value="1024" selected>1024 像素</option><option value="1536">1536 像素</option><option value="2048">2048 像素</option></select></label></div><div id="qrEditorError"></div><button class="primary">生成二维码</button></form></section>`;
  q('#closeQREditor').onclick=()=>{host.innerHTML='';};
  q('#qrEditor').onsubmit=async e=>{
    e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));
    try{
      await api(`/api/workspaces/${state.workspace}/qr-codes`,{method:'POST',body:JSON.stringify({name:f.name,link_id:Number(f.link_id),foreground:f.foreground,background:f.background,size:Number(f.size)})});
      host.innerHTML='<div class="productSuccess">二维码已经生成，可以下载图片或复制对应短网址。</div>';
      await loadQRs();
    }catch(err){q('#qrEditorError').innerHTML=`<div class="productError">${esc(err.message)}</div>`;}
  };
}
window.openQRCodeEditor=()=>openQREditor();
window.deleteQRCode=async id=>{
  const ok=window.gojetConfirm?await window.gojetConfirm('删除二维码','删除后二维码图片会失效，无法恢复。','确认删除'):false;
  if(!ok)return;
  await api(`/api/workspaces/${state.workspace}/qr-codes/${id}`,{method:'DELETE'});
  await loadQRs();
};
window.gojetOpenQR=async id=>{
  history.pushState({view:'qrs'},'',`/app/qr?link=${Number(id)}`);
  document.querySelectorAll('[data-console-view]').forEach(x=>x.classList.toggle('active',x.dataset.consoleView==='qrs'));
  await qrs(Number(id));
};

window.GoJetProductHardening=window.GoJetProductHardening||{};
window.GoJetProductHardening.texts=texts;
window.GoJetProductHardening.qrs=qrs;
})();
