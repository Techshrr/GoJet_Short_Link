const form=document.querySelector('#heroShortener');
const input=document.querySelector('#longUrl');
const result=document.querySelector('#shortResult');
form?.addEventListener('submit',e=>{
  e.preventDefault();
  const value=input.value.trim();
  try{
    const url=new URL(value);
    if(!['http:','https:'].includes(url.protocol))throw new Error();
    localStorage.setItem('gojet_pending_url',url.href);
    result.textContent=localStorage.getItem('gojet_token')?'正在打开控制台并创建短链接…':'先创建 GoJet 账户，登录后会自动创建这条短链接。';
    result.classList.add('show');
    setTimeout(()=>location.href=localStorage.getItem('gojet_token')?'/app/':'/register',350);
  }catch{
    result.textContent='请输入完整的 http:// 或 https:// 地址。';
    result.classList.add('show');
  }
});
fetch('/api/public/settings').then(r=>r.ok?r.json():null).then(s=>{
  if(!s)return;
  const name=s['site.name']??s?.basic?.['site.name'];
  if(name)document.querySelectorAll('[data-site-name]').forEach(x=>x.textContent=name);
}).catch(()=>{});
