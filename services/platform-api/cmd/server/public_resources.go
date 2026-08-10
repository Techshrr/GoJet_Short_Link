package main

import (
	"encoding/json"
	"html/template"
	"net/http"
	"net/url"
	"regexp"

	appresources "github.com/Techshrr/GoJet_Short_Link/app/resources"
)

var textPageTemplate = template.Must(template.New("text").Parse(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>{{.Title}} · GoJet 文本分享</title><style>*{box-sizing:border-box}body{margin:0;background:#f7f8fa;color:#101828;font:15px/1.72 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{width:min(920px,calc(100% - 32px));margin:52px auto}.top{display:flex;justify-content:space-between;align-items:center}.brand{font-size:21px;font-weight:850;letter-spacing:-.03em}.brand b{color:#155eef}.meta{color:#667085;font-size:12px}.card{margin-top:18px;background:#fff;border:1px solid #e4e7ec;border-radius:16px;padding:30px;box-shadow:0 12px 34px rgba(16,24,40,.06)}h1{font-size:29px;line-height:1.2;letter-spacing:-.03em;margin:3px 0 22px}.content p{margin:0 0 16px}.content h1,.content h2,.content h3,.content h4,.content h5,.content h6{margin:28px 0 12px;line-height:1.3}.content ul,.content ol{padding-left:24px}.content blockquote{margin:18px 0;padding:10px 16px;border-left:3px solid #84adff;background:#f5f8ff;color:#344054}.content a{color:#155eef}.content code{font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#f2f4f7;border-radius:5px;padding:2px 5px}.content pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;background:#101828;color:#e6edf6;border-radius:12px;padding:22px;overflow:auto;font:13px/1.65 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.content pre.plain{background:#f8fafc;color:#1d2939;border:1px solid #eaecf0}.content pre code{background:none;color:inherit;padding:0}form{display:flex;gap:8px;max-width:520px}input,button{height:44px;border:1px solid #d0d5dd;border-radius:9px;padding:0 13px;font:inherit}input{flex:1}button{background:#101828;color:#fff;font-weight:750;cursor:pointer}.error{color:#b42318;background:#fef3f2;border:1px solid #fecdca;padding:10px 12px;border-radius:8px}.notice{color:#667085;margin-top:-12px;margin-bottom:20px}@media(max-width:640px){main{margin:24px auto}.card{padding:20px}h1{font-size:24px}.top{align-items:flex-start;gap:10px}form{display:grid}}</style></head><body><main><div class="top"><div class="brand">GoJet<b>.</b></div><div class="meta">{{.Format}} · {{.Views}} 次读取</div></div><section class="card"><h1>{{.Title}}</h1>{{if .Protected}}<p class="notice">此文本受密码保护。验证通过后才会显示正文。</p><form method="post"><input name="password" type="password" placeholder="访问密码" required autofocus><button>验证并读取</button></form>{{if .Error}}<p class="error">{{.Error}}</p>{{end}}{{else}}<div class="content">{{.Rendered}}</div>{{end}}</section></main></body></html>`))

var bioPageTemplate = template.Must(template.New("bio").Parse(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{.Title}} · GoJet 个人主页</title><style>:root{--primary:{{.Primary}};--background:{{.Background}}}*{box-sizing:border-box}body{margin:0;background:var(--background);color:#10233f;font:15px/1.6 system-ui}main{width:min(560px,calc(100% - 32px));margin:55px auto;text-align:center}.avatar{width:74px;height:74px;border-radius:22px;background:var(--primary);color:white;display:grid;place-items:center;margin:auto;font-size:28px;font-weight:800}h1{margin-bottom:4px}.links{display:grid;gap:12px;margin:30px 0}.links a{display:block;background:#fff;border:1px solid #dce6ef;border-radius:10px;padding:14px;color:#10233f;text-decoration:none;font-weight:700}.links a:hover{border-color:var(--primary)}footer{color:#708095;font-size:12px}</style></head><body><main><div class="avatar">{{.Initial}}</div><h1>{{.Title}}</h1><p>{{.Bio}}</p><div class="links">{{range .Links}}<a href="{{.URL}}" rel="noopener noreferrer nofollow">{{.Label}}</a>{{end}}</div><footer>由 GoJet 提供安全链接服务</footer></main></body></html>`))

func (s *server) publicTextPage(w http.ResponseWriter, r *http.Request) {
	metadata, err := s.resources.TextMetadata(r.Context(), r.PathValue("slug"))
	if err != nil {
		http.Error(w, "文本不存在、已过期或已读取", http.StatusNotFound)
		return
	}
	view := struct {
		appresources.TextShare
		Error    string
		Rendered template.HTML
	}{TextShare: metadata}
	if !metadata.Protected || r.Method == http.MethodPost {
		if r.Method == http.MethodPost {
			_ = r.ParseForm()
		}
		item, readErr := s.resources.ReadText(r.Context(), metadata.Slug, r.FormValue("password"))
		if readErr != nil {
			view.Error = "密码错误，或文本已失效。"
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
	theme := struct{ Primary, Background string }{Primary: "#1769e0", Background: "#f4f8fc"}
	_ = json.Unmarshal(item.Theme, &theme)
	if !regexp.MustCompile(`^#[0-9a-fA-F]{6}$`).MatchString(theme.Primary) {
		theme.Primary = "#1769e0"
	}
	if !regexp.MustCompile(`^#[0-9a-fA-F]{6}$`).MatchString(theme.Background) {
		theme.Background = "#f4f8fc"
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
