(()=>{
'use strict';
const search=document.querySelector('#docsSearch');
const results=document.querySelector('#docsSearchResults');
const articles=[...document.querySelectorAll('.docsArticle')];
const sidebar=document.querySelector('.docsSidebar');
const navLinks=[...document.querySelectorAll('#docsNav a')];
const norm=value=>String(value||'').toLowerCase().replace(/\s+/g,' ').trim();
const titleOf=section=>section.querySelector('h2')?.textContent?.trim()||'';
const excerptOf=section=>section.querySelector('p')?.textContent?.trim()||'';
function closeResults(){if(results)results.hidden=true}
function renderResults(value){
  const query=norm(value);
  if(!results)return;
  if(!query){closeResults();return}
  const matches=articles.map(section=>({section,title:titleOf(section),text:norm(`${section.dataset.doc||''} ${section.textContent||''}`)})).filter(item=>item.text.includes(query)).slice(0,8);
  results.innerHTML=matches.length?matches.map(item=>`<a href="#${item.section.id}" data-doc-result="${item.section.id}"><b>${item.title}</b><span>${excerptOf(item.section).slice(0,84)}${excerptOf(item.section).length>84?'…':''}</span></a>`).join(''):'<div class="none">没有找到完全匹配的内容，换一个更短的关键词试试。</div>';
  results.hidden=false;
}
search?.addEventListener('input',event=>renderResults(event.target.value));
search?.addEventListener('keydown',event=>{if(event.key==='Escape'){search.value='';closeResults();search.blur()}});
results?.addEventListener('click',event=>{const link=event.target.closest('[data-doc-result]');if(!link)return;closeResults();const section=document.getElementById(link.dataset.docResult);if(section){section.classList.remove('docsSearchHit');requestAnimationFrame(()=>section.classList.add('docsSearchHit'))}});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!/input|textarea|select/i.test(document.activeElement?.tagName||'')){event.preventDefault();search?.focus()}});
document.addEventListener('click',event=>{if(!event.target.closest('.docsSearch')&&!event.target.closest('.docsSearchResults'))closeResults()});

document.querySelector('#docsMenu')?.addEventListener('click',()=>sidebar?.classList.add('open'));
document.querySelector('#docsMenuClose')?.addEventListener('click',()=>sidebar?.classList.remove('open'));
navLinks.forEach(link=>link.addEventListener('click',()=>sidebar?.classList.remove('open')));

const observer=new IntersectionObserver(entries=>{
  const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
  if(!visible)return;
  navLinks.forEach(link=>link.classList.toggle('active',link.getAttribute('href')===`#${visible.target.id}`));
},{rootMargin:'-18% 0px -66% 0px',threshold:[0,.25,.6]});
articles.forEach(section=>observer.observe(section));
})();
