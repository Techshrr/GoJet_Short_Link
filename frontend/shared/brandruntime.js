(()=>{
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function textBrand(node,name){node.innerHTML=`${esc(name)}<span>.</span>`;node.classList.remove('brand-image')}
function imageBrand(node,url,name){
  const img=new Image();
  img.src=url;img.alt=name;img.decoding='async';
  img.style.cssText='display:block;width:auto;max-width:150px;max-height:38px;object-fit:contain';
  img.addEventListener('load',()=>{node.replaceChildren(img);node.classList.add('brand-image')},{once:true});
  img.addEventListener('error',()=>textBrand(node,name),{once:true});
}
async function apply(){
  let settings=null;
  try{const response=await fetch('/api/public/settings',{cache:'no-store'});if(response.ok)settings=await response.json()}catch{}
  if(!settings)return;
  const name=settings['site.name']||'GoJet';
  const logo=settings['brand.logo_url']||'';
  document.querySelectorAll('.brand,.login-brand,[data-console-brand]').forEach(node=>logo?imageBrand(node,logo,name):textBrand(node,name));
  const color=settings['brand.primary_color'];
  if(color){for(const variable of ['--blue','--green','--shell-accent'])document.documentElement.style.setProperty(variable,color)}
  if(settings['brand.favicon_url']){
    let icon=document.querySelector('link[rel="icon"]');
    if(!icon){icon=document.createElement('link');icon.rel='icon';document.head.append(icon)}
    icon.href=settings['brand.favicon_url'];
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();
