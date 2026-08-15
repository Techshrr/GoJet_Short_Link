(()=>{
'use strict';
const modal=document.getElementById('modal');
if(!modal)return;
const focusable='button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
let opened=false,returnFocus=null;
const panel=()=>modal.querySelector('.modal')||modal;
document.addEventListener('click',event=>{
  if(!modal.classList.contains('hidden')&&event.target===modal){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation()}
},true);
document.addEventListener('keydown',event=>{
  if(modal.classList.contains('hidden'))return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();return}
  if(event.key!=='Tab')return;
  const items=[...panel().querySelectorAll(focusable)].filter(node=>node.offsetParent!==null||node===document.activeElement);
  if(!items.length){event.preventDefault();return}
  const first=items[0],last=items[items.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
},true);
const sync=()=>{
  const now=!modal.classList.contains('hidden');
  document.body.style.overflow=now?'hidden':'';
  if(now&&!opened){
    returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    panel().setAttribute('role','dialog');
    panel().setAttribute('aria-modal','true');
    requestAnimationFrame(()=>panel().querySelector('[autofocus],input,textarea,select,button,a[href]')?.focus?.({preventScroll:true}));
  }
  if(!now&&opened&&returnFocus?.isConnected){
    try{returnFocus.focus({preventScroll:true})}catch{}
    returnFocus=null;
  }
  // Persist the transition state. Without this assignment every subsequent
  // modal attribute mutation is treated as a fresh open, which breaks focus
  // return semantics and can repeatedly steal focus while a dialog is active.
  opened=now;
};
new MutationObserver(sync).observe(modal,{attributes:true,attributeFilter:['class','aria-hidden'],subtree:false});
sync();
})();