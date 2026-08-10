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
}).Parse(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>{{.OriginalName}} · GoJet 文件分享</title><style>:root{--brand:#16a66a;--brand-dark:#12885a;--brand-soft:#e9f8f1;--ink:#14231d;--muted:#708077;--line:#dce5e0;--bg:#f6f8f7;--danger:#c93838}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.65 Inter,"PingFang SC","Microsoft YaHei",system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}main{width:min(680px,calc(100% - 28px));margin:64px auto}.brand{font-size:23px;font-weight:900;letter-spacing:-.04em}.brand i{color:var(--brand);font-style:normal}.card{margin-top:20px;background:#fff;border:1px solid var(--line);border-radius:18px;padding:28px;box-shadow:0 18px 50px rgba(24,55,41,.08)}.file{display:flex;gap:16px;align-items:center}.icon{width:58px;height:58px;border-radius:16px;background:var(--brand-soft);color:var(--brand-dark);display:grid;place-items:center;font-size:24px;font-weight:900;flex:none}.file h1{font-size:20px;line-height:1.35;margin:0;word-break:break-word}.file p{margin:4px 0 0;color:var(--muted)}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:22px 0}.meta div{background:#f9fbfa;border:1px solid #edf1ef;border-radius:10px;padding:11px}.meta small{display:block;color:#849289;font-size:11px}.meta b{display:block;margin-top:3px;font-size:12px}.download{border-top:1px solid #edf1ef;padding-top:20px}.download p{color:var(--muted)}.password{display:flex;gap:8px;margin-bottom:10px}.password input{flex:1;height:44px;border:1px solid #c8d5ce;border-radius:9px;padding:0 11px;font:inherit}.password input:focus{outline:0;border-color:var(--brand);box-shadow:0 0 0 3px rgba(22,166,106,.18)}.button{width:100%;height:46px;border:1px solid var(--brand);border-radius:9px;background:var(--brand);color:#fff;font-weight:800;cursor:pointer}.button:hover{background:var(--brand-dark);border-color:var(--brand-dark)}.button:disabled{opacity:.55;cursor:not-allowed}.error{display:none;margin:10px 0;padding:10px 12px;border:1px solid #efc5c5;background:#fff0f0;color:#a52e2e;border-radius:9px}.error.show{display:block}.hint{margin-top:15px;color:#849289;font-size:11px;text-align:center}.hint b{color:var(--brand)}@media(max-width:540px){main{margin:28px auto}.card{padding:20px}.meta{grid-template-columns:1fr}.file{align-items:flex-start}}</style></head><body><main><div class="brand">GoJet<i>.</i></div><section class="card"><div class="file"><div class="icon">⇩</div><div><h1>{{.OriginalName}}</h1><p>{{.MIMEType}} · {{bytes .SizeBytes}}</p></div></div><div class="meta"><div><small>已下载</small><b>{{.Downloads}} 次</b></div><div><small>有效期</small><b>{{when .ExpiresAt}}</b></div><div><small>下载次数</small><b>{{if .MaxDownloads}}{{.Downloads}} / {{.MaxDownloads}}{{else}}不限{{end}}</b></div></div><div class="download">{{if .Protected}}<p>这份文件需要访问密码。密码不会出现在分享地址中。</p><div class="password"><input id="filePassword" type="password" autocomplete="current-password" placeholder="输入访问密码"></div>{{else}}<p>文件已经可以下载。</p>{{end}}<div id="fileError" class="error"></div><button id="fileDownload" class="button" data-protected="{{.Protected}}">下载文件</button></div><div class="hint">文件通过安全检查后才会开放下载 · 由 <b>GoJet</b> 提供</div></section></main><script src="/assets/file-share.js?v=brand-1"></script></body></html>`))

func (s *server) serveFileSharePage(w http.ResponseWriter, r *http.Request) {
	item, err := s.resources.PublicFileMetadata(r.Context(), r.PathValue("slug"))
	if err != nil {
		http.Error(w, "文件不存在、尚未开放下载、已过期或达到下载次数上限", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'")
	_ = fileShareTemplate.Execute(w, item)
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
