// Public announcement Markdown is escaped before formatting so admin-authored notices cannot execute HTML or script.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function markdown(raw){
  let s=esc(raw||'');
  const code=[];
  s=s.replace(/```([\s\S]*?)```/g,(_,x)=>{code.push(`<pre><code>${x.trim()}</code></pre>`);return `@@CODE${code.length-1}@@`});
  s=s.replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>');
  s=s.replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>');
  s=s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
  s=s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  const lines=s.split('\n'),out=[];let list=false;
  for(const line of lines){
    if(/^[-*] /.test(line)){if(!list){out.push('<ul>');list=true}out.push(`<li>${line.slice(2)}</li>`);continue}
    if(list){out.push('</ul>');list=false}
    if(!line.trim()){out.push('');continue}
    if(/^<(h[1-3]|blockquote|pre)/.test(line))out.push(line);else out.push(`<p>${line}</p>`)
  }
  if(list)out.push('</ul>');
  s=out.join('\n').replace(/@@CODE(\d+)@@/g,(_,i)=>code[Number(i)]||'');
  return s;
}
async function load(){
  const root=document.querySelector('#announcementList');
  try{
    const r=await fetch('/api/public/announcements',{headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error('公告接口暂时不可用');
    const data=await r.json(),items=data.data||[];
    if(!items.length){root.innerHTML='<div class="announcement-empty">当前没有已发布公告。</div>';return}
    root.innerHTML='';
    for(const item of items){
      const article=document.createElement('article');article.className='announcement-card';
      const header=document.createElement('header');
      const title=document.createElement('h2');title.textContent=item.title||'公告';
      const time=document.createElement('time');time.textContent=item.published_at?new Date(item.published_at).toLocaleString('zh-CN'):'已发布';
      const body=document.createElement('div');body.className='announcement-body';body.innerHTML=markdown(item.body_markdown||'');
      header.append(title,time);article.append(header,body);root.append(article);
    }
  }catch(err){root.innerHTML=`<div class="announcement-empty">${esc(err.message)}</div>`}
}
load();