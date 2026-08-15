package main

import (
	"encoding/json"
	"html/template"
	"net/http"
	"net/url"
	"regexp"

	appresources "github.com/Techshrr/GoJet_Short_Link/app/resources"
)

var textPageTemplate = template.Must(template.New("text").Parse(`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>{{.Title}} · {{.SiteName}} 文本分享</title>
<link rel="stylesheet" href="/assets/styles.css">
<link rel="stylesheet" href="/assets/resourceshare.css">
<script defer src="/assets/app.js"></script>
</head>
<body>
<main class="resourcePage">
  <div class="resourceWrap">
    <div class="resourceIntro">
      <div>
        <p class="resourceEyebrow">TEXT SHARE</p>
        <h1>{{.Title}}</h1>
      </div>
      <div class="resourceMeta">{{.FormatName}} · {{.Views}} 次阅读{{if .OneTime}} · 一次性分享{{end}}</div>
    </div>
    <section class="resourceCard">
      {{if .Protected}}
        <p class="resourceNotice">这份文本需要访问密码。验证通过后即可阅读。</p>
        <form class="resourceForm" method="post">
          <input name="password" type="password" placeholder="输入访问密码" required autofocus autocomplete="current-password">
          <button class="resourceButton" type="submit">验证并阅读</button>
        </form>
        {{if .Error}}<p class="resourceError">{{.Error}}</p>{{end}}
      {{else}}
        <div class="resourceContent">{{.Rendered}}</div>
      {{end}}
    </section>
  </div>
</main>
</body>
</html>`))

var bioPageTemplate = template.Must(template.New("bio").Parse(`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{.Title}} · {{.SiteName}} 个人主页</title>
<link rel="stylesheet" href="/assets/styles.css">
<link rel="stylesheet" href="/assets/resourceshare.css">
<script defer src="/assets/app.js"></script>
</head>
<body>
<main class="resourcePage">
  <div class="bioResource">
    <section class="bioSurface" style="--bio-primary:{{.Primary}};--bio-background:{{.Background}};--bio-ink:{{.Ink}};--bio-muted:{{.Muted}};--bio-surface:{{.Surface}}">
      <div class="bioAvatar">{{.Initial}}</div>
      <h1>{{.Title}}</h1>
      <p class="bioCopy">{{.Bio}}</p>
      <div class="bioLinks">{{range .Links}}<a href="{{.URL}}" rel="noopener noreferrer nofollow">{{.Label}}</a>{{end}}</div>
    </section>
  </div>
</main>
</body>
</html>`))

func (s *server) publicTextPage(w http.ResponseWriter, r *http.Request) {
	metadata, err := s.resources.TextMetadata(r.Context(), r.PathValue("slug"))
	if err != nil {
		redirectPublicUnavailable(w, r, "text", r.PathValue("slug"))
		return
	}
	formatName := map[string]string{"plain": "纯文本", "markdown": "Markdown 格式", "code": "代码与日志"}[metadata.Format]
	if formatName == "" {
		formatName = "文本"
	}
	view := struct {
		appresources.TextShare
		SiteName   string
		Error      string
		FormatName string
		Rendered   template.HTML
	}{TextShare: metadata, SiteName: s.stringSetting(r.Context(), "site.name", "GoJet"), FormatName: formatName}
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
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
	_ = textPageTemplate.Execute(w, view)
}

func (s *server) publicBioPage(w http.ResponseWriter, r *http.Request) {
	item, err := s.resources.ReadBio(r.Context(), r.PathValue("slug"))
	if err != nil {
		redirectPublicUnavailable(w, r, "bio", r.PathValue("slug"))
		return
	}
	theme := struct{ Primary, Background, Ink, Muted, Surface string }{Primary: "#16a66a", Background: "#f5faf7", Ink: "#14231d", Muted: "#66766f", Surface: "#ffffff"}
	_ = json.Unmarshal(item.Theme, &theme)
	validHex := regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
	if !validHex.MatchString(theme.Primary) {
		theme.Primary = "#16a66a"
	}
	if !validHex.MatchString(theme.Background) {
		theme.Background = "#f5faf7"
	}
	if !validHex.MatchString(theme.Ink) {
		theme.Ink = "#14231d"
	}
	if !validHex.MatchString(theme.Muted) {
		theme.Muted = "#66766f"
	}
	if !validHex.MatchString(theme.Surface) {
		theme.Surface = "#ffffff"
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
		Title, Bio, Initial, SiteName        string
		Primary, Background, Ink, Muted, Surface template.CSS
		Links                                []struct{ Label, URL string }
	}{item.Title, item.Bio, initial, s.stringSetting(r.Context(), "site.name", "GoJet"), template.CSS(theme.Primary), template.CSS(theme.Background), template.CSS(theme.Ink), template.CSS(theme.Muted), template.CSS(theme.Surface), links}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'")
	_ = bioPageTemplate.Execute(w, view)
}