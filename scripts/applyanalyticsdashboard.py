#!/usr/bin/env python3
from pathlib import Path
import re


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding='utf-8')
    if text.count(old) != 1:
        raise SystemExit(f'{path}: expected exactly one occurrence of {old!r}, got {text.count(old)}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


root = Path(__file__).resolve().parents[1]
main = root / 'services/platformapi/cmd/server/main.go'
product = root / 'services/platformapi/cmd/server/productroutes.go'
admin = root / 'services/platformapi/cmd/server/admin.go'
app = root / 'frontend/adminconsole/app.js'
styles = root / 'frontend/adminconsole/styles.css'

replace_once(main, 's.registerProductHardeningRoutes(mux)', 's.registerProductRoutes(mux)')
replace_once(product, 'func (s *server) registerProductHardeningRoutes(mux *http.ServeMux) {', 'func (s *server) registerProductRoutes(mux *http.ServeMux) {')
replace_once(
    product,
    'mux.HandleFunc("GET /api/admin/payment-callbacks", s.admin("billing.manage", s.adminPaymentCallbacks))',
    'mux.HandleFunc("GET /api/admin/payment-callbacks", s.admin("billing.manage", s.adminPaymentCallbacks))\n\tmux.HandleFunc("GET /api/admin/analytics/overview", s.admin("platform.read", s.adminAnalyticsOverview))',
)

admin_text = admin.read_text(encoding='utf-8')
admin_re = re.compile(r'func \(s \*server\) adminOverview\(w http\.ResponseWriter, r \*http\.Request\) \{.*?\n\}\nfunc page', re.S)
admin_new = '''func (s *server) adminOverview(w http.ResponseWriter, r *http.Request) {
	queries := map[string]string{
		"users":             `SELECT COUNT(*) FROM users WHERE status<>'deleted'`,
		"workspaces":        `SELECT COUNT(*) FROM workspaces`,
		"active_links":      `SELECT COUNT(*) FROM short_links WHERE status='active' AND deleted_at IS NULL`,
		"mail_failures":     `SELECT COUNT(*) FROM mail_messages WHERE status='failed'`,
		"abuse_reports":     `SELECT COUNT(*) FROM abuse_reports WHERE status IN ('open','investigating')`,
		"domain_errors":     `SELECT COUNT(*) FROM custom_domains WHERE status='error' OR https_status='error'`,
		"security_events":   `SELECT COUNT(*) FROM security_events WHERE status='open' AND severity IN ('high','critical')`,
		"file_scan_backlog": `SELECT COUNT(*) FROM file_shares WHERE scan_status IN ('pending','scanning')`,
		"file_scan_failures": `SELECT COUNT(*) FROM file_shares WHERE scan_status IN ('infected','error')`,
	}
	data := map[string]int64{}
	for key, query := range queries {
		var value int64
		if err := s.db.QueryRowContext(r.Context(), query).Scan(&value); err != nil {
			jsonResponse(w, 503, map[string]string{"error": "平台指标暂时不可用"})
			return
		}
		data[key] = value
	}
	data["today_clicks"] = s.adminRealtimeTodayClicks(r.Context(), time.Now().UTC())
	jsonResponse(w, 200, data)
}
func page'''
admin_text, count = admin_re.subn(admin_new, admin_text, count=1)
if count != 1:
    raise SystemExit(f'{admin}: adminOverview replacement count={count}')
admin.write_text(admin_text, encoding='utf-8')

app_text = app.read_text(encoding='utf-8')
app_re = re.compile(r'function renderOverview\(d\)\{.*?\}\n\nasync function renderUsers', re.S)
app_new = r'''async function renderOverview(d){
  const a=await api('/api/admin/analytics/overview');
  d.today_clicks=Number(a.today_clicks||0);
  const metrics=[['用户',d.users],['工作区',d.workspaces],['活跃链接',d.active_links],['今日点击',d.today_clicks],['邮件失败',d.mail_failures],['滥用举报',d.abuse_reports],['域名异常',d.domain_errors],['扫描积压',d.file_scan_backlog]];
  const trend=Array.isArray(a.trend)?a.trend:[],trendMax=Math.max(1,...trend.map(x=>Number(x.clicks||0)));
  const trendHtml=`<div class="adminTrendBars">${trend.map((x,i)=>{const value=Number(x.clicks||0),height=Math.max(value?8:2,Math.round(value/trendMax*100)),label=String(x.date||'').slice(5);return `<div class="adminTrendBar" title="${esc(x.date)} · ${num(value)} 次访问"><i style="height:${height}%"></i>${i%5===0||i===trend.length-1?`<small>${esc(label)}</small>`:'<small></small>'}</div>`}).join('')}</div>`;
  const dimension=(title,items=[])=>{const rows=Array.isArray(items)?items.slice(0,5):[],max=Math.max(1,...rows.map(x=>Number(x.count||0)));return `<section class="adminDimension"><h4>${esc(title)}</h4>${rows.length?rows.map(x=>{const count=Number(x.count||0);return `<div><span>${esc(x.name||'未知')}</span><i><em style="width:${Math.max(4,Math.round(count/max*100))}%"></em></i><strong>${num(count)}</strong></div>`}).join(''):'<p>暂无访问数据</p>'}</section>`};
  const p=a.pipeline||{},pipeline=[['事件流',p.stream_length,false],['待处理',p.pending,true],['重试',p.retrying,true],['死信',p.dead_letters,true],['对账延迟',p.reconciliation_lag,true]];
  $('#content').innerHTML=pageHead('平台概览','查看实时访问、用户、工作区与平台运行情况。')+
    `<div class="metrics">${metrics.map(([k,v])=>`<article class="metric"><span>${k}</span><strong>${num(v)}</strong></article>`).join('')}</div>`+
    `<div class="adminAnalyticsGrid"><section class="panel adminTrendPanel"><div class="panel-head"><div><h3>最近 30 天访问趋势</h3><p>历史数据来自持久化分析，今天使用实时计数并以持久化数据兜底。</p></div><div class="adminAnalyticsSummary"><b>${num(a.visits_30d)}</b><span>30 天事件</span><b>${num(a.unique_visitors_30d)}</b><span>独立访客</span></div></div><div class="panel-body">${trendHtml}</div></section><section class="panel adminCompositionPanel"><div class="panel-head"><div><h3>访问构成</h3><p>仅展示系统真实采集的来源、国家、设备和浏览器。</p></div></div><div class="panel-body adminDimensionGrid">${dimension('访问来源',a.sources)}${dimension('国家 / 地区',a.countries)}${dimension('设备',a.devices)}${dimension('浏览器',a.browsers)}</div></section></div>`+
    `<section class="panel adminPipelinePanel"><div class="panel-head"><div><h3>分析管道</h3><p>Redis 事件流、Worker 重试/死信与 MySQL 对账状态。</p></div><span class="adminMetricSource">实时 + 持久化</span></div><div class="panel-body adminPipelineGrid">${pipeline.map(([label,value,zeroGood])=>`<article class="${zeroGood&&Number(value||0)>0?'warning':'healthy'}"><span>${label}</span><strong>${num(value)}</strong><small>${zeroGood?(Number(value||0)>0?'需要关注':'正常'):'当前队列'}</small></article>`).join('')}</div></section>`+
    `<div class="info">平台指标按统一口径展示；实时计数与持久化数据存在短暂异步时，以不丢失访问为原则取可靠上界。</div>`;
}

async function renderUsers'''
app_text, count = app_re.subn(app_new, app_text, count=1)
if count != 1:
    raise SystemExit(f'{app}: renderOverview replacement count={count}')
app.write_text(app_text, encoding='utf-8')

css = styles.read_text(encoding='utf-8')
marker = '/* GoJet administrator analytics dashboard */'
if marker not in css:
    css += r'''
/* GoJet administrator analytics dashboard */
.adminAnalyticsGrid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(360px,.85fr);gap:16px}.adminTrendPanel,.adminCompositionPanel{min-height:340px}.adminAnalyticsSummary{display:grid;grid-template-columns:auto auto;gap:2px 8px;align-items:baseline;text-align:right}.adminAnalyticsSummary b{font-size:17px}.adminAnalyticsSummary span{font-size:10px;color:var(--muted)}.adminTrendBars{height:220px;display:flex;align-items:flex-end;gap:5px;padding:10px 2px 0;border-bottom:1px solid var(--line)}.adminTrendBar{height:100%;flex:1;min-width:5px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:5px}.adminTrendBar i{display:block;width:100%;min-height:2px;max-width:20px;border-radius:5px 5px 2px 2px;background:linear-gradient(180deg,#1fc87a,#0ba868)}.adminTrendBar small{font-size:8px;color:#98a2b3;height:11px;white-space:nowrap}.adminDimensionGrid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.adminDimension h4{font-size:12px;margin:0 0 10px}.adminDimension>div{display:grid;grid-template-columns:minmax(72px,1fr) 1.6fr auto;gap:8px;align-items:center;margin:8px 0;font-size:11px}.adminDimension>div span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.adminDimension>div i{height:6px;background:#eef1f4;border-radius:999px;overflow:hidden}.adminDimension>div em{display:block;height:100%;background:#22b573;border-radius:999px}.adminDimension>div strong{font-size:10px}.adminDimension p{font-size:11px;color:var(--muted);margin:14px 0}.adminPipelinePanel{margin-top:0}.adminMetricSource{font-size:10px;color:var(--green);font-weight:700}.adminPipelineGrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.adminPipelineGrid article{border:1px solid #dcefe5;background:#f5fcf8;border-radius:10px;padding:13px}.adminPipelineGrid article.warning{border-color:#fedf89;background:#fffcf2}.adminPipelineGrid span,.adminPipelineGrid small{display:block;font-size:10px;color:var(--muted)}.adminPipelineGrid strong{display:block;font-size:20px;margin:5px 0;color:#174a32}.adminPipelineGrid article.warning strong{color:#b54708}@media(max-width:1100px){.adminAnalyticsGrid{grid-template-columns:1fr}.adminDimensionGrid{grid-template-columns:1fr 1fr}.adminPipelineGrid{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.adminDimensionGrid{grid-template-columns:1fr}.adminPipelineGrid{grid-template-columns:1fr 1fr}.adminTrendBars{gap:2px}.adminTrendBar small{font-size:7px}}
'''
styles.write_text(css, encoding='utf-8')

for path in (main, product, admin, app):
    text=path.read_text(encoding='utf-8')
    if 'registerProductHardeningRoutes' in text:
        raise SystemExit(f'{path}: retired hardening route name remains')
print('Analytics Dashboard refactor prepared')
