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

const observer=new MutationObserver(()=>{syncBodyLock();enhanceTextComposer()});
observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden']});
syncBodyLock();enhanceTextComposer();
})();