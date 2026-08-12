package main

import (
	"fmt"
	"html/template"
	"io"
	"net/http"
	"strconv"
	"time"

	appresources "github.com/Techshrr/GoJet_Short_Link/app/resources"
)

var fileShareTemplate = template.Must(template.New("file-share").Funcs(template.FuncMap{
	"bytes": func(v int64) string {
		const unit = 1024
		if v < unit {
			return fmt.Sprintf("%d B", v)
		}
		div, exp := int64(unit), 0
		for n := v / unit; n >= unit && exp < 3; n /= unit {
			div *= unit
			exp++
		}
		return fmt.Sprintf("%.1f %ciB", float64(v)/float64(div), "KMGT"[exp])
	},
	"when": func(v *time.Time) string {
		if v == nil {
			return "长期有效"
		}
		return v.Local().Format("2006-01-02 15:04")
	},
}).Parse(`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>{{.OriginalName}} · {{.SiteName}} 文件分享</title>
<link rel="stylesheet" href="/assets/styles.css">
<link rel="stylesheet" href="/assets/resource-share.css">
<script defer src="/assets/app.js"></script>
<script defer src="/assets/file-share.js"></script>
</head>
<body>
<main class="resourcePage">
  <div class="resourceWrap">
    <div class="resourceIntro">
      <div>
        <p class="resourceEyebrow">FILE SHARE</p>
        <h1>文件分享</h1>
      </div>
      <div class="resourceMeta">通过安全检查后开放下载</div>
    </div>
    <section class="resourceCard">
      <div class="fileIdentity">
        <div class="fileIcon">⇩</div>
        <div><h1>{{.OriginalName}}</h1><p>{{.MIMEType}} · {{bytes .SizeBytes}}</p></div>
      </div>
      <div class="fileMeta">
        <div><small>已下载</small><b>{{.Downloads}} 次</b></div>
        <div><small>有效期</small><b>{{when .ExpiresAt}}</b></div>
        <div><small>下载次数</small><b>{{if .MaxDownloads}}{{.Downloads}} / {{.MaxDownloads}}{{else}}不限{{end}}</b></div>
      </div>
      <div class="fileDownload">
        {{if .Protected}}
          <p>这份文件需要访问密码。密码不会出现在分享地址中。</p>
          <div class="resourceForm"><input id="filePassword" type="password" autocomplete="current-password" placeholder="输入访问密码"></div>
        {{else}}
          <p>文件已经可以下载。</p>
        {{end}}
        <div id="fileError" class="resourceError"></div>
        <button id="fileDownload" class="resourceButton" data-protected="{{.Protected}}">下载文件</button>
      </div>
      <div class="resourceHint">下载前已通过文件安全检查</div>
    </section>
  </div>
</main>
</body>
</html>`))

func (s *server) serveFileSharePage(w http.ResponseWriter, r *http.Request) {
	item, err := s.resources.PublicFileMetadata(r.Context(), r.PathValue("slug"))
	if err != nil {
		http.Error(w, "文件不存在、尚未开放下载、已过期或达到下载次数上限", http.StatusNotFound)
		return
	}
	view := struct {
		appresources.PublicFileMetadata
		SiteName string
	}{PublicFileMetadata: item, SiteName: s.stringSetting(r.Context(), "site.name", "GoJet")}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:; form-action 'none'; base-uri 'none'; frame-ancestors 'none'")
	_ = fileShareTemplate.Execute(w, view)
}

func (s *server) streamFileShare(w http.ResponseWriter, r *http.Request, password string) {
	download, err := s.resources.OpenDownloadWithPassword(r.Context(), r.PathValue("slug"), password)
	if err != nil {
		status := http.StatusNotFound
		message := "文件不存在、尚未开放下载、已过期或达到下载次数上限"
		if err == appresources.ErrFilePassword {
			status = http.StatusForbidden
			message = "访问密码错误"
		}
		jsonResponse(w, status, map[string]string{"error": message})
		return
	}
	defer download.File.Close()
	w.Header().Set("Content-Type", download.MIMEType)
	w.Header().Set("Content-Length", strconv.FormatInt(download.SizeBytes, 10))
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename*=UTF-8''%s`, percentEncodeFilename(download.OriginalName)))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; sandbox")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, download.File)
}
