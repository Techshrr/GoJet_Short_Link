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
new MutationObserver(syncBodyLock).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden']});
syncBodyLock();
})();
