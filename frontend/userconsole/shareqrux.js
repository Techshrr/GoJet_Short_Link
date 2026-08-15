(()=>{
'use strict';

const escapeValue=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));
const idFromHandler=(element,name)=>{
  const source=element?.getAttribute('onclick')||'';
  const match=source.match(new RegExp(`${name}\\((\\d+)\\)`));
  return match?Number(match[1]):0;
};
const shareSlug=(href,prefix)=>{
  try{
    const path=new URL(href,location.origin).pathname;
    if(!path.startsWith(prefix))return'';
    return decodeURIComponent(path.slice(prefix.length).split('/')[0]||'');
  }catch{return''}
};

function closeDialog(dialog){
  if(!dialog)return;
  if(typeof dialog.close==='function')dialog.close();
  dialog.remove();
}

function renderQRDialog(data,label){
  document.querySelector('[data-gojet-share-qr-dialog]')?.remove();
  const dialog=document.createElement('dialog');
  dialog.className='gojetShareQRDialog';
  dialog.dataset.gojetShareQrDialog='1';
  dialog.innerHTML=`<div class="gojetShareQRHead"><div><span>二维码分享</span><h2>${escapeValue(label||'分享内容')}</h2></div><button type="button" class="gojetDialogClose" data-gojet-share-qr-close aria-label="关闭" title="关闭">×</button></div><div class="gojetShareQRBody"><div class="gojetShareQRImage"><img src="${escapeValue(data.image_data_url)}" alt="${escapeValue(label||'分享内容')}二维码"></div><div class="gojetShareQRTarget"><small>扫码访问地址</small><a href="${escapeValue(data.target)}" target="_blank" rel="noopener">${escapeValue(data.target)}</a></div><p>二维码只指向 GoJet 自己生成的公开分享页，不允许把任意外部网址包装成内容二维码。</p></div><div class="gojetShareQRFoot"><button type="button" data-gojet-share-qr-copy>复制链接</button><a class="button" href="${escapeValue(data.image_data_url)}" download="gojet-${escapeValue(data.kind||'share')}-${Number(data.resource_id||0)}.png">下载二维码</a><a class="button primary" href="${escapeValue(data.target)}" target="_blank" rel="noopener">打开分享页</a></div>`;
  document.body.appendChild(dialog);
  const close=()=>closeDialog(dialog);
  dialog.querySelector('[data-gojet-share-qr-close]').onclick=close;
  dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
  dialog.addEventListener('click',event=>{if(event.target===dialog)close()});
  dialog.querySelector('[data-gojet-share-qr-copy]').onclick=async event=>{
    const button=event.currentTarget;
    try{
      if(window.gojetCopy)await window.gojetCopy(data.target,button);
      else await navigator.clipboard.writeText(data.target);
      if(!window.gojetCopy){button.textContent='已复制';setTimeout(()=>button.textContent='复制链接',1200)}
    }catch{button.textContent='复制失败'}
  };
  if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
}

window.gojetShareQR=async(kind,resourceID,label='分享内容')=>{
  const id=Number(resourceID||0);
  if(!id)return;
  try{
    const data=await api(`/api/workspaces/${state.workspace}/share-qr`,{method:'POST',body:JSON.stringify({kind,resource_id:id,size:768})});
    renderQRDialog(data,label);
  }catch(error){
    if(window.gojetMessage)await window.gojetMessage('二维码暂不可用',error.message||'无法生成二维码');
  }
};

function appendQRButton(host,kind,id,label){
  if(!host||!id||host.querySelector(`[data-share-qr="${kind}:${id}"]`))return;
  const button=document.createElement('button');
  button.type='button';
  button.dataset.shareQr=`${kind}:${id}`;
  button.textContent='二维码';
  // Keep the compact visible label, but use an action-oriented accessible name
  // that is distinct from the primary “二维码” navigation item. This avoids
  // ambiguous navigation for assistive technology and browser automation.
  button.setAttribute('aria-label',`生成${label||'分享内容'}分享码`);
  button.title='生成二维码分享';
  button.onclick=()=>window.gojetShareQR(kind,id,label);
  host.appendChild(button);
}

function enhanceTextCards(){
  document.querySelectorAll('.textLibraryItem').forEach(card=>{
    if(!card.querySelector('.productStatus.status-active'))return;
    const edit=card.querySelector('[onclick*="gojetTextEdit("]');
    const id=idFromHandler(edit,'gojetTextEdit');
    const label=card.querySelector('h2')?.textContent?.trim()||'文本分享';
    appendQRButton(card.querySelector('.textLibraryActions'),'text',id,label);
  });
}

async function enhanceCreatedText(){
  const created=document.querySelector('.textCreated');
  if(!created||created.dataset.qrReady==='1'||created.dataset.qrLoading==='1')return;
  const anchor=created.querySelector('.textCreatedURL a[href]');
  const slug=shareSlug(anchor?.href||'','/t/');
  if(!slug)return;
  created.dataset.qrLoading='1';
  try{
    const items=(await api(`/api/workspaces/${state.workspace}/text-shares`)).data||[];
    const item=items.find(value=>String(value.slug||'')===slug&&value.status==='active');
    if(!item)return;
    appendQRButton(created.querySelector('.textCreatedURL'),'text',Number(item.id),item.title||'文本分享');
    created.dataset.qrReady='1';
  }catch{
    // The share itself already exists. A transient list refresh failure must not
    // replace the success state; the normal text library will retry on return.
  }finally{delete created.dataset.qrLoading}
}

function enhanceFileCards(){
  document.querySelectorAll('#fileList .shareCard').forEach(card=>{
    if(!card.querySelector('.shareLine'))return;
    const remove=card.querySelector('[onclick*="deleteFileShare("]');
    const id=idFromHandler(remove,'deleteFileShare');
    const label=card.querySelector('.resourceTitleRow h2')?.textContent?.trim()||'文件分享';
    appendQRButton(card.querySelector('.shareActions')||card.querySelector('.resourceActions'),'file',id,label);
  });
}

function enhanceBioCards(){
  document.querySelectorAll('.bioResourceCard').forEach(card=>{
    if(!card.querySelector('.productStatus.status-published'))return;
    const edit=card.querySelector('[onclick*="editBioPage("]');
    const id=idFromHandler(edit,'editBioPage');
    const label=card.querySelector('.resourceTitleRow h2')?.textContent?.trim()||'个人主页';
    appendQRButton(card.querySelector('.shareActions'),'bio',id,label);
  });
}

function enhanceCreatedBio(){
  const created=document.querySelector('#bioEditor .shareCreated');
  if(!created||created.dataset.qrReady==='1')return;
  const anchor=created.querySelector('.shareLine a[href]');
  const slug=shareSlug(anchor?.href||'','/p/');
  if(!slug)return;
  const item=(state.resourceBios||[]).find(value=>String(value.slug||'')===slug&&value.status==='published');
  if(!item)return;
  appendQRButton(created.querySelector('.shareActions'),'bio',Number(item.id),item.title||'个人主页');
  created.dataset.qrReady='1';
}

let timer=0;
function enhance(){
  clearTimeout(timer);
  timer=setTimeout(()=>{
    enhanceTextCards();
    void enhanceCreatedText();
    enhanceFileCards();
    enhanceBioCards();
    enhanceCreatedBio();
  },30);
}

enhance();
const content=document.querySelector('.content');
if(content)new MutationObserver(enhance).observe(content,{subtree:true,childList:true});
})();