(()=>{
'use strict';
const modalSelectors=['.productModalLayer','#linkEditorLayer','.dialogLayer','.modalLayer'];
const visibleModal=()=>modalSelectors.map(selector=>document.querySelector(selector)).find(node=>node&&node.isConnected&&getComputedStyle(node).display!=='none');
// A backdrop is not an action. Prevent legacy click-to-dismiss handlers from seeing it.
document.addEventListener('click',event=>{
  const modal=visibleModal();
  if(!modal)return;
  if(event.target===modal){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation()}
},true);
// Preserve entered data. Modal dismissal is only through an explicit close/cancel/done control.
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||!visibleModal())return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
},true);
const syncBodyLock=()=>{
  const open=Boolean(visibleModal());
  document.documentElement.classList.toggle('modalOpen',open);
  document.body.style.overflow=open?'hidden':'';
};

const escapeCode=value=>String(value??'').replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]));
const escapeText=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function codeKind(value){
  const source=String(value||'').trim();
  if(/<!doctype\s+html|<html\b|<body\b|<div\b|<section\b|<main\b/i.test(source))return'HTML';
  if(/^\s*[\[{][\s\S]*[\]}]\s*$/.test(source)){try{JSON.parse(source);return'JSON'}catch{}}
  if(/(^|\n)\s*(const|let|var|function|import|export|class)\b/.test(source))return'JavaScript';
  if(/(^|\n)\s*(#!\/bin\/(ba)?sh|sudo\s|apt\s|yum\s|docker\s|curl\s)/i.test(source))return'Shell';
  if(/[.#][\w-]+\s*\{[^}]*\}/.test(source))return'CSS';
  return'源代码';
}
function safeHTMLPreview(source){
  const parsed=new DOMParser().parseFromString(String(source||''),'text/html');
  parsed.querySelectorAll('script,iframe,object,embed,meta,base,link').forEach(node=>node.remove());
  parsed.querySelectorAll('*').forEach(node=>{
    [...node.attributes].forEach(attr=>{
      const name=attr.name.toLowerCase(),value=String(attr.value||'').trim();
      if(name.startsWith('on')||name==='srcdoc'||/^(?:java|vb)script:/i.test(value))node.removeAttribute(attr.name);
    });
  });
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:14px/1.6 system-ui,sans-serif;margin:18px;color:#15231d}img{max-width:100%}</style></head><body>'+parsed.body.innerHTML+'</body></html>';
}
function enhanceTextComposer(){
  const composer=document.querySelector('.textComposer');
  if(!composer||composer.dataset.finalPolish==='1')return;
  const format=composer.querySelector('#textFormat'),textarea=composer.querySelector('textarea[name="content"]'),split=composer.querySelector('.editorSplit');
  if(!format||!textarea||!split)return;
  composer.dataset.finalPolish='1';
  const studio=document.createElement('section');studio.className='codeStudio';studio.hidden=true;
  studio.innerHTML='<div class="codeStudioHead"><div><b>代码工作区</b><span>源码始终按文本安全展示，不会在公开分享页执行。</span></div><span class="codeKind" data-code-kind>源代码</span></div><div class="codeStudioGrid"><div class="codeSource"><header>实时源码预览</header><pre><code data-code-preview></code></pre></div><div class="htmlPreview" data-html-preview><header>HTML 安全预览</header><iframe sandbox="" title="HTML 安全预览"></iframe></div></div>';
  split.insertAdjacentElement('afterend',studio);
  const preview=studio.querySelector('[data-code-preview]'),kind=studio.querySelector('[data-code-kind]'),htmlBox=studio.querySelector('[data-html-preview]'),frame=htmlBox.querySelector('iframe');
  const sync=()=>{
    const code=format.value==='code';studio.hidden=!code;
    if(!code)return;
    const value=textarea.value,type=codeKind(value);kind.textContent=type;preview.innerHTML=escapeCode(value)||'<span class="codeEmpty">开始输入代码后，这里会同步显示。</span>';
    const isHTML=type==='HTML';htmlBox.hidden=!isHTML;if(isHTML)frame.srcdoc=safeHTMLPreview(value);
  };
  format.addEventListener('change',()=>requestAnimationFrame(sync));textarea.addEventListener('input',sync);sync();
}

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fetchInvoicePDF(invoiceID,onAttempt){
  const delays=[0,1200,2600],url=`/api/workspaces/${state.workspace}/billing/invoices/${invoiceID}/pdf`;
  let lastError=new Error('账单文件暂时无法读取');
  for(let index=0;index<delays.length;index++){
    if(delays[index])await wait(delays[index]);
    onAttempt(index+1,delays.length);
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),45000);
    try{
      const response=await fetch(url,{headers:{Authorization:`Bearer ${state.token}`,'Cache-Control':'no-cache'},cache:'no-store',signal:controller.signal,credentials:'same-origin'});
      if(!response.ok){let message='';try{message=(await response.json()).error||''}catch{}const error=new Error(message||`账单服务返回 HTTP ${response.status}`);error.retryable=response.status>=500||response.status===429;throw error}
      const contentType=String(response.headers.get('Content-Type')||'').toLowerCase();
      if(!contentType.includes('application/pdf'))throw new Error('账单服务没有返回 PDF 文件');
      const blob=await response.blob();
      if(blob.size<1000)throw new Error('账单 PDF 文件不完整');
      return blob;
    }catch(error){
      lastError=error?.name==='AbortError'?new Error('账单生成连接超过 45 秒'):error;
      if(error?.retryable===false)break;
    }finally{clearTimeout(timeout)}
  }
  throw lastError;
}
async function resilientInvoiceDownload(button){
  const invoiceID=Number(button.dataset.downloadInvoice),number=button.dataset.invoiceNumber||'Document';
  if(!invoiceID)return;
  const layer=document.createElement('div');layer.className='productModalLayer';layer.innerHTML='<div class="productModal billingDialog"><div class="productModalHead"><h2>正在准备账单</h2><button type="button" data-close aria-label="关闭">×</button></div><div class="billingDialogBody"><div class="productLoading" data-pdf-state>正在生成 PDF…</div><div class="productModalFoot"><button type="button" data-close-secondary>关闭</button></div></div></div>';document.body.append(layer);
  const close=()=>layer.remove();layer.querySelector('[data-close]').onclick=close;layer.querySelector('[data-close-secondary]').onclick=close;const host=layer.querySelector('[data-pdf-state]');
  try{
    const blob=await fetchInvoicePDF(invoiceID,(attempt,total)=>{host.className='productLoading';host.textContent=attempt===1?'正在生成 PDF…':`连接暂时未完成，正在自动恢复（${attempt}/${total}）…`});
    const objectURL=URL.createObjectURL(blob),anchor=document.createElement('a'),safe=String(number).replace(/[^a-z0-9]/gi,'')||'Document';anchor.href=objectURL;anchor.download=`GoJetInvoice${safe}.pdf`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(objectURL),8000);close();
  }catch(error){host.className='productError';host.innerHTML=`<b>账单 PDF 未能完成下载</b><p>${escapeText(error?.message||'服务器连接异常')}。系统已经自动完成多次连接尝试；账单本身不会重复生成或产生新的费用。</p>`}
}
// Capture invoice download clicks before the legacy one-shot handler. Network failures recover automatically.
document.addEventListener('click',event=>{const button=event.target.closest?.('[data-download-invoice]');if(!button)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void resilientInvoiceDownload(button)},true);

const observer=new MutationObserver(()=>{syncBodyLock();enhanceTextComposer()});
observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden']});
syncBodyLock();enhanceTextComposer();
})();