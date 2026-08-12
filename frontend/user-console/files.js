(()=>{
'use strict';

const FQ=s=>document.querySelector(s);
const FE=v=>escapeHTML(v??'');
const FO=()=>location.origin.replace(/\/$/,'');
const shareURL=item=>`${FO()}/f/${encodeURIComponent(item.slug)}`;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function scanLabel(status){
  return ({pending:'等待检查',scanning:'安全检查中',clean:'可以分享',infected:'存在风险',error:'检查失败'})[status]||'状态未知';
}

function fileMeta(item){
  return [
    fileSize(item.size_bytes),
    item.protected?'需要访问密码':'无需密码',
    `${Number(item.downloads||0).toLocaleString()} 次下载`,
    item.max_downloads?`最多 ${Number(item.max_downloads).toLocaleString()} 次`:'下载次数不限',
    item.expires_at?`有效至 ${date(item.expires_at)}`:'长期有效'
  ].map(value=>`<span>${FE(value)}</span>`).join('');
}

function fileCard(item){
  const clean=item.scan_status==='clean'&&item.status==='active';
  const url=shareURL(item);
  const status=scanLabel(item.scan_status);
  const statusClass=FE(item.scan_status||'unknown');
  let access='';

  if(clean){
    access=`<div class="shareLine">
      <div><small>分享地址</small><a href="${FE(url)}" target="_blank" rel="noopener">${FE(url)}</a></div>
      <div class="shareActions">
        <button onclick="gojetCopy('${String(url).replace(/'/g,"\\'")}',this)">复制</button>
        <a class="button" href="${FE(url)}" target="_blank" rel="noopener">打开分享页</a>
      </div>
    </div>`;
  }else{
    const headline=item.scan_status==='infected'?'文件未通过安全检查，已禁止公开下载':'分享地址会在安全检查通过后开放';
    const detail=item.scan_status==='error'?'安全检查暂时失败，可以刷新状态或联系管理员处理。':item.scan_status==='scanning'?'正在检查文件安全性，无需重复上传。':'文件已接收，正在等待安全检查。';
    access=`<div class="pendingShare"><b>${headline}</b><span>${detail}</span></div>`;
  }

  return `<article class="shareCard">
    <div class="shareCardMain">
      <div class="resourceIcon fileIcon">⇩</div>
      <div class="resourceCopy">
        <div class="resourceTitleRow"><h2>${FE(item.original_name)}</h2><span class="productStatus status-${statusClass}">${status}</span></div>
        ${access}
        <div class="miniMeta">${fileMeta(item)}</div>
      </div>
    </div>
    <div class="resourceActions">
      ${clean?'':`<button onclick="loadFiles()">刷新状态</button>`}
      <button class="danger" onclick="deleteFileShare(${Number(item.id)})">删除</button>
    </div>
  </article>`;
}

async function render(){
  const content=FQ('.content');
  content.innerHTML=`<div class="productPageHead">
    <div><h1>文件分享</h1><p>上传文件后会先进行安全检查，通过后才开放分享和下载。</p></div>
    <button class="primary productPrimary" onclick="openFileUploader()">上传文件</button>
  </div><div id="fileUploadForm"></div><div id="fileList" class="productLoading">正在加载文件…</div>`;
  await load();
}

async function load(){
  const host=FQ('#fileList');
  if(!host)return [];
  try{
    const items=(await api(`/api/workspaces/${state.workspace}/file-shares`)).data||[];
    host.innerHTML=items.length
      ?`<div class="resourceStack">${items.map(fileCard).join('')}</div>`
      :`<div class="productEmpty"><div class="emptyIcon">⇩</div><h3>还没有文件分享</h3><p>上传文件并通过安全检查后，就可以得到分享地址。</p><button class="primary" onclick="openFileUploader()">选择文件</button></div>`;
    return items;
  }catch(error){
    host.innerHTML=`<div class="productError">${FE(error.message)}</div>`;
    return [];
  }
}
window.loadFiles=load;

async function followScan(id){
  for(let attempt=0;attempt<20;attempt++){
    if(!FQ('#fileList'))return;
    const items=await load();
    const item=items.find(entry=>Number(entry.id)===Number(id));
    if(!item||!['pending','scanning'].includes(item.scan_status))return;
    await sleep(1500);
  }
}

function uploadReady(file){
  FQ('#fileChosen').innerHTML=`<div class="selectedFile">
    <div><b>${FE(file.name)}</b><span>${fileSize(file.size)}</span></div>
    <button class="primary" id="fileStart" type="button">开始上传</button>
  </div>`;
  FQ('#fileStart').onclick=()=>upload(file);
}

window.openFileUploader=()=>{
  const host=FQ('#fileUploadForm');
  host.innerHTML=`<section class="fileComposer">
    <div class="composerTop"><div><h2>上传文件</h2><p>文件上传后先进行安全检查；检查通过后才会生成可下载的分享入口。</p></div><button type="button" onclick="document.querySelector('#fileUploadForm').innerHTML=''">关闭</button></div>
    <div class="fileDrop" id="fileDrop">
      <input id="fileInput" type="file">
      <div class="fileDropIcon">＋</div>
      <h3>拖入一个文件，或点击选择</h3>
      <p>单个文件最大 100 MB</p>
      <button type="button" id="fileChoose">选择文件</button>
      <div id="fileChosen"></div>
    </div>
    <div class="fileOptions" id="fileOptions">
      <label>访问密码（可选）<input id="filePassword" type="password" minlength="6" maxlength="128" placeholder="至少 6 位"></label>
      <label>有效期（可选）<input id="fileExpiry" type="datetime-local"></label>
      <label>最大下载次数（可选）<input id="fileMax" type="number" min="1" placeholder="不限制"></label>
    </div>
    <div id="fileProgress" class="uploadProgress hidden"><i></i><span>0%</span></div>
    <div id="fileMessage"></div>
  </section>`;

  const input=FQ('#fileInput');
  const drop=FQ('#fileDrop');
  const choose=FQ('#fileChoose');
  const select=file=>{if(file)uploadReady(file)};

  choose.onclick=()=>input.click();
  input.onchange=()=>select(input.files?.[0]);
  drop.onclick=event=>{
    if(event.target===drop||event.target.classList.contains('fileDropIcon')||event.target.tagName==='H3'||event.target.tagName==='P')input.click();
  };
  ['dragenter','dragover'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.add('dragging')}));
  ['dragleave','drop'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.remove('dragging')}));
  drop.addEventListener('drop',event=>select(event.dataTransfer?.files?.[0]));
};

function upload(file){
  const password=FQ('#filePassword').value;
  if(password&&password.length<6){
    FQ('#fileMessage').innerHTML='<div class="productError">访问密码至少需要 6 位。</div>';
    return;
  }

  const form=new FormData();
  form.append('file',file,file.name);
  if(password)form.append('password',password);
  const expiry=FQ('#fileExpiry').value;
  const maxDownloads=FQ('#fileMax').value;
  if(expiry)form.append('expires_at',new Date(expiry).toISOString());
  if(maxDownloads)form.append('max_downloads',maxDownloads);

  const start=FQ('#fileStart');
  if(start){start.disabled=true;start.textContent='上传中…'}
  const xhr=new XMLHttpRequest();
  xhr.open('POST',`/api/workspaces/${state.workspace}/file-shares`);
  xhr.setRequestHeader('Authorization',`Bearer ${state.token}`);
  const progress=FQ('#fileProgress');
  progress.classList.remove('hidden');
  xhr.upload.onprogress=event=>{
    if(!event.lengthComputable)return;
    const percent=Math.round(event.loaded/event.total*100);
    progress.querySelector('i').style.width=`${percent}%`;
    progress.querySelector('span').textContent=`${percent}%`;
  };
  xhr.onload=async()=>{
    let data={};
    try{data=JSON.parse(xhr.responseText||'{}')}catch{}
    if(xhr.status<200||xhr.status>=300){
      if(start){start.disabled=false;start.textContent='重新上传'}
      FQ('#fileMessage').innerHTML=`<div class="productError">${FE(data.error||'上传失败')}</div>`;
      return;
    }

    const input=FQ('#fileInput');
    if(input)input.value='';
    const choose=FQ('#fileChoose');
    if(choose)choose.classList.add('hidden');
    const options=FQ('#fileOptions');
    if(options)options.classList.add('hidden');
    progress.classList.add('hidden');
    FQ('#fileChosen').innerHTML=`<div class="selectedFile uploadAccepted"><div><b>${FE(file.name)}</b><span>文件已接收，正在安全检查</span></div></div>`;
    FQ('#fileMessage').innerHTML='<div class="productSuccess"><b>上传完成。</b> 无需再次点击上传；安全检查通过后，下方列表会自动开放分享地址。</div>';
    await load();
    if(data.id)followScan(data.id);
  };
  xhr.onerror=()=>{
    if(start){start.disabled=false;start.textContent='重新上传'}
    FQ('#fileMessage').innerHTML='<div class="productError">上传连接中断，请重新选择文件上传。</div>';
  };
  xhr.send(form);
}

window.deleteFileShare=async id=>{
  const proceed=window.gojetConfirm
    ?await window.gojetConfirm('删除文件分享','删除后分享页与下载入口会立即失效，且无法恢复。','确认删除')
    :confirm('删除后分享页与下载入口会立即失效。确定删除？');
  if(!proceed)return;
  await api(`/api/workspaces/${state.workspace}/file-shares/${id}`,{method:'DELETE'});
  await load();
};

window.GoJetPages=window.GoJetPages||{};
window.GoJetPages.files=render;
})();
