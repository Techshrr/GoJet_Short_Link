package main

import (
	"encoding/json"
	"html/template"
	"net/http"
	"net/url"
	"regexp"

	appresources "github.com/Techshrr/GoJet_Short_Link/app/resources"
)

var textPageTemplate = template.Must(template.New("text").Parse(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>{{.Title}} · GoJet 文本分享</title><style>body{margin:0;background:#f4f8fc;color:#10233f;font:15px/1.65 system-ui}main{width:min(900px,calc(100% - 32px));margin:60px auto}.brand{font-size:20px;font-weight:800;color:#1769e0}.card{margin-top:24px;background:#fff;border:1px solid #dce6ef;border-radius:12px;padding:28px}h1{margin:8px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f7f9fc;border:1px solid #e3eaf1;padding:20px;border-radius:8px}input,button{height:42px;border:1px solid #cad7e3;border-radius:7px;padding:0 12px}button{background:#1769e0;color:#fff;font-weight:700}.error{color:#b42318}</style></head><body><main><div class="brand">GoJet.</div><section class="card"><small>{{.Format}} · {{.Views}} 次读取</small><h1>{{.Title}}</h1>{{if .Protected}}<p>此文本受密码保护，请验证后读取。</p><form method="post"><input name="password" type="password" required autofocus><button>验证并读取</button></form>{{if .Error}}<p class="error">{{.Error}}</p>{{end}}{{else}}<pre>{{.Content}}</pre>{{end}}</section></main></body></html>`))

var bioPageTemplate = template.Must(template.New("bio").Parse(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{.Title}} · GoJet 个人主页</title><style>:root{--primary:{{.Primary}};--background:{{.Background}}}*{box-sizing:border-box}body{margin:0;background:var(--background);color:#10233f;font:15px/1.6 system-ui}main{width:min(560px,calc(100% - 32px));margin:55px auto;text-align:center}.avatar{width:74px;height:74px;border-radius:22px;background:var(--primary);color:white;display:grid;place-items:center;margin:auto;font-size:28px;font-weight:800}h1{margin-bottom:4px}.links{display:grid;gap:12px;margin:30px 0}.links a{display:block;background:#fff;border:1px solid #dce6ef;border-radius:10px;padding:14px;color:#10233f;text-decoration:none;font-weight:700}.links a:hover{border-color:var(--primary)}footer{color:#708095;font-size:12px}</style></head><body><main><div class="avatar">{{.Initial}}</div><h1>{{.Title}}</h1><p>{{.Bio}}</p><div class="links">{{range .Links}}<a href="{{.URL}}" rel="noopener noreferrer nofollow">{{.Label}}</a>{{end}}</div><footer>由 GoJet 提供安全链接服务</footer></main></body></html>`))

func (s *server) publicTextPage(w http.ResponseWriter, r *http.Request) {
	metadata, err := s.resources.TextMetadata(r.Context(), r.PathValue("slug"))
	if err != nil {
		http.Error(w, "文本不存在、已过期或已读取", http.StatusNotFound)
		return
	}
	view := struct {
		appresources.TextShare
		Error string
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
		}
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
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
