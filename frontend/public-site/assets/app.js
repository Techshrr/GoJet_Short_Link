(()=>{
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const shellHeader=`<header class="siteHeader" data-gojet-shell><div class="container nav"><a class="logo" href="/">GoJet<i>.</i></a><button type="button" data-mega aria-expanded="false">产品</button><a href="/pricing/">套餐价格</a><a href="/products/analytics/">访问分析</a><a href="/products/custom-domains/">自定义域名</a><span class="push"></span><span class="accountNav" data-account-nav><a href="/login">登录</a><a class="btn primary" href="/register">免费开始</a></span><button type="button" class="mobileMenu" aria-label="打开产品导航">菜单</button><div class="mega" aria-label="产品导航"><a href="/products/url-shortener/"><b>短链接</b><small>创建、编辑和管理短网址</small></a><a href="/products/qr-code/"><b>二维码</b><small>与短链接同步的二维码</small></a><a href="/products/analytics/"><b>访问分析</b><small>了解分享效果和访问来源</small></a><a href="/products/text-sharing/"><b>文本分享</b><small>分享文本、Markdown 和代码</small></a><a href="/products/file-sharing/"><b>文件分享</b><small>安全检查后再开放下载</small></a><a href="/products/bio-pages/"><b>个人主页</b><small>用一个页面汇集重要入口</small></a><a href="/products/smart-links/"><b>智能链接</b><small>按规则分配访问目标</small></a><a href="/products/ab-testing/"><b>链接实验</b><small>比较不同目标的访问表现</small></a><a href="/products/custom-domains/"><b>自定义域名</b><small>使用自己的域名分享</small></a></div></div></header>`;
const shellFooter=`<footer data-gojet-shell><div class="container"><div class="footerGrid"><div><a class="logo" href="/">GoJet<i>.</i></a><p>短链接、二维码、内容分享与访问分析，在一个工作区集中管理。</p></div><div><b>产品</b><a href="/products/url-shortener/">短链接</a><a href="/products/qr-code/">二维码</a><a href="/products/analytics/">访问分析</a><a href="/products/bio-pages/">个人主页</a></div><div><b>分享</b><a href="/products/text-sharing/">文本分享</a><a href="/products/file-sharing/">文件分享</a><a href="/products/custom-domains/">自定义域名</a></div><div data-footer-account><b>账户</b><a href="/login">登录</a><a href="/register">注册</a><a href="/forgot-password">找回密码</a><a href="/app/">用户控制台</a></div><div><b>规则与支持</b><a href="/privacy/">隐私政策</a><a href="/terms/">服务条款</a><a href="/report-abuse/">滥用举报</a><a href="/app/?view=support">提交工单</a></div></div><div class="legal"><span>© <span data-gojet-year></span> <span data-gojet-site-name>GoJet</span></span><span> · </span><a href="/privacy/">隐私政策</a><span> · </span><a href="/terms/">服务条款</a></div></div></footer>`;

function installShell(){
  const currentHeader=document.querySelector('body > header');
  if(currentHeader)currentHeader.outerHTML=shellHeader;else document.body.insertAdjacentHTML('afterbegin',shellHeader);
  const currentFooter=document.querySelector('body > footer');
  if(currentFooter)currentFooter.outerHTML=shellFooter;else document.body.insertAdjacentHTML('beforeend',shellFooter);
  document.querySelectorAll('[data-gojet-year]').forEach(node=>node.textContent=new Date().getFullYear());
  const trigger=document.querySelector('[data-mega]'),mega=document.querySelector('.mega'),mobile=document.querySelector('.mobileMenu');
  const toggle=()=>{const open=!mega?.classList.contains('open');mega?.classList.toggle('open',open);trigger?.setAttribute('aria-expanded',open?'true':'false')};
  trigger?.addEventListener('click',event=>{event.stopPropagation();toggle()});
  mobile?.addEventListener('click',event=>{event.stopPropagation();toggle()});
  document.addEventListener('click',()=>{mega?.classList.remove('open');trigger?.setAttribute('aria-expanded','false')});
}

function darker(hex,factor=.82){
  if(!/^#[0-9a-f]{6}$/i.test(hex||''))return hex;
  const value=parseInt(hex.slice(1),16);
  const channel=shift=>Math.max(0,Math.min(255,Math.round(((value>>shift)&255)*factor)));
  return `#${[channel(16),channel(8),channel(0)].map(v=>v.toString(16).padStart(2,'0')).join('')}`;
}

function applyPublicSettings(settings){
  if(!settings)return;
  const name=settings['site.name']||'GoJet';
  document.querySelectorAll('[data-gojet-site-name]').forEach(node=>node.textContent=name);
  document.querySelectorAll('.logo').forEach(logo=>{
    if(settings['brand.logo_url']){
      const img=document.createElement('img');
      img.src=settings['brand.logo_url'];
      img.alt=name;
      img.decoding='async';
      img.style.cssText='display:block;width:auto;max-width:150px;max-height:38px';
      img.addEventListener('error',()=>{logo.innerHTML=`${escapeHTML(name)}<i>.</i>`},{once:true});
      logo.replaceChildren(img);
    }else if(logo.textContent.trim().startsWith('GoJet')){
      logo.innerHTML=`${escapeHTML(name)}<i>.</i>`;
    }
  });
  const primary=settings['brand.primary_color'];
  if(primary){
    document.documentElement.style.setProperty('--brand',primary);
    document.documentElement.style.setProperty('--brand-hover',darker(primary));
    document.documentElement.style.setProperty('--blue',primary);
  }
  const description=settings['seo.meta_description'];
  if(description){let meta=document.querySelector('meta[name=description]');if(!meta){meta=document.createElement('meta');meta.name='description';document.head.append(meta)}meta.content=description}
  if(settings['brand.favicon_url']){let icon=document.querySelector('link[rel=icon]');if(!icon){icon=document.createElement('link');icon.rel='icon';document.head.append(icon)}icon.href=settings['brand.favicon_url']}
  const support=settings['site.support_email']||settings['site.contact_email']||'';
  document.querySelectorAll('[data-support-email]').forEach(node=>{
    if(support){node.textContent=support;if(node.tagName==='A')node.href='mailto:'+support}else{node.textContent='用户控制台工单';if(node.tagName==='A')node.href='/app/?view=support'}
  });
}

function renderSignedInAccount(user){
  const account=document.querySelector('[data-account-nav]');
  if(account)account.innerHTML=`<a href="/app/" class="accountName">${escapeHTML(user?.display_name||user?.email||'我的账户')}</a><a class="btn primary" href="/app/">进入控制台</a>`;
  const footer=document.querySelector('[data-footer-account]');
  if(footer)footer.innerHTML='<b>账户</b><a href="/app/">用户控制台</a><a href="/app/?view=settings">账户设置</a><a href="/app/?view=billing">套餐与账单</a><a href="/app/?view=support">支持工单</a>';
  document.querySelectorAll('main a[href="/register"], .mk-cta a[href="/register"]').forEach(link=>{
    link.href='/app/';
    if(/免费|注册|开始|使用/.test(link.textContent||''))link.textContent='进入控制台';
  });
}

async function applyAccountState(){
  const token=localStorage.getItem('gojet_token');
  if(!token)return;
  try{
    const response=await fetch('/api/me',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
    if(!response.ok){if(response.status===401||response.status===403)localStorage.removeItem('gojet_token');return}
    renderSignedInAccount(await response.json());
  }catch{}
}

installShell();
Promise.allSettled([
  fetch('/api/public/settings',{cache:'no-store'}).then(response=>response.ok?response.json():null).then(applyPublicSettings),
  applyAccountState()
]);
})();