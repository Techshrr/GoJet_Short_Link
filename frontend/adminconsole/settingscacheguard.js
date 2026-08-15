(()=>{
'use strict';
const originalSettingsAPI = window.api;
if(typeof originalSettingsAPI!=='function')return;
window.adminApiUpdatedAt = String(Date.now());
window.api = async function(path, options={}){
  const raw=String(path||'');
  const method=String(options?.method||'GET').toUpperCase();
  const settingsRead=method==='GET'&&(raw==='/api/admin/settings'||raw.startsWith('/api/admin/settings?'));
  let nextPath=raw,nextOptions=options;
  if(settingsRead){
    const revision=window.adminApiUpdatedAt||String(Date.now());
    nextPath=raw+(raw.includes('?')?'&':'?')+'_gojet_settings_rev='+encodeURIComponent(revision);
    nextOptions={...options,cache:'no-store'};
  }
  const result=await originalSettingsAPI(nextPath,nextOptions);
  const settingsWrite=method!=='GET'&&(
    raw==='/api/admin/settings'||raw.startsWith('/api/admin/settings/')||
    raw==='/api/admin/brand-assets'||raw.startsWith('/api/admin/brand-assets/')
  );
  if(settingsWrite)window.adminApiUpdatedAt = String(Date.now());
  return result;
};
})();