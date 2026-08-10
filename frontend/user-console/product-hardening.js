(()=>{
  const qs=s=>document.querySelector(s);
  const origin=()=>location.origin.replace(/\/$/,'');
  const html=v=>escapeHTML(v??'');
  const fmtDate=v=>date(v);
  const fmtNumber=v=>number(v);

  function shortURL(link){
    const code=link.Code??link.code??'';
    const domain=link.Domain??link.domain??'';
    return domain?`https://${domain}/${encodeURIComponent(code)}`:`${origin()}/${encodeURIComponent(code)}`;
  }
  function textURL(item){return `${origin()}/t/${encodeURIComponent(item.slug)}`}
  function fileURL(item){return `${origin()}/api/public/files/${encodeURIComponent(item.slug)}`}
  function qrSourceURL(item){
    const code=item.code??item.Code??'';
    const domain=item.domain??item.Domain??'';
    return domain?`https://${domain}/${encodeURIComponent(code)}`:`${origin()}/${encodeURIComponent(code)}`;
  }
  async function copyValue(value,button){
    try{
      if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(value);
      else{
        const input=document.createElement('textarea');input.value=value;input.setAttribute('readonly','');input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();
        if(!document.execCommand('copy'))throw new Error('copy failed');input.remove();
      }
      if(button){const old=button.textContent;button.textContent='已复制';button.classList.add('copied');setTimeout(()=>{button.textContent=old;button.classList.remove('copied')},1400)}
    }catch{prompt('复制下面的地址',value)}
  }
  window.gojetCopy=(value,button)=>copyValue(value,button);

  function shareLine(url,label='公开地址'){
    return `<div class="shareLine"><div><small>${html(label)}</small><a href="${html(url)}" target="_blank" rel="noopener">${html(url)}</a></div><div class="shareActions"><button type="button" onclick="gojetCopy('${attrJS(url)}',this)">复制</button><a class="button" href="${html(url)}" target="_blank" rel="noopener">打开</a></div></div>`;
  }
  function attrJS(v){return String(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,' ')}
  function emptyState(title,body,action=''){
    return `<div class="productEmpty"><div class="emptyIcon">↗</div><h3>${html(title)}</h3><p>${html(body)}</p>${action}</div>`;
  }
  function statusPill(value,map={}){return `<span class="productStatus status-${html(value)}">${html(map[value]||value)}</span>`}

  async function renderProductLinks(){
    const content=qs('.content');
    content.innerHTML=`<div class="productPageHead"><div><span class="eyebrow">URL SHORTENER</span><h1>短链接</h1><p>每条链接都应当是可以立即复制、打开、生成二维码和分析的完整分享资产。</p></div><button class="primary productPrimary" id="newLinkTop">创建短链接</button></div><div id="productLinks" class="productLoading">正在读取链接…</div>`;
    qs('#newLinkTop').onclick=()=>qs('#createButton')?.click();
    try{
      const result=await api(`/api/workspaces/${state.workspace}/links?limit=100&offset=0`);
      const items=result.data||[];
      state.links=items;
      qs('#productLinks').innerHTML=items.length?`<div class="resourceStack">${items.map(link=>{
        const url=shortURL(link),code=link.Code??link.code,destination=link.Destination??link.destination,title=link.Title??link.title||'未命名链接',status=link.Status??link.status;
        return `<article class="shareCard"><div class="shareCardMain"><div class="resourceIcon">↗</div><div class="resourceCopy"><div class="resourceTitleRow"><h2>${html(title)}</h2>${statusPill(status,{active:'启用',paused:'暂停',expired:'已过期'})}</div><a class="canonicalURL" href="${html(url)}" target="_blank" rel="noopener">${html(url)}</a><p class="destinationText" title="${html(destination)}">${html(destination)}</p><div class="miniMeta"><span>${fmtNumber(link.Clicks??link.clicks||0)} 点击</span><span>${fmtNumber(link.Visitors??link.visitors??link.UniqueVisitors??0)} 访客</span><span>${fmtDate(link.CreatedAt??link.created_at)}</span></div></div></div><div class="resourceActions"><button onclick="gojetCopy('${attrJS(url)}',this)">复制链接</button><a class="button" href="${html(url)}" target="_blank" rel="noopener">打开</a><button onclick="gojetOpenQR(${Number(link.ID??link.id)},'${attrJS(code)}')">二维码</button><button onclick="analytics(${Number(link.ID??link.id)},'${attrJS(code)}')">分析</button><button onclick="editLink(${Number(link.ID??link.id)})">编辑</button></div></article>`;
      }).join('')}</div>`:emptyState('还没有短链接','创建以后这里直接显示完整短网址，而不是让你自己拼接域名。','<button class="primary" onclick="document.querySelector(\'#createButton\').click()">创建第一条链接</button>');
    }catch(err){qs('#productLinks').innerHTML=`<div class="productError">${html(err.message)}</div>`}
  }
  window.renderProductLinks=renderProductLinks;

  window.gojetOpenQR=async(linkID,code)=>{
    history.pushState({view:'qrs'},'',`/app/qr?link=${linkID}`);
    document.querySelectorAll('[data-console-view]').forEach(x=>x.classList.toggle('active',x.dataset.consoleView==='qrs'));
    await renderProductQRs(linkID,code);
  };

  async function renderProductFiles(){
    const content=qs('.content');
    content.innerHTML=`<div class="productPageHead"><div><span class="eyebrow">FILE SHARING</span><h1>文件分享</h1><p>上传的是单个文件。文件先隔离扫描，确认安全后才生成可直接下载的公开地址。</p></div><button class="primary productPrimary" id="uploadFileTop">上传文件</button></div><div id="fileUploadPanel"></div><div id="productFiles" class="productLoading">正在读取文件…</div>`;
    qs('#uploadFileTop').onclick=showProductFileUploader;
    await loadProductFiles();
  }
  async function loadProductFiles(){
    const root=qs('#productFiles');if(!root)return;
    try{
      const items=(await api(`/api/workspaces/${state.workspace}/file-shares`)).data||[];
      root.innerHTML=items.length?`<div class="resourceStack">${items.map(item=>{
        const clean=item.scan_status==='clean'&&item.status==='active',url=fileURL(item);
        return `<article class="shareCard"><div class="shareCardMain"><div class="resourceIcon fileIcon">⇩</div><div class="resourceCopy"><div class="resourceTitleRow"><h2>${html(item.original_name)}</h2>${statusPill(item.scan_status,{pending:'等待扫描',scanning:'扫描中',clean:'可分享',infected:'病毒隔离',error:'扫描失败'})}</div>${clean?shareLine(url,'直接下载地址'):`<div class="pendingShare"><b>${item.scan_status==='infected'?'文件已隔离，不会公开':'安全扫描完成后才会出现公开下载地址'}</b><span>${html(item.scan_result||'')}</span></div>`}<div class="miniMeta"><span>${html(item.mime_type)}</span><span>${fileSize(item.size_bytes)}</span><span>${fmtNumber(item.downloads)} 次下载${item.max_downloads?' / 上限 '+fmtNumber(item.max_downloads):''}</span><span>${item.expires_at?'到期 '+fmtDate(item.expires_at):'长期有效'}</span></div></div></div><div class="resourceActions">${clean?`<button onclick="gojetCopy('${attrJS(url)}',this)">复制下载链接</button><a class="button" href="${html(url)}" target="_blank">测试下载</a>`:'<button onclick="loadProductFiles()">刷新状态</button>'}<button class="danger" onclick="deleteProductFile(${Number(item.id)})">删除</button></div></article>`;
      }).join('')}</div>`:emptyState('还没有文件','选择一个文件上传。不会把文件夹选择器冒充文件分享。','<button class="primary" onclick="showProductFileUploader()">选择单个文件</button>');
    }catch(err){root.innerHTML=`<div class="productError">${html(err.message)}</div>`}
  }
  window.loadProductFiles=loadProductFiles;
  window.showProductFileUploader=showProductFileUploader;
  function showProductFileUploader(){
    const host=qs('#fileUploadPanel');if(!host)return;
    host.innerHTML=`<section class="uploadPanel"><div class="dropZone" id="fileDropZone"><div class="dropIcon">＋</div><h3>选择或拖入一个文件</h3><p>单文件最大 100 MB。不会递归上传文件夹；上传完成后必须通过 ClamAV 才能公开。</p><input id="singleFileInput" type="file"><button type="button" id="chooseSingleFile">选择文件</button><div id="chosenFile"></div></div><div class="uploadOptions"><label>有效期（可选）<input id="fileExpiry" type="datetime-local"></label><label>最大下载次数（可选）<input id="fileMaxDownloads" type="number" min="1" placeholder="不限"></label></div><div id="uploadProgress" class="uploadProgress hidden"><i></i><span>0%</span></div><div id="fileUploadMessage"></div></section>`;
    const input=qs('#singleFileInput'),drop=qs('#fileDropZone');
    qs('#chooseSingleFile').onclick=()=>input.click();
    input.onchange=()=>prepareSingleFile(input.files?.[0]);
    ['dragenter','dragover'].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.add('dragging')}));
    ['dragleave','drop'].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.remove('dragging')}));
    drop.addEventListener('drop',e=>{const file=e.dataTransfer?.files?.[0];if(file)prepareSingleFile(file)});
  }
  function prepareSingleFile(file){
    if(!file)return;
    qs('#chosenFile').innerHTML=`<div class="chosenFile"><b>${html(file.name)}</b><span>${fileSize(file.size)}</span><button type="button" id="startSingleUpload" class="primary">上传并扫描</button></div>`;
    qs('#startSingleUpload').onclick=()=>uploadSingleFile(file);
  }
  function uploadSingleFile(file){
    const data=new FormData();data.append('file',file,file.name);
    const exp=qs('#fileExpiry')?.value,max=qs('#fileMaxDownloads')?.value;
    if(exp)data.append('expires_at',new Date(exp).toISOString());if(max)data.append('max_downloads',max);
    const xhr=new XMLHttpRequest();xhr.open('POST',`/api/workspaces/${state.workspace}/file-shares`);xhr.setRequestHeader('Authorization',`Bearer ${state.token}`);
    const bar=qs('#uploadProgress');bar.classList.remove('hidden');
    xhr.upload.onprogress=e=>{if(!e.lengthComputable)return;const pct=Math.round(e.loaded/e.total*100);bar.querySelector('i').style.width=`${pct}%`;bar.querySelector('span').textContent=`${pct}%`};
    xhr.onload=async()=>{let result={};try{result=JSON.parse(xhr.responseText||'{}')}catch{}if(xhr.status<200||xhr.status>=300){qs('#fileUploadMessage').innerHTML=`<div class="productError">${html(result.error||'上传失败')}</div>`;return}qs('#fileUploadMessage').innerHTML='<div class="productSuccess">上传完成，正在进行安全扫描。扫描通过后会自动出现可复制的公开下载地址。</div>';setTimeout(loadProductFiles,1000)};
    xhr.onerror=()=>qs('#fileUploadMessage').innerHTML='<div class="productError">网络中断，文件未完成上传。</div>';
    xhr.send(data);
  }
  window.deleteProductFile=async id=>{if(!confirm('删除后公开下载地址会立即失效。确定删除？'))return;await api(`/api/workspaces/${state.workspace}/file-shares/${id}`,{method:'DELETE'});loadProductFiles()};
  window.renderProductFiles=renderProductFiles;

  async function renderProductTexts(){
    const content=qs('.content');content.innerHTML=`<div class="productPageHead"><div><span class="eyebrow">TEXT SHARING</span><h1>文本分享</h1><p>支持纯文本、Markdown 和代码。每份内容都有独立公开地址，可设置密码、有效期和一次性读取。</p></div><button class="primary productPrimary" onclick="showProductTextEditor()">创建文本</button></div><div id="textEditorPanel"></div><div id="productTexts" class="productLoading">正在读取文本…</div>`;await loadProductTexts();
  }
  async function loadProductTexts(){
    try{const items=(await api(`/api/workspaces/${state.workspace}/text-shares`)).data||[];qs('#productTexts').innerHTML=items.length?`<div class="resourceStack">${items.map(item=>{const url=textURL(item);return `<article class="shareCard"><div class="shareCardMain"><div class="resourceIcon textIcon">T</div><div class="resourceCopy"><div class="resourceTitleRow"><h2>${html(item.title)}</h2>${statusPill(item.status,{active:'可访问',paused:'暂停',expired:'已过期',consumed:'已读取'})}</div>${shareLine(url,'文本公开地址')}<div class="miniMeta"><span>${html(textFormatName(item.format))}</span><span>${item.protected?'密码保护':'公开'}</span><span>${item.one_time?'一次性读取':'可重复读取'}</span><span>${fmtNumber(item.views)} 次读取</span></div></div></div><div class="resourceActions"><button onclick="gojetCopy('${attrJS(url)}',this)">复制链接</button><a class="button" href="${html(url)}" target="_blank">预览</a><button onclick="editProductText(${Number(item.id)})">编辑</button><button class="danger" onclick="deleteProductText(${Number(item.id)})">删除</button></div></article>`}).join('')}</div>`:emptyState('还没有文本分享','纯文本用于普通内容，Markdown 用于格式化文档，代码模式用于代码和日志。','<button class="primary" onclick="showProductTextEditor()">创建第一份文本</button>')}
    catch(err){qs('#productTexts').innerHTML=`<div class="productError">${html(err.message)}</div>`}
  }
  function textFormatName(v){return({plain:'纯文本',markdown:'Markdown',code:'代码 / 日志'})[v]||v}
  window.showProductTextEditor=async(id=0)=>{let item={format:'plain',status:'active'};if(id)item=await api(`/api/workspaces/${state.workspace}/text-shares/${id}`);const host=qs('#textEditorPanel');host.innerHTML=`<section class="textComposer"><div class="composerTop"><div><span class="eyebrow">${id?'EDIT TEXT':'NEW TEXT'}</span><h2>${id?'编辑文本':'创建文本分享'}</h2></div><button onclick="document.querySelector('#textEditorPanel').innerHTML=''">关闭</button></div><form id="productTextForm"><div class="formGrid"><label>标题<input name="title" value="${html(item.title||'')}" maxlength="255" required></label><label>格式<select name="format" id="productTextFormat"><option value="plain" ${item.format==='plain'?'selected':''}>纯文本</option><option value="markdown" ${item.format==='markdown'?'selected':''}>Markdown</option><option value="code" ${item.format==='code'?'selected':''}>代码 / 日志</option></select></label></div><div class="editorSplit"><label class="editorPane"><span>正文</span><textarea name="content" id="productTextContent" maxlength="1000000" spellcheck="false" required>${html(item.content||'')}</textarea></label><div class="previewPane"><span>预览说明</span><div id="textModeHelp"></div></div></div><div class="formGrid"><label>访问密码（可选）<input name="password" type="password" minlength="6" placeholder="${id?'留空保持当前状态':'至少 6 位'}"></label><label>有效期（可选）<input name="expires_at" type="datetime-local"></label><label>状态<select name="status"><option value="active">启用</option><option value="paused" ${item.status==='paused'?'selected':''}>暂停</option></select></label><label class="check productCheck"><input name="one_time" type="checkbox" ${item.one_time?'checked':''}> 一次性读取</label></div><div id="productTextError"></div><button class="primary productPrimary">${id?'保存修改':'创建并获取分享地址'}</button></form></section>`;
    const updateHelp=()=>{const mode=qs('#productTextFormat').value;qs('#textModeHelp').innerHTML=mode==='markdown'?'<h3>Markdown</h3><p>公开页面会按 Markdown 渲染标题、列表、强调、链接和代码块。</p>':mode==='code'?'<h3>代码 / 日志</h3><p>公开页面使用等宽字体和代码布局，不会执行其中任何脚本。</p>':'<h3>纯文本</h3><p>保持原始换行和空格，适合说明、日志摘要和普通文字。</p>'};qs('#productTextFormat').onchange=updateHelp;updateHelp();
    qs('#productTextForm').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));const body={title:f.title,content:f.content,format:f.format,status:f.status,one_time:f.one_time==='on',expires_at:f.expires_at?new Date(f.expires_at).toISOString():null};if(f.password!=='')body.password=f.password;try{const result=await api(id?`/api/workspaces/${state.workspace}/text-shares/${id}`:`/api/workspaces/${state.workspace}/text-shares`,{method:id?'PUT':'POST',body:JSON.stringify(body)});host.innerHTML=id?'<div class="productSuccess">文本已保存。</div>':`<div class="shareCreated"><b>文本已经可以分享</b>${shareLine(textURL(result),'公开地址')}</div>`;await loadProductTexts()}catch(err){qs('#productTextError').innerHTML=`<div class="productError">${html(err.message)}</div>`}};
  };
  window.editProductText=id=>showProductTextEditor(id);
  window.deleteProductText=async id=>{if(!confirm('删除后公开文本地址立即失效。确定删除？'))return;await api(`/api/workspaces/${state.workspace}/text-shares/${id}`,{method:'DELETE'});loadProductTexts()};
  window.renderProductTexts=renderProductTexts;

  async function renderProductQRs(preselect=0,code=''){
    const content=qs('.content');content.innerHTML=`<div class="productPageHead"><div><span class="eyebrow">QR CODES</span><h1>二维码</h1><p>二维码必须对应真实可访问的短链接。创建后可以直接查看二维码、目标短链和下载 PNG。</p></div><button class="primary productPrimary" onclick="showProductQREditor(${Number(preselect)||0})">创建二维码</button></div><div id="qrEditorPanel"></div><div id="productQRs" class="productLoading">正在读取二维码…</div>`;await loadProductQRs();if(preselect)setTimeout(()=>showProductQREditor(preselect,code),0);
  }
  async function loadProductQRs(){
    try{const items=(await api(`/api/workspaces/${state.workspace}/qr-codes`)).data||[];qs('#productQRs').innerHTML=items.length?`<div class="qrProductGrid">${items.map(item=>{const source=qrSourceURL(item);return `<article class="qrProductCard"><div class="qrImageWrap"><img src="${html(item.image_url)}" alt="二维码 ${html(item.name)}"></div><div><div class="resourceTitleRow"><h2>${html(item.name)}</h2><span class="productStatus">${fmtNumber(item.qr_visits)} 次扫码</span></div>${shareLine(source,'二维码对应短链')}<div class="miniMeta"><span>${Number(item.size)}px</span><span>${html(item.foreground)} / ${html(item.background)}</span></div><div class="resourceActions"><button onclick="gojetCopy('${attrJS(source)}',this)">复制目标</button><a class="button" href="${html(source)}" target="_blank">测试目标</a><a class="button" href="${html(item.image_url)}" download>下载 PNG</a><button class="danger" onclick="deleteProductQR(${Number(item.id)})">删除</button></div></div></article>`}).join('')}</div>`:emptyState('还没有二维码','先选择一条启用中的短链接，再生成二维码。','<button class="primary" onclick="showProductQREditor()">创建二维码</button>')}
    catch(err){qs('#productQRs').innerHTML=`<div class="productError">${html(err.message)}</div>`}
  }
  window.showProductQREditor=async(preselect=0)=>{const links=(await api(`/api/workspaces/${state.workspace}/links?status=active&limit=100`)).data||[];const host=qs('#qrEditorPanel');if(!links.length){host.innerHTML='<div class="productError">当前没有可用的启用短链接，请先创建或启用短链接。</div>';return}host.innerHTML=`<section class="qrComposer"><div class="composerTop"><div><span class="eyebrow">NEW QR</span><h2>从短链接生成二维码</h2></div><button onclick="document.querySelector('#qrEditorPanel').innerHTML=''">关闭</button></div><form id="productQRForm"><div class="formGrid"><label>二维码名称<input name="name" required placeholder="例如：线下海报"></label><label>短链接<select name="link_id" id="qrLinkSelect">${links.map(link=>`<option value="${Number(link.ID??link.id)}" ${Number(link.ID??link.id)===Number(preselect)?'selected':''}>${html(shortURL(link))} · ${html(link.Title??link.title||'')}</option>`).join('')}</select></label><label>前景色<input name="foreground" type="color" value="#10233f"></label><label>背景色<input name="background" type="color" value="#ffffff"></label><label>尺寸<select name="size"><option value="512">512px</option><option value="1024" selected>1024px</option><option value="2048">2048px</option></select></label></div><div id="qrTargetPreview" class="targetPreview"></div><div id="productQRError"></div><button class="primary productPrimary">生成二维码</button></form></section>`;const preview=()=>{const link=links.find(x=>Number(x.ID??x.id)===Number(qs('#qrLinkSelect').value));qs('#qrTargetPreview').innerHTML=link?shareLine(shortURL(link),'将编码的短链目标'):''};qs('#qrLinkSelect').onchange=preview;preview();qs('#productQRForm').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));const body={name:f.name,link_id:Number(f.link_id),foreground:f.foreground,background:f.background,size:Number(f.size)};try{const result=await api(`/api/workspaces/${state.workspace}/qr-codes`,{method:'POST',body:JSON.stringify(body)});host.innerHTML=`<div class="shareCreated"><b>二维码已生成</b><img class="createdQR" src="${html(result.image_url)}" alt="二维码">${shareLine(qrSourceURL({...result,code:links.find(x=>Number(x.ID??x.id)===body.link_id)?.Code??links.find(x=>Number(x.ID??x.id)===body.link_id)?.code,domain:links.find(x=>Number(x.ID??x.id)===body.link_id)?.Domain??links.find(x=>Number(x.ID??x.id)===body.link_id)?.domain}),'对应短链')}</div>`;await loadProductQRs()}catch(err){qs('#productQRError').innerHTML=`<div class="productError">${html(err.message)}</div>`}}};
  };
  window.deleteProductQR=async id=>{if(!confirm('只删除二维码，不会删除源短链接。确定继续？'))return;await api(`/api/workspaces/${state.workspace}/qr-codes/${id}`,{method:'DELETE'});loadProductQRs()};
  window.renderProductQRs=renderProductQRs;

  // Expose route functions without deleting the RC9 legacy controller yet. The
  // router can now direct the four P0 product surfaces here while other modules
  // continue to use the legacy implementation until their hardening pass.
  window.GoJetProductHardening={
    links:renderProductLinks,
    files:renderProductFiles,
    texts:renderProductTexts,
    qrs:()=>renderProductQRs(Number(new URLSearchParams(location.search).get('link')||0))
  };
})();
