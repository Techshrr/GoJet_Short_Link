package main

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	appresources "github.com/Techshrr/GoJet_Short_Link/app/resources"
)

func (s *server) createTextShare(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	var in struct {
		appresources.TextShare
		Password string `json:"password"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid workspace"})
		return
	}
	item, err := s.resources.CreateText(r.Context(), currentUser(r).ID, wid, in.TextShare, in.Password)
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	item.Content = ""
	jsonResponse(w, 201, item)
}

func (s *server) createFileShare(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid workspace"})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, appresources.MaxFileSize+(1<<20))
	if err = r.ParseMultipartForm(1 << 20); err != nil {
		jsonResponse(w, 413, map[string]string{"error": "文件必须大于零且不超过 100MB"})
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": "请选择文件"})
		return
	}
	defer file.Close()
	var expiresAt *time.Time
	if raw := strings.TrimSpace(r.FormValue("expires_at")); raw != "" {
		parsed, parseErr := time.Parse(time.RFC3339, raw)
		if parseErr != nil {
			jsonResponse(w, 422, map[string]string{"error": "有效期必须为 RFC3339 时间"})
			return
		}
		expiresAt = &parsed
	}
	var maxDownloads *int64
	if raw := strings.TrimSpace(r.FormValue("max_downloads")); raw != "" {
		parsed, parseErr := strconv.ParseInt(raw, 10, 64)
		if parseErr != nil {
			jsonResponse(w, 422, map[string]string{"error": "最大下载次数无效"})
			return
		}
		maxDownloads = &parsed
	}
	item, err := s.resources.CreateFile(r.Context(), currentUser(r).ID, wid, header.Filename, header.Header.Get("Content-Type"), file, expiresAt, maxDownloads)
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 202, item)
}

func (s *server) listFileShares(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid workspace"})
		return
	}
	items, err := s.resources.ListFiles(r.Context(), currentUser(r).ID, wid)
	if err != nil {
		jsonResponse(w, 403, map[string]string{"error": "无权查看该工作区文件"})
		return
	}
	jsonResponse(w, 200, map[string]any{"data": items})
}

func (s *server) downloadFileShare(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonResponse(w, http.StatusMethodNotAllowed, map[string]string{"error": "请使用 GET 下载文件"})
		return
	}
	download, err := s.resources.OpenDownload(r.Context(), r.PathValue("slug"))
	if err != nil {
		jsonResponse(w, 404, map[string]string{"error": "文件不存在、仍在安全扫描、已过期或达到下载上限"})
		return
	}
	defer download.File.Close()
	w.Header().Set("Content-Type", download.MIMEType)
	w.Header().Set("Content-Length", strconv.FormatInt(download.SizeBytes, 10))
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename*=UTF-8''%s`, percentEncodeFilename(download.OriginalName)))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; sandbox")
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, download.File)
}

func percentEncodeFilename(name string) string {
	var output strings.Builder
	for _, value := range []byte(name) {
		if (value >= 'a' && value <= 'z') || (value >= 'A' && value <= 'Z') || (value >= '0' && value <= '9') || strings.ContainsRune("._-", rune(value)) {
			output.WriteByte(value)
		} else {
			fmt.Fprintf(&output, "%%%02X", value)
		}
	}
	return output.String()
}
func (s *server) readTextShare(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Password string `json:"password"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	item, err := s.resources.ReadText(r.Context(), r.PathValue("slug"), in.Password)
	if err != nil {
		jsonResponse(w, 403, map[string]string{"error": "文本不存在、已过期、已读取或密码错误"})
		return
	}
	jsonResponse(w, 200, item)
}
func (s *server) createBioPage(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	var item appresources.BioPage
	if decode(w, r, &item) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid workspace"})
		return
	}
	item, err = s.resources.CreateBio(r.Context(), currentUser(r).ID, wid, item)
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 201, item)
}
func (s *server) readBioPage(w http.ResponseWriter, r *http.Request) {
	item, err := s.resources.ReadBio(r.Context(), r.PathValue("slug"))
	if err != nil {
		jsonResponse(w, 404, map[string]string{"error": "个人主页不存在或尚未发布"})
		return
	}
	jsonResponse(w, 200, item)
}
func (s *server) createQRCode(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	var in struct {
		LinkID                       int64 `json:"link_id"`
		Name, Foreground, Background string
		Size                         int
	}
	if decode(w, r, &in) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid workspace"})
		return
	}
	item, err := s.resources.CreateQR(r.Context(), currentUser(r).ID, wid, in.LinkID, in.Name, in.Foreground, in.Background, in.Size)
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 201, item)
}
