(()=>{
const button=document.querySelector('#fileDownload');
const error=document.querySelector('#fileError');
const password=document.querySelector('#filePassword');
if(!button)return;
function fail(message){if(!error)return;error.textContent=message;error.classList.add('show')}
button.addEventListener('click',async()=>{
  error?.classList.remove('show');
  const protectedFile=button.dataset.protected==='true';
  const secret=password?.value||'';
  if(protectedFile&&!secret)return fail('请输入访问密码。');
  button.disabled=true;const old=button.textContent;button.textContent='正在准备下载…';
  try{
    const response=await fetch(`${location.pathname}?download=1`,{headers:protectedFile?{'X-GoJet-File-Password':secret}:{}});
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'文件暂时无法下载')}
    const blob=await response.blob();
    let filename='gojet-download';
    const disposition=response.headers.get('Content-Disposition')||'';
    const match=disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if(match){try{filename=decodeURIComponent(match[1])}catch{}}
    const objectURL=URL.createObjectURL(blob);const link=document.createElement('a');link.href=objectURL;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectURL),1500);
    button.textContent='下载已开始';setTimeout(()=>button.textContent=old,1400);
  }catch(err){fail(err.message);button.textContent=old}finally{button.disabled=false}
});
})();
