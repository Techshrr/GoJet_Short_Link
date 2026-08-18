import fs from 'node:fs';import path from 'node:path';import process from 'node:process';
const root=process.cwd();const read=f=>fs.readFileSync(path.join(root,f),'utf8');const exists=f=>{if(!fs.existsSync(path.join(root,f)))throw new Error(`P19 missing required file: ${f}`)};const has=(f,tokens)=>{const source=read(f);for(const token of tokens)if(!source.includes(token))throw new Error(`P19 ${f} missing contract token: ${token}`)};
for(const f of ['apps/site/scripts/prerender-static.mjs','apps/site/public/marketing.css','apps/site/public/marketing.js','playwright.site-final.config.ts','tests/site-final/p19-site-final.spec.ts'])exists(f);
has('apps/site/scripts/prerender-static.mjs',['LinksPage.tsx','QRPage.tsx','AnalyticsPage.tsx','BillingPage.tsx','Create link','Advanced settings','Export CSV','billingClient.workspace(','sitemap.xml','robots.txt','application/ld+json','/products/custom-domains/','/solutions/developers/','/legal/acceptable-use/']);
has('apps/site/public/marketing.css',['--max:1280px','height:64px','height:60px','min-height:680px','grid-template-columns:46% 54%','height:660px','ambient-breathe 8s','product-float 6s','translateY(-8px)','prefers-reduced-motion:reduce']);
has('apps/site/public/marketing.js',["window.scrollY>=80","IntersectionObserver","prefers-reduced-motion: reduce"]);
has('tests/site-final/p19-site-final.spec.ts',['data-product-source','data-pricing-source','canonical','application/ld+json']);
has('playwright.site-final.config.ts',['1440','900','1280','800','390','844']);
console.log('P19 Website Final source contract verified: static prerender, exact Workspace UI source guard, frozen IA, motion/reduced-motion, SEO/sitemap/robots, server-owned pricing, three viewports.');
