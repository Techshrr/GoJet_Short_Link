package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/objectstorage"
	appresources "github.com/Techshrr/GoJet_Short_Link/app/resources"
)

const maxSupportAttachmentSize int64 = 10 << 20
const maxSupportAttachmentsPerTicket = 5

type supportTicketAttachment struct {
	ID           int64     `json:"id"`
	TicketID     int64     `json:"ticket_id"`
	MessageID    int64     `json:"message_id"`
	OriginalName string    `json:"original_name"`
	MIMEType     string    `json:"mime_type"`
	SizeBytes    int64     `json:"size_bytes"`
	ScanStatus   string    `json:"scan_status"`
	CreatedAt    time.Time `json:"created_at"`
	DownloadURL  string    `json:"download_url,omitempty"`
}

func supportAttachmentKey(ticketID int64) (string, error) {
	raw := make([]byte, 20)
	if _, err := rand.Read(raw); err != nil { return "", err }
	return fmt.Sprintf("support/tickets/%d/%s", ticketID, hex.EncodeToString(raw)), nil
}

func (s *server) supportAttachmentStore(r *http.Request) (objectstorage.Store, error) {
	return objectstorage.FromEnvironment(r.Context(), getenv("FILE_STORAGE_PATH", "/data/files"))
}

func (s *server) uploadSupportAttachment(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	ticketID, err := pathID(r, "ticket")
	if err != nil { jsonResponse(w, http.StatusBadRequest, map[string]string{"error":"工单编号无效"}); return }
	var messageID int64
	if err = s.db.QueryRowContext(r.Context(), `SELECT m.id FROM support_ticket_messages m JOIN support_tickets t ON t.id=m.ticket_id WHERE t.id=? AND t.user_id=? AND m.author_type='customer' AND m.is_internal=FALSE ORDER BY m.id DESC LIMIT 1`, ticketID, u.ID).Scan(&messageID); err != nil {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error":"工单不存在或尚无可关联消息"}); return
	}
	var count int
	if err = s.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM support_ticket_attachments WHERE ticket_id=?`, ticketID).Scan(&count); err != nil { jsonResponse(w,503,map[string]string{"error":"附件状态暂时不可用"}); return }
	if count >= maxSupportAttachmentsPerTicket { jsonResponse(w,422,map[string]string{"error":"每个工单最多可上传 5 个附件"}); return }

	r.Body = http.MaxBytesReader(w, r.Body, maxSupportAttachmentSize+(1<<20))
	if err = r.ParseMultipartForm(1 << 20); err != nil { jsonResponse(w,413,map[string]string{"error":"附件必须大于零且不超过 10 MB"}); return }
	file, header, err := r.FormFile("file")
	if err != nil { jsonResponse(w,422,map[string]string{"error":"请选择附件"}); return }
	defer file.Close()
	if header.Size <= 0 || header.Size > maxSupportAttachmentSize { jsonResponse(w,413,map[string]string{"error":"附件必须大于零且不超过 10 MB"}); return }
	name := strings.TrimSpace(filepath.Base(header.Filename))
	if name == "" || name == "." || len(name) > 255 { jsonResponse(w,422,map[string]string{"error":"附件文件名无效"}); return }
	mimeType := strings.TrimSpace(header.Header.Get("Content-Type")); if mimeType == "" { mimeType = "application/octet-stream" }
	key, err := supportAttachmentKey(ticketID); if err != nil { jsonResponse(w,503,map[string]string{"error":"无法生成附件存储位置"}); return }
	store, err := s.supportAttachmentStore(r); if err != nil { jsonResponse(w,503,map[string]string{"error":"附件存储暂时不可用"}); return }
	if err = store.Put(r.Context(), key, file, header.Size, mimeType); err != nil { jsonResponse(w,503,map[string]string{"error":"附件保存失败"}); return }
	cleanupObject := true
	defer func(){ if cleanupObject { _ = store.Delete(r.Context(), key) } }()
	result, err := s.db.ExecContext(r.Context(), `INSERT INTO support_ticket_attachments(ticket_id,message_id,original_name,storage_path,mime_type,size_bytes,scan_status) VALUES(?,?,?,?,?,?,'pending')`, ticketID, messageID, name, key, mimeType, header.Size)
	if err != nil { jsonResponse(w,503,map[string]string{"error":"附件记录保存失败"}); return }
	attachmentID, _ := result.LastInsertId()
	path, cleanup, err := store.Materialize(r.Context(), key)
	if err != nil { _,_=s.db.ExecContext(r.Context(),`UPDATE support_ticket_attachments SET scan_status='failed' WHERE id=?`,attachmentID); jsonResponse(w,503,map[string]string{"error":"附件安全扫描准备失败"}); return }
	defer cleanup()
	clean, detail, scanErr := appresources.ScanClamAVEndpoint(r.Context(), getenv("CLAMAV_ADDRESS", "clamav:3310"), path)
	if scanErr != nil {
		_,_=s.db.ExecContext(r.Context(),`UPDATE support_ticket_attachments SET scan_status='failed' WHERE id=?`,attachmentID)
		jsonResponse(w,503,map[string]string{"error":"附件安全扫描暂时不可用"}); return
	}
	if !clean {
		_,_=s.db.ExecContext(r.Context(),`UPDATE support_ticket_attachments SET scan_status='infected' WHERE id=?`,attachmentID)
		_ = store.Delete(r.Context(), key); cleanupObject=false
		_,_=s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,metadata,ip_address) VALUES(?,'support.attachment_blocked','support_ticket_attachment',?,JSON_OBJECT('ticket_id',?,'scanner_result',?),?)`, u.ID, attachmentID, ticketID, detail, clientIP(r))
		jsonResponse(w,422,map[string]string{"error":"附件未通过安全扫描，已阻止保存"}); return
	}
	if _, err = s.db.ExecContext(r.Context(),`UPDATE support_ticket_attachments SET scan_status='clean' WHERE id=?`,attachmentID); err != nil { jsonResponse(w,503,map[string]string{"error":"附件安全状态保存失败"}); return }
	cleanupObject=false
	jsonResponse(w,http.StatusCreated,map[string]any{"id":attachmentID,"ticket_id":ticketID,"message_id":messageID,"original_name":name,"mime_type":mimeType,"size_bytes":header.Size,"scan_status":"clean","download_url":fmt.Sprintf("/api/support/tickets/%d/attachments/%d",ticketID,attachmentID)})
}

func scanSupportAttachments(rows *sql.Rows, base string) ([]supportTicketAttachment, error) {
	items:=[]supportTicketAttachment{}
	for rows.Next(){var item supportTicketAttachment;if err:=rows.Scan(&item.ID,&item.TicketID,&item.MessageID,&item.OriginalName,&item.MIMEType,&item.SizeBytes,&item.ScanStatus,&item.CreatedAt);err!=nil{return nil,err};if item.ScanStatus=="clean"{item.DownloadURL=fmt.Sprintf(base,item.TicketID,item.ID)};items=append(items,item)}
	return items,rows.Err()
}

func (s *server) listSupportAttachments(w http.ResponseWriter,r *http.Request){
	u:=currentUser(r);ticketID,err:=pathID(r,"ticket");if err!=nil{jsonResponse(w,400,map[string]string{"error":"工单编号无效"});return}
	var owner int64;if err=s.db.QueryRowContext(r.Context(),`SELECT user_id FROM support_tickets WHERE id=?`,ticketID).Scan(&owner);err!=nil||owner!=u.ID{jsonResponse(w,404,map[string]string{"error":"工单不存在"});return}
	rows,err:=s.db.QueryContext(r.Context(),`SELECT id,ticket_id,message_id,original_name,mime_type,size_bytes,scan_status,created_at FROM support_ticket_attachments WHERE ticket_id=? ORDER BY created_at,id`,ticketID);if err!=nil{jsonResponse(w,503,map[string]string{"error":"附件列表暂时不可用"});return};defer rows.Close()
	items,err:=scanSupportAttachments(rows,"/api/support/tickets/%d/attachments/%d");if err!=nil{jsonResponse(w,503,map[string]string{"error":"附件列表读取失败"});return};jsonResponse(w,200,map[string]any{"data":items})
}

func (s *server) adminListSupportAttachments(w http.ResponseWriter,r *http.Request){
	ticketID,err:=pathID(r,"ticket");if err!=nil{jsonResponse(w,400,map[string]string{"error":"工单编号无效"});return}
	rows,err:=s.db.QueryContext(r.Context(),`SELECT id,ticket_id,message_id,original_name,mime_type,size_bytes,scan_status,created_at FROM support_ticket_attachments WHERE ticket_id=? ORDER BY created_at,id`,ticketID);if err!=nil{jsonResponse(w,503,map[string]string{"error":"附件列表暂时不可用"});return};defer rows.Close()
	items,err:=scanSupportAttachments(rows,"/api/admin/support/tickets/%d/attachments/%d");if err!=nil{jsonResponse(w,503,map[string]string{"error":"附件列表读取失败"});return};jsonResponse(w,200,map[string]any{"data":items})
}

func (s *server) streamSupportAttachment(w http.ResponseWriter,r *http.Request,admin bool){
	ticketID,e1:=pathID(r,"ticket");attachmentID,e2:=pathID(r,"attachment");if e1!=nil||e2!=nil{jsonResponse(w,400,map[string]string{"error":"附件编号无效"});return}
	query:=`SELECT a.original_name,a.storage_path,a.mime_type,a.size_bytes,a.scan_status,t.user_id FROM support_ticket_attachments a JOIN support_tickets t ON t.id=a.ticket_id WHERE a.id=? AND a.ticket_id=?`;var name,key,mimeType,status string;var size,userID int64
	if err:=s.db.QueryRowContext(r.Context(),query,attachmentID,ticketID).Scan(&name,&key,&mimeType,&size,&status,&userID);err!=nil{jsonResponse(w,404,map[string]string{"error":"附件不存在"});return}
	if !admin&&userID!=currentUser(r).ID{jsonResponse(w,404,map[string]string{"error":"附件不存在"});return};if status!="clean"{jsonResponse(w,409,map[string]string{"error":"附件尚未通过安全扫描"});return}
	store,err:=s.supportAttachmentStore(r);if err!=nil{jsonResponse(w,503,map[string]string{"error":"附件存储暂时不可用"});return};reader,err:=store.Open(r.Context(),key);if err!=nil{jsonResponse(w,404,map[string]string{"error":"附件文件不存在"});return};defer reader.Close()
	w.Header().Set("Content-Type",mimeType);w.Header().Set("Content-Length",fmt.Sprintf("%d",size));w.Header().Set("Content-Disposition","attachment; filename*=UTF-8''"+url.PathEscape(name));w.Header().Set("X-Content-Type-Options","nosniff");w.Header().Set("Cache-Control","private, no-store");_,_=io.Copy(w,reader)
}
func (s *server) downloadSupportAttachment(w http.ResponseWriter,r *http.Request){s.streamSupportAttachment(w,r,false)}
func (s *server) adminDownloadSupportAttachment(w http.ResponseWriter,r *http.Request){s.streamSupportAttachment(w,r,true)}
