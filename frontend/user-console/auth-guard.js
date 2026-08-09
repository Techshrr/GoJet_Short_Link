(()=>{
  const redirectToLogin=()=>{
    const target=location.pathname+location.search+location.hash;
    location.replace('/login?redirect='+encodeURIComponent(target));
  };
  if(!localStorage.getItem('gojet_token')){
    redirectToLogin();
    return;
  }
  // The legacy console bootstrap removes an expired token after /api/me fails.
  // Keep the routing invariant: /app is always the authenticated product UI,
  // while /login is the only interactive login page.
  const timer=setInterval(()=>{
    if(!localStorage.getItem('gojet_token')){
      clearInterval(timer);
      redirectToLogin();
    }
  },400);
})();
