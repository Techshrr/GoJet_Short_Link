(()=>{
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
      location.replace('/app/?view=links');
    }catch(err){
      console.error('GoJet pending link creation failed',err);
      localStorage.removeItem('gojet_pending_url');
    }
  },300);
})();
