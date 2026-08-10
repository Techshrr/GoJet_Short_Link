package main

import (
	"encoding/json"
	"html/template"
	"net/http"
	"net/url"
	"regexp"

	appresources "github.com/Techshrr/GoJet_Short_Link/app/resources"
)

var textPageTemplate = template.Must(template.New("text").Parse(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>{{.Title}} · GoJet 文本分享</title><style>:root{--brand:#16a66a;--brand-dark:#12885a;--brand-soft:#e9f8f1;--ink:#14231d;--muted:#708077;--line:#dce5e0;--bg:#f6f8f7}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.72 Inter,"PingFang SC","Microsoft YaHei",system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}main{width:min(920px,calc(100% - 32px));margin:48px auto}.top{display:flex;justify-content:space-between;align-items:center;gap:16px}.brand{font-size:22px;font-weight:850;letter-spacing:-.03em}.brand b{color:var(--brand)}.meta{color:var(--muted);font-size:12px}.card{margin-top:18px;background:#fff;border:1px solid var(--line);border-radius:18px;padding:30px;box-shadow:0 14px 40px rgba(24,55,41,.07)}h1{font-size:29px;line-height:1.25;letter-spacing:-.03em;margin:2px 0 22px}.content p{margin:0 0 16px}.content h1,.content h2,.content h3,.content h4,.content h5,.content h6{margin:28px 0 12px;line-height:1.35}.content ul,.content ol{padding-left:24px}.content blockquote{margin:18px 0;padding:10px 16px;border-left:3px solid var(--brand);background:var(--brand-soft);color:#365146}.content a{color:var(--brand-dark)}.content code{font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#eef3f0;border-radius:6px;padding:2px 5px}.content pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;background:#14231d;color:#eef7f2;border-radius:12px;padding:22px;overflow:auto;font:13px/1.65 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.content pre.plain{background:#f9fbfa;color:var(--ink);border:1px solid var(--line)}.content pre code{background:none;color:inherit;padding:0}form{display:flex;gap:8px;max-width:520px}input,button{height:44px;border:1px solid #c8d5ce;border-radius:9px;padding:0 13px;font:inherit}input{flex:1;color:var(--ink);background:#fff}input:focus{outline:0;border-color:var(--brand);box-shadow:0 0 0 3px rgba(22,166,106,.18)}button{background:var(--brand);border-color:var(--brand);color:#fff;font-weight:750;cursor:pointer}button:hover{background:var(--brand-dark);border-color:var(--brand-dark)}.error{color:#a52e2e;background:#fff0f0;border:1px solid #efc5c5;padding:10px 12px;border-radius:9px}.notice{color:var(--muted);margin-top:-10px;margin-bottom:20px}.foot{margin-top:18px;color:var(--muted);font-size:12px;text-align:center}.foot b{color:var(--brand)}@media(max-width:640px){main{margin:24px auto}.card{padding:20px}h1{font-size:24px}.top{align-items:flex-start;gap:10px}form{display:grid}}</style></head><body><main><div class="top"><div class="brand">GoJet<b>.</b></div><div class="meta">{{.FormatName}} · {{.Views}} 次阅读{{if .OneTime}} · 一次性分享{{end}}</div></div><section class="card"><h1>{{.Title}}</h1>{{if .Protected}}<p class="notice">这份文本需要访问密码。验证通过后即可阅读。</p><form method="post"><input name="password" type="password" placeholder="输入访问密码" required autofocus><button>验证并阅读</button></form>{{if .Error}}<p class="error">{{.Error}}</p>{{end}}{{else}}<div class="content">{{.Rendered}}</div>{{end}}</section><div class="foot">由 <b>GoJet</b> 提供</div></main></body></html>`))

var bioPageTemplate = template.Must(template.New("bio").Parse(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{.Title}} · GoJet 个人主页</title><style>:root{--primary:{{.Primary}};--background:{{.Background}};--ink:#14231d;--muted:#708077;--line:#dce5e0}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--background);color:var(--ink);font:15px/1.6 Inter,"PingFang SC","Microsoft YaHei",system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}main{width:min(560px,calc(100% - 32px));margin:0 auto;padding:54px 0 34px;text-align:center}.avatar{width:76px;height:76px;border-radius:22px;background:var(--primary);color:var(--background);display:grid;place-items:center;margin:auto;font-size:29px;font-weight:850;box-shadow:0 12px 30px rgba(20,35,29,.12)}h1{font-size:27px;letter-spacing:-.025em;margin:17px 0 4px}.bio{margin:0 auto;color:#53665d;max-width:480px;white-space:pre-wrap}.links{display:grid;gap:11px;margin:30px 0}.links a{display:block;background:rgba(255,255,255,.92);border:1px solid rgba(126,148,137,.28);border-radius:12px;padding:14px 16px;color:var(--ink);text-decoration:none;font-weight:700;box-shadow:0 5px 18px rgba(24,55,41,.045);transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease}.links a:hover{transform:translateY(-1px);border-color:var(--primary);box-shadow:0 9px 25px rgba(24,55,41,.08)}.links a:focus-visible{outline:3px solid rgba(22,166,106,.2);outline-offset:2px}footer{color:#6f8077;font-size:12px;margin-top:26px}footer b{color:#16a66a}@media(max-width:560px){main{padding-top:36px}.avatar{width:68px;height:68px;border-radius:19px}h1{font-size:24px}}</style></head><body><main><div class="avatar">{{.Initial}}</div><h1>{{.Title}}</h1><p class="bio">{{.Bio}}</p><div class="links">{{range .Links}}<a href="{{.URL}}" rel="noopener noreferrer nofollow">{{.Label}}</a>{{end}}</div><footer>由 <b>GoJet</b> 提供</footer></main></body></html>`))

func (s *server) publicTextPage(w http.ResponseWriter, r *http.Request) {
	metadata, err := s.resources.TextMetadata(r.Context(), r.PathValue("slug"))
	if err != nil {
		http.Error(w, "文本不存在、已过期或已读取", http.StatusNotFound)
		return
	}
	formatName := map[string]string{"plain": "纯文本", "markdown": "Markdown 格式", "code": "代码与日志"}[metadata.Format]
	if formatName == "" {
		formatName = "文本"
	}
	view := struct {
		appresources.TextShare
		Error      string
		FormatName string
		Rendered   template.HTML
	}{TextShare: metadata, FormatName: formatName}
	if !metadata.Protected || r.Method == http.MethodPost {
		if r.Method == http.MethodPost {
			_ = r.ParseForm()
		}
		item, readErr := s.resources.ReadText(r.Context(), metadata.Slug, r.FormValue("password"))
		if readErr != nil {
			view.Error = "密码错误，或这份文本已经失效。"
		} else {
			view.TextShare = item
			view.Protected = false
			view.Rendered = renderSharedText(item.Format, item.Content)
		}
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
	_ = textPageTemplate.Execute(w, view)
}

func (s *server) publicBioPage(w http.ResponseWriter, r *http.Request) {
	item, err := s.resources.ReadBio(r.Context(), r.PathValue("slug"))
	if err != nil {
		http.Error(w, "个人主页不存在或尚未发布", http.StatusNotFound)
		return
	}
	theme := struct{ Primary, Background string }{Primary: "#16a66a", Background: "#f5faf7"}
	_ = json.Unmarshal(item.Theme, &theme)
	if !regexp.MustCompile(`^#[0-9a-fA-F]{6}$`).MatchString(theme.Primary) {
		theme.Primary = "#16a66a"
	}
	if !regexp.MustCompile(`^#[0-9a-fA-F]{6}$`).MatchString(theme.Background) {
		theme.Background = "#f5faf7"
	}
	var rawLinks []struct{ Label, URL string }
	_ = json.Unmarshal(item.Blocks, &rawLinks)
	links := make([]struct{ Label, URL string }, 0, len(rawLinks))
	for _, link := range rawLinks {
		parsed, parseErr := url.ParseRequestURI(link.URL)
		if parseErr == nil && parsed.Host != "" && (parsed.Scheme == "http" || parsed.Scheme == "https") && link.Label != "" {
			links = append(links, link)
		}
	}
	initial := "G"
	if runes := []rune(item.Title); len(runes) > 0 {
		initial = string(runes[0])
	}
	view := struct {
		Title, Bio, Initial string
		Primary, Background template.CSS
		Links               []struct{ Label, URL string }
	}{item.Title, item.Bio, initial, template.CSS(theme.Primary), template.CSS(theme.Background), links}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'")
	_ = bioPageTemplate.Execute(w, view)
}
