(()=>{
let tries=0;
function ready(){return window.GoJetPages&&typeof state!=='undefined'&&state.workspace&&state.token}
function applyPending(){
  if(!ready()){if(++tries<120)setTimeout(applyPending,100);return}
  if(location.pathname==='/app/links'){
    const url=localStorage.getItem('gojet_pending_url');
    if(url&&window.openLinkEditor){
      localStorage.removeItem('gojet_pending_url');
      window.openLinkEditor();
      setTimeout(()=>{const input=document.querySelector('#linkEditorForm [name="destination"]');if(input){input.value=url;input.focus()}},100);
    }
  }
  if(location.pathname==='/app/text'){
    const text=localStorage.getItem('gojet_pending_text');
    if(text&&window.showProductTextEditor){
      localStorage.removeItem('gojet_pending_text');
      window.showProductTextEditor();
      setTimeout(()=>{const area=document.querySelector('#textShareEditor [name="content"]');if(area){area.value=text;area.focus()}},100);
    }
  }
}
setTimeout(applyPending,150);
})();
