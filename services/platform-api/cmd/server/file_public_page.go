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
}).Parse(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>{{.OriginalName}} · GoJet 文件分享</title><style>*{box-sizing:border-box}body{margin:0;background:#f7faf8;color:#101828;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{width:min(680px,calc(100% - 28px));margin:70px auto}.brand{font-size:22px;font-weight:900;letter-spacing:-.04em}.brand i{color:#22c55e;font-style:normal}.card{margin-top:20px;background:#fff;border:1px solid #e3e9e5;border-radius:20px;padding:28px;box-shadow:0 20px 55px rgba(20,83,45,.08)}.file{display:flex;gap:16px;align-items:center}.icon{width:58px;height:58px;border-radius:16px;background:#ecfdf3;color:#15803d;display:grid;place-items:center;font-size:24px;font-weight:900;flex:none}.file h1{font-size:20px;line-height:1.35;margin:0;word-break:break-all}.file p{margin:4px 0 0;color:#667085}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:22px 0}.meta div{background:#f8faf9;border:1px solid #eef2ef;border-radius:10px;padding:11px}.meta small{display:block;color:#98a2b3;font-size:9px;text-transform:uppercase;letter-spacing:.07em}.meta b{display:block;margin-top:3px;font-size:12px}.download{border-top:1px solid #eef2ef;padding-top:20px}.download p{color:#667085}.password{display:flex;gap:8px;margin-bottom:10px}.password input{flex:1;height:44px;border:1px solid #d0d5dd;border-radius:9px;padding:0 11px;font:inherit}.button{width:100%;height:46px;border:0;border-radius:10px;background:#101828;color:#fff;font-weight:800;cursor:pointer}.button:hover{background:#1d2939}.button:disabled{opacity:.55}.error{display:none;margin:10px 0;padding:9px 11px;border:1px solid #fecdca;background:#fef3f2;color:#b42318;border-radius:8px}.error.show{display:block}.hint{margin-top:14px;color:#98a2b3;font-size:10px;text-align:center}@media(max-width:540px){main{margin:30px auto}.card{padding:20px}.meta{grid-template-columns:1fr}.file{align-items:flex-start}}</style></head><body><main><div class="brand">GoJet<i>.</i></div><section class="card"><div class="file"><div class="icon">⇩</div><div><h1>{{.OriginalName}}</h1><p>{{.MIMEType}} · {{bytes .SizeBytes}}</p></div></div><div class="meta"><div><small>已下载</small><b>{{.Downloads}} 次</b></div><div><small>有效期</small><b>{{when .ExpiresAt}}</b></div><div><small>下载限制</small><b>{{if .MaxDownloads}}{{.Downloads}} / {{.MaxDownloads}}{{else}}不限{{end}}</b></div></div><div class="download">{{if .Protected}}<p>此文件受密码保护。密码只用于当前下载请求，不会写入地址栏。</p><div class="password"><input id="filePassword" type="password" autocomplete="current-password" placeholder="输入访问密码"></div>{{else}}<p>文件已通过安全扫描，可以直接下载。</p>{{end}}<div id="fileError" class="error"></div><button id="fileDownload" class="button" data-protected="{{.Protected}}">下载文件</button></div><div class="hint">GoJet 只在安全扫描通过后开放文件下载。</div></section></main><script src="/assets/file-share.js?v=hardening-1"></script></body></html>`))

func (s *server) serveFileSharePage(w http.ResponseWriter, r *http.Request) {
	item, err := s.resources.PublicFileMetadata(r.Context(), r.PathValue("slug"))
	if err != nil {
		http.Error(w, "文件不存在、仍在安全扫描、已过期或达到下载上限", http.StatusNotFound)
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
		message := "文件不存在、仍在安全扫描、已过期或达到下载上限"
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
