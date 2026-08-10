package main

import (
	"fmt"
	"log"
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
	if decode(w, r, &in) != nil { return }
	if err != nil { jsonResponse(w, 400, map[string]string{"error":"工作区编号无效"}); return }
	item, err := s.resources.CreateText(r.Context(), currentUser(r).ID, wid, in.TextShare, in.Password)
	if err != nil { jsonResponse(w, 422, map[string]string{"error":err.Error()}); return }
	item.Content = ""
	jsonResponse(w, 201, item)
}

func (s *server) listTextShares(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := pathID(r, "id")
	if err != nil { jsonResponse(w, http.StatusBadRequest, map[string]string{"error":"工作区编号无效"}); return }
	items, err := s.resources.ListTexts(r.Context(), currentUser(r).ID, workspaceID)
	if err != nil { jsonResponse(w, http.StatusForbidden, map[string]string{"error":"无权查看文本分享"}); return }
	jsonResponse(w, http.StatusOK, map[string]any{"data":items})
}

func (s *server) getTextShare(w http.ResponseWriter, r *http.Request) {
	workspaceID, workspaceErr := pathID(r, "id")
	shareID, shareErr := pathID(r, "share")
	if workspaceErr != nil || shareErr != nil { jsonResponse(w, http.StatusBadRequest, map[string]string{"error":"编号无效"}); return }
	item, err := s.resources.GetText(r.Context(), currentUser(r).ID, workspaceID, shareID)
	if err != nil { jsonResponse(w, http.StatusNotFound, map[string]string{"error":"文本分享不存在"}); return }
	jsonResponse(w, http.StatusOK, item)
}

func (s *server) updateTextShare(w http.ResponseWriter, r *http.Request) {
	workspaceID, workspaceErr := pathID(r, "id")
	shareID, shareErr := pathID(r, "share")
	var input struct { appresources.TextShare; Password *string `json:"password"` }
	if decode(w, r, &input) != nil { return }
	if workspaceErr != nil || shareErr != nil { jsonResponse(w, http.StatusBadRequest, map[string]string{"error":"编号无效"}); return }
	if err := s.resources.UpdateText(r.Context(), currentUser(r).ID, workspaceID, shareID, input.TextShare, input.Password); err != nil { jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error":err.Error()}); return }
	jsonResponse(w, http.StatusOK, map[string]bool{"updated":true})
}

func (s *server) deleteTextShare(w http.ResponseWriter, r *http.Request) {
	workspaceID, workspaceErr := pathID(r, "id")
	shareID, shareErr := pathID(r, "share")
	if workspaceErr != nil || shareErr != nil { jsonResponse(w, http.StatusBadRequest, map[string]string{"error":"编号无效"}); return }
	if err := s.resources.DeleteText(r.Context(), currentUser(r).ID, workspaceID, shareID); err != nil { jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error":"无法删除文本分享"}); return }
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) createFileShare(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	if err != nil { jsonResponse(w, 400, map[string]string{"error":"工作区编号无效"}); return }
	r.Body = http.MaxBytesReader(w, r.Body, appresources.MaxFileSize+(1<<20))
	if err = r.ParseMultipartForm(1 << 20); err != nil { jsonResponse(w, 413, map[string]string{"error":"文件必须大于零且不超过 100 MB"}); return }
	file, header, err := r.FormFile("file")
	if err != nil { jsonResponse(w, 422, map[string]string{"error":"请选择文件"}); return }
	defer file.Close()
	var expiresAt *time.Time
	if raw := strings.TrimSpace(r.FormValue("expires_at")); raw != "" {
		parsed, parseErr := time.Parse(time.RFC3339, raw); if parseErr != nil { jsonResponse(w, 422, map[string]string{"error":"有效期格式无效，请重新选择时间"}); return }; expiresAt=&parsed
	}
	var maxDownloads *int64
	if raw := strings.TrimSpace(r.FormValue("max_downloads")); raw != "" {
		parsed, parseErr := strconv.ParseInt(raw,10,64); if parseErr != nil { jsonResponse(w,422,map[string]string{"error":"最大下载次数无效"}); return }; maxDownloads=&parsed
	}
	password := strings.TrimSpace(r.FormValue("password"))
	if password != "" && (len(password) < 6 || len(password) > 128) { jsonResponse(w,422,map[string]string{"error":"文件访问密码必须为 6 到 128 位"}); return }
	item, err := s.resources.CreateFile(r.Context(), currentUser(r).ID, wid, header.Filename, header.Header.Get("Content-Type"), file, expiresAt, maxDownloads)
	if err != nil { jsonResponse(w,422,map[string]string{"error":err.Error()}); return }
	if password != "" {
		if err = s.resources.SetFilePassword(r.Context(), currentUser(r).ID, wid, item.ID, password); err != nil {
			_ = s.resources.DeleteFile(r.Context(), currentUser(r).ID, wid, item.ID, 0)
			jsonResponse(w,422,map[string]string{"error":"无法设置文件访问密码"}); return
		}
	}
	jsonResponse(w,202,map[string]any{"id":item.ID,"workspace_id":item.WorkspaceID,"slug":item.Slug,"original_name":item.OriginalName,"mime_type":item.MIMEType,"size_bytes":item.SizeBytes,"scan_status":item.ScanStatus,"status":item.Status,"expires_at":item.ExpiresAt,"max_downloads":item.MaxDownloads,"downloads":item.Downloads,"protected":password!=""})
}

func (s *server) listFileShares(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	if err != nil { jsonResponse(w,400,map[string]string{"error":"工作区编号无效"}); return }
	items, err := s.resources.ListFiles(r.Context(), currentUser(r).ID, wid)
	if err != nil { jsonResponse(w,403,map[string]string{"error":"无权查看该工作区文件"}); return }
	protection, _ := s.resources.FileProtectionMap(r.Context(), wid)
	data := make([]map[string]any,0,len(items))
	for _, item := range items {
		data = append(data,map[string]any{"id":item.ID,"workspace_id":item.WorkspaceID,"slug":item.Slug,"original_name":item.OriginalName,"mime_type":item.MIMEType,"size_bytes":item.SizeBytes,"scan_status":item.ScanStatus,"scan_result":item.ScanResult,"status":item.Status,"expires_at":item.ExpiresAt,"max_downloads":item.MaxDownloads,"downloads":item.Downloads,"protected":protection[item.ID]})
	}
	jsonResponse(w,200,map[string]any{"data":data})
}

func (s *server) deleteFileShare(w http.ResponseWriter, r *http.Request) {
	workspaceID, workspaceErr := pathID(r,"id"); fileID, fileErr := pathID(r,"file")
	if workspaceErr != nil || fileErr != nil { jsonResponse(w,http.StatusBadRequest,map[string]string{"error":"编号无效"}); return }
	retention:=7*24*time.Hour
	if raw:=strings.TrimSpace(r.URL.Query().Get("retention_days")); raw!="" { days,err:=strconv.Atoi(raw); if err!=nil||days<0||days>30 { jsonResponse(w,http.StatusUnprocessableEntity,map[string]string{"error":"保留天数必须为 0 到 30"}); return }; retention=time.Duration(days)*24*time.Hour }
	if err:=s.resources.DeleteFile(r.Context(),currentUser(r).ID,workspaceID,fileID,retention); err!=nil { jsonResponse(w,http.StatusUnprocessableEntity,map[string]string{"error":"无法删除文件分享"}); return }
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) downloadFileShare(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { jsonResponse(w,http.StatusMethodNotAllowed,map[string]string{"error":"请使用 GET 下载文件"}); return }
	if r.Header.Get("X-GoJet-Public-File-Page") == "1" && r.URL.Query().Get("download") != "1" { s.serveFileSharePage(w,r); return }
	password := ""
	if r.Header.Get("X-GoJet-Public-File-Page") == "1" { password = r.Header.Get("X-GoJet-File-Password") }
	s.streamFileShare(w,r,password)
}

func percentEncodeFilename(name string) string {
	var output strings.Builder
	for _, value := range []byte(name) { if (value>='a'&&value<='z')||(value>='A'&&value<='Z')||(value>='0'&&value<='9')||strings.ContainsRune("._-",rune(value)) { output.WriteByte(value) } else { fmt.Fprintf(&output,"%%%02X",value) } }
	return output.String()
}

func (s *server) readTextShare(w http.ResponseWriter, r *http.Request) {
	var in struct { Password string `json:"password"` }
	if decode(w,r,&in)!=nil { return }
	item,err:=s.resources.ReadText(r.Context(),r.PathValue("slug"),in.Password)
	if err!=nil { jsonResponse(w,403,map[string]string{"error":"文本不存在、已过期、已读取或密码错误"}); return }
	jsonResponse(w,200,item)
}

func (s *server) createBioPage(w http.ResponseWriter, r *http.Request) {
	wid,err:=pathID(r,"id"); var item appresources.BioPage
	if decode(w,r,&item)!=nil { return }
	if err!=nil { jsonResponse(w,400,map[string]string{"error":"工作区编号无效"}); return }
	item,err=s.resources.CreateBio(r.Context(),currentUser(r).ID,wid,item)
	if err!=nil { jsonResponse(w,422,map[string]string{"error":err.Error()}); return }
	jsonResponse(w,201,item)
}

func (s *server) listBioPages(w http.ResponseWriter, r *http.Request) {
	workspaceID,err:=pathID(r,"id"); if err!=nil { jsonResponse(w,http.StatusBadRequest,map[string]string{"error":"工作区编号无效"}); return }
	items,err:=s.resources.ListBios(r.Context(),currentUser(r).ID,workspaceID); if err!=nil { jsonResponse(w,http.StatusForbidden,map[string]string{"error":"无权查看个人主页"}); return }; jsonResponse(w,http.StatusOK,map[string]any{"data":items})
}
func (s *server) updateBioPage(w http.ResponseWriter, r *http.Request) {
	workspaceID,workspaceErr:=pathID(r,"id"); pageID,pageErr:=pathID(r,"page"); var item appresources.BioPage
	if decode(w,r,&item)!=nil{return}; if workspaceErr!=nil||pageErr!=nil{jsonResponse(w,http.StatusBadRequest,map[string]string{"error":"编号无效"});return}; if err:=s.resources.UpdateBio(r.Context(),currentUser(r).ID,workspaceID,pageID,item);err!=nil{jsonResponse(w,http.StatusUnprocessableEntity,map[string]string{"error":err.Error()});return}; jsonResponse(w,http.StatusOK,map[string]bool{"updated":true})
}
func (s *server) deleteBioPage(w http.ResponseWriter, r *http.Request) {
	workspaceID,workspaceErr:=pathID(r,"id");pageID,pageErr:=pathID(r,"page");if workspaceErr!=nil||pageErr!=nil{jsonResponse(w,http.StatusBadRequest,map[string]string{"error":"编号无效"});return};if err:=s.resources.DeleteBio(r.Context(),currentUser(r).ID,workspaceID,pageID);err!=nil{jsonResponse(w,http.StatusUnprocessableEntity,map[string]string{"error":"无法删除个人主页"});return};w.WriteHeader(http.StatusNoContent)
}
func (s *server) readBioPage(w http.ResponseWriter,r *http.Request){item,err:=s.resources.ReadBio(r.Context(),r.PathValue("slug"));if err!=nil{jsonResponse(w,404,map[string]string{"error":"个人主页不存在或尚未发布"});return};jsonResponse(w,200,item)}
func (s *server) createQRCode(w http.ResponseWriter,r *http.Request){wid,err:=pathID(r,"id");var in struct{LinkID int64 `json:"link_id"`;Name,Foreground,Background string;Size int};if decode(w,r,&in)!=nil{return};if err!=nil{jsonResponse(w,400,map[string]string{"error":"工作区编号无效"});return};item,err:=s.resources.CreateQR(r.Context(),currentUser(r).ID,wid,in.LinkID,in.Name,in.Foreground,in.Background,in.Size);if err!=nil{jsonResponse(w,422,map[string]string{"error":err.Error()});return};jsonResponse(w,201,item)}
func (s *server) listQRCodes(w http.ResponseWriter,r *http.Request){
	workspaceID,err:=pathID(r,"id")
	if err!=nil{jsonResponse(w,http.StatusBadRequest,map[string]string{"error":"工作区编号无效"});return}
	userID:=currentUser(r).ID
	if _,err=s.workspace.Role(r.Context(),workspaceID,userID);err!=nil{jsonResponse(w,http.StatusForbidden,map[string]string{"error":"无权查看二维码"});return}
	items,err:=s.resources.ListQRs(r.Context(),userID,workspaceID)
	if err!=nil{
		log.Printf("list QR codes failed for workspace=%d user=%d: %v",workspaceID,userID,err)
		jsonResponse(w,http.StatusServiceUnavailable,map[string]string{"error":"二维码列表暂时无法读取"})
		return
	}
	jsonResponse(w,http.StatusOK,map[string]any{"data":items})
}
func (s *server) deleteQRCode(w http.ResponseWriter,r *http.Request){workspaceID,workspaceErr:=pathID(r,"id");qrID,qrErr:=pathID(r,"qr");if workspaceErr!=nil||qrErr!=nil{jsonResponse(w,http.StatusBadRequest,map[string]string{"error":"编号无效"});return};if err:=s.resources.DeleteQR(r.Context(),currentUser(r).ID,workspaceID,qrID);err!=nil{jsonResponse(w,http.StatusUnprocessableEntity,map[string]string{"error":"无法删除二维码"});return};w.WriteHeader(http.StatusNoContent)}
