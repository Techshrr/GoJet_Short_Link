const result=document.querySelector('#shortResult');
const loggedIn=()=>Boolean(localStorage.getItem('gojet_token'));
function showResult(text,type='ok'){if(!result)return;result.textContent=text;result.classList.toggle('error',type==='error');result.classList.add('show')}
function rememberProduct(path){localStorage.setItem('gojet_post_auth_path',path)}
function goProduct(path){rememberProduct(path);location.href=loggedIn()?path:`/register?redirect=${encodeURIComponent(path)}`}

document.querySelectorAll('[data-demo-tab]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('[data-demo-tab]').forEach(x=>x.classList.toggle('active',x===button));
  document.querySelectorAll('[data-demo-panel]').forEach(x=>x.classList.toggle('active',x.dataset.demoPanel===button.dataset.demoTab));
  result?.classList.remove('show');
}));

document.querySelector('#heroShortener')?.addEventListener('submit',e=>{
  e.preventDefault();
  const value=document.querySelector('#longUrl')?.value.trim()||'';
  try{
    const url=new URL(value);
    if(!['http:','https:'].includes(url.protocol))throw new Error();
    localStorage.setItem('gojet_pending_url',url.href);
    showResult(loggedIn()?'正在打开短链接创建器…':'创建账户后会自动带入刚才的长网址。');
    setTimeout(()=>goProduct('/app/links'),220);
  }catch{showResult('请输入完整的 http:// 或 https:// 地址。','error')}
});

document.querySelector('#heroText')?.addEventListener('submit',e=>{
  e.preventDefault();
  const value=document.querySelector('#heroTextValue')?.value||'';
  if(!value.trim())return showResult('请先输入要分享的文本。','error');
  localStorage.setItem('gojet_pending_text',value.slice(0,1000000));
  showResult(loggedIn()?'正在打开文本分享编辑器…':'创建账户后会带入这段文本。');
  setTimeout(()=>goProduct('/app/text'),220);
});

document.querySelector('#heroFile')?.addEventListener('click',()=>{
  showResult(loggedIn()?'正在打开单文件上传…':'文件不会在登录前离开你的浏览器；创建账户后进入上传页。');
  setTimeout(()=>goProduct('/app/files'),220);
});

fetch('/api/public/settings').then(r=>r.ok?r.json():null).then(s=>{
  if(!s)return;
  const name=s['site.name']??s?.basic?.['site.name'];
  if(name)document.querySelectorAll('[data-site-name]').forEach(x=>x.textContent=name);
}).catch(()=>{});
