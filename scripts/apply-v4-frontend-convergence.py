#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def change(path,old,new,required=True):
    p=ROOT/path; text=p.read_text()
    if new in text: return
    if old not in text:
        if required: raise SystemExit(f'pattern missing in {path}: {old[:80]}')
        return
    p.write_text(text.replace(old,new,1))

# Admin: the complete settings renderer is part of the normal load chain.
change('frontend/admin-console/index.html',
       '<script src="/admin/product-actions.js"></script>',
       '<script src="/admin/product-actions.js"></script>\n<script src="/admin/settings-full.js"></script>')

# User console: stop dynamically inventing navigation; publish real product routes.
change('frontend/user-console/index.html',
       '<link rel="stylesheet" href="/app/styles.css"><script src="/app/auth-guard.js"></script>',
       '<link rel="stylesheet" href="/app/styles.css"><link rel="stylesheet" href="/app/product.css" data-product-style="1"><script src="/app/auth-guard.js"></script>')
change('frontend/user-console/index.html',
       '<button data-console-view="billing">套餐与账单</button></nav>',
       '<button data-console-view="billing">套餐与账单</button><button data-console-view="analytics">访问分析</button><button data-console-view="settings">账户设置</button></nav>')
change('frontend/user-console/index.html',
       '<script src="/app/app.js"></script><script src="/app/pending-link.js"></script>',
       '<script src="/app/app.js"></script><script src="/app/product-router.js" data-product-router="1"></script><script src="/app/pending-link.js"></script>')

router=ROOT/'frontend/user-console/product-router.js'
text=router.read_text()
text=text.replace("'/app/billing':'billing','/app/settings':'settings'", "'/app/billing':'billing','/app/analytics':'analytics','/app/settings':'settings'")
text=text.replace("billing:'/app/billing',settings:'/app/settings'", "billing:'/app/billing',analytics:'/app/analytics',settings:'/app/settings'")
text=text.replace("billing:()=>renderBilling(),settings:()=>renderAccountSettings()", "billing:()=>renderBilling(),analytics:()=>renderGlobalAnalytics(),settings:()=>renderAccountSettings()")
if 'async function renderGlobalAnalytics()' not in text:
    marker='  async function renderAccountSettings(){'
    pos=text.find(marker)
    if pos<0: raise SystemExit('product router account settings marker missing')
    analytics=r'''  async function renderGlobalAnalytics(){
    const wid=state.workspace;
    const [overview,links]=await Promise.all([
      api(`/api/workspaces/${wid}/overview`).catch(()=>({})),
      api(`/api/workspaces/${wid}/links?limit=50&offset=0`).catch(()=>({data:[]}))
    ]);
    const rows=(links.data||[]);
    const clicks=overview.total_clicks??overview.clicks??rows.reduce((n,x)=>n+Number(x.clicks||0),0);
    const visitors=overview.unique_visitors??overview.visitors??rows.reduce((n,x)=>n+Number(x.unique_visitors||x.visitors||0),0);
    const active=overview.active_links??rows.filter(x=>x.status==='active').length;
    const content=document.querySelector('.content');
    content.innerHTML=`<div class="title"><div><small>Analytics</small><h1>工作区访问分析</h1><p>汇总当前工作区的真实短链访问表现，并可继续进入单条链接查看详细事件。</p></div><button id="analyticsRefresh">刷新数据</button></div>
      <div class="metrics"><article><span>累计点击</span><strong>${Number(clicks||0).toLocaleString()}</strong></article><article><span>独立访客</span><strong>${Number(visitors||0).toLocaleString()}</strong></article><article><span>活跃链接</span><strong>${Number(active||0).toLocaleString()}</strong></article><article><span>链接总数</span><strong>${Number(rows.length).toLocaleString()}</strong></article></div>
      <div class="tableWrap"><table><thead><tr><th>短码</th><th>目标地址</th><th>点击</th><th>访客</th><th>状态</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${escapeHTML(x.code||'—')}</td><td>${escapeHTML(x.destination||'—')}</td><td>${Number(x.clicks||0).toLocaleString()}</td><td>${Number(x.unique_visitors||x.visitors||0).toLocaleString()}</td><td>${escapeHTML(x.status||'—')}</td></tr>`).join('')||'<tr><td colspan="5">当前工作区还没有短链接数据。</td></tr>'}</tbody></table></div>`;
    $('#analyticsRefresh').onclick=renderGlobalAnalytics;
  }

'''
    text=text[:pos]+analytics+text[pos:]
router.write_text(text)

# Main validation knows about the completed settings renderer.
workflow=ROOT/'.github/workflows/installer-release.yml'
text=workflow.read_text()
if 'node --check frontend/admin-console/settings-full.js' not in text:
    text=text.replace('node --check frontend/admin-console/product-actions.js', 'node --check frontend/admin-console/product-actions.js\n          node --check frontend/admin-console/settings-full.js')
if "grep -Fq 'links.default_redirect_status' frontend/admin-console/settings-full.js" not in text:
    text=text.replace("grep -Fq 'data-plan-edit' frontend/admin-console/product-actions.js", "grep -Fq 'data-plan-edit' frontend/admin-console/product-actions.js\n          grep -Fq 'links.default_redirect_status' frontend/admin-console/settings-full.js\n          grep -Fq 'analytics.retention_days' frontend/admin-console/settings-full.js")
workflow.write_text(text)

# Release verifier must fail if the settings/analytics pieces are missing.
verify=ROOT/'scripts/verify-release.sh'; text=verify.read_text()
text=text.replace('public/admin/index.html public/admin/app.js public/admin/product-actions.js public/admin/styles.css', 'public/admin/index.html public/admin/app.js public/admin/product-actions.js public/admin/settings-full.js public/admin/styles.css')
if "grep -Fq 'links.default_redirect_status' \"$ROOT/public/admin/settings-full.js\"" not in text:
    text=text.replace("grep -Fq 'data-plan-edit' \"$ROOT/public/admin/product-actions.js\" || { echo 'administrator plan editor is missing' >&2; exit 1; }", "grep -Fq 'data-plan-edit' \"$ROOT/public/admin/product-actions.js\" || { echo 'administrator plan editor is missing' >&2; exit 1; }\ngrep -Fq 'links.default_redirect_status' \"$ROOT/public/admin/settings-full.js\" || { echo 'complete settings editor is missing' >&2; exit 1; }\ngrep -Fq '/app/analytics' \"$ROOT/public/app/product-router.js\" || { echo 'workspace analytics route is missing' >&2; exit 1; }")
verify.write_text(text)

# Browser acceptance covers the newly exposed settings and analytics routes.
spec=ROOT/'tests/e2e/product-rebuild.spec.js'; text=spec.read_text()
if "test('system settings expose the full editable policy surface'" not in text:
    text += r'''

test('system settings expose the full editable policy surface',async({page})=>{
  await adminLogin(page);
  await page.getByRole('button',{name:'系统设置'}).click();
  await expect(page.getByText('短链接默认策略',{exact:true})).toBeVisible();
  await expect(page.getByText('Analytics 与隐私',{exact:true})).toBeVisible();
  await expect(page.getByText('注册、登录与安全',{exact:true})).toBeVisible();
  await expect(page.getByText('API 与缓存',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'保存短链接默认策略'})).toBeVisible();
});
'''
spec.write_text(text)
print('V4 frontend convergence applied')
