(()=>{
'use strict';
const modal=document.getElementById('modal');
if(!modal)return;
document.addEventListener('click',event=>{
  if(!modal.classList.contains('hidden')&&event.target===modal){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation()}
},true);
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!modal.classList.contains('hidden')){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation()}
},true);
const sync=()=>{document.body.style.overflow=modal.classList.contains('hidden')?'':'hidden'};
new MutationObserver(sync).observe(modal,{attributes:true,attributeFilter:['class','aria-hidden']});sync();
})();
