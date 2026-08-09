(()=>{
  if(!document.querySelector('link[data-product-style]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/app/product.css';
    link.dataset.productStyle='1';
    document.head.appendChild(link);
  }
  const nav=document.querySelector('aside nav');
  if(nav&&!nav.querySelector('[data-console-view="settings"]')){
    const button=document.createElement('button');
    button.dataset.consoleView='settings';
    button.textContent='账户设置';
    nav.appendChild(button);
  }
  if(!document.querySelector('script[data-product-router]')){
    const script=document.createElement('script');
    script.src='/app/product-router.js';
    script.dataset.productRouter='1';
    script.async=false;
    document.body.appendChild(script);
  }

  const pending=localStorage.getItem('gojet_pending_url');
  if(!pending)return;
  let attempts=0;
  const timer=setInterval(async()=>{
    attempts++;
    if(attempts>60){clearInterval(timer);return}
    if(!state?.token||!state?.workspace)return;
    clearInterval(timer);
    try{
      const url=new URL(pending);
      if(!['http:','https:'].includes(url.protocol))throw new Error('unsupported URL');
      await api(`/api/workspaces/${state.workspace}/links`,{method:'POST',body:JSON.stringify({destination:url.href,redirect_status:302,status:'active'})});
      localStorage.removeItem('gojet_pending_url');
      location.replace('/app/links?view=links');
    }catch(err){
      console.error('GoJet pending link creation failed',err);
      localStorage.removeItem('gojet_pending_url');
    }
  },300);
})();
