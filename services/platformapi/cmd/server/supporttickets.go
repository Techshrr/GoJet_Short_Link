package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type supportTicketSummary struct {
	ID             int64      `json:"id"`
	TicketNumber   string     `json:"ticket_number"`
	UserID         int64      `json:"user_id"`
	UserEmail      string     `json:"user_email,omitempty"`
	WorkspaceID    *int64     `json:"workspace_id,omitempty"`
	DepartmentID   int64      `json:"department_id"`
	DepartmentName string     `json:"department_name"`
	Subject        string     `json:"subject"`
	Priority       string     `json:"priority"`
	Status         string     `json:"status"`
	LastReplyAt    time.Time  `json:"last_reply_at"`
	LastReplyBy    string     `json:"last_reply_by"`
	ClosedAt       *time.Time `json:"closed_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type supportTicketMessage struct {
	ID                   int64     `json:"id"`
	AuthorType           string    `json:"author_type"`
	AuthorUserID          *int64    `json:"author_user_id,omitempty"`
	AuthorAdministratorID *int64    `json:"author_administrator_id,omitempty"`
	AuthorName            string    `json:"author_name"`
	Body                  string    `json:"body"`
	Internal              bool      `json:"internal"`
	IPAddress             string    `json:"ip_address,omitempty"`
	CreatedAt             time.Time `json:"created_at"`
}

func supportTicketNumber() (string, error) {
	random := make([]byte, 4)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}
	return fmt.Sprintf("GJ-%s-%s", time.Now().UTC().Format("060102"), strings.ToUpper(hex.EncodeToString(random))), nil
}

func validTicketPriority(value string) bool {
	switch value {
	case "low", "normal", "high", "urgent":
		return true
	default:
		return false
	}
}

func validTicketStatus(value string) bool {
	switch value {
	case "open", "customer_reply", "staff_reply", "in_progress", "resolved", "closed":
		return true
	default:
		return false
	}
}

func (s *server) supportDepartments(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.QueryContext(r.Context(), `SELECT id,name,slug,description FROM support_departments WHERE is_active=TRUE ORDER BY sort_order,id`)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "支持部门暂时不可用"})
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id int64
		var name, slug string
		var description sql.NullString
		if err = rows.Scan(&id, &name, &slug, &description); err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "支持部门读取失败"})
			return
		}
		items = append(items, map[string]any{"id": id, "name": name, "slug": slug, "description": description.String})
	}
	jsonResponse(w, http.StatusOK, map[string]any{"data": items})
}

func (s *server) createSupportTicket(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var in struct {
		DepartmentID int64  `json:"department_id"`
		WorkspaceID  *int64 `json:"workspace_id"`
		Subject      string `json:"subject"`
		Priority     string `json:"priority"`
		Message      string `json:"message"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	in.Subject = strings.TrimSpace(in.Subject)
	in.Message = strings.TrimSpace(in.Message)
	if len(in.Subject) < 3 || len(in.Subject) > 220 || len(in.Message) < 2 || len(in.Message) > 50000 {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "请填写有效的工单主题和问题描述"})
		return
	}
	if in.Priority == "" {
		in.Priority = "normal"
	}
	if !validTicketPriority(in.Priority) {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "工单优先级无效"})
		return
	}
	var departmentName string
	if err := s.db.QueryRowContext(r.Context(), `SELECT name FROM support_departments WHERE id=? AND is_active=TRUE`, in.DepartmentID).Scan(&departmentName); err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "支持部门无效"})
		return
	}
	if in.WorkspaceID != nil {
		var membership int
		if err := s.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM workspace_members WHERE workspace_id=? AND user_id=? AND status='active'`, *in.WorkspaceID, u.ID).Scan(&membership); err != nil || membership == 0 {
			jsonResponse(w, http.StatusForbidden, map[string]string{"error": "不能为无权访问的工作区创建工单"})
			return
		}
	}
	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "工单服务暂时不可用"})
		return
	}
	defer tx.Rollback()
	var ticketID int64
	var number string
	for attempt := 0; attempt < 5; attempt++ {
		number, err = supportTicketNumber()
		if err != nil {
			break
		}
		result, execErr := tx.ExecContext(r.Context(), `INSERT INTO support_tickets(ticket_number,user_id,workspace_id,department_id,subject,priority,status,last_reply_by) VALUES(?,?,?,?,?,?,'open','customer')`, number, u.ID, in.WorkspaceID, in.DepartmentID, in.Subject, in.Priority)
		if execErr == nil {
			ticketID, _ = result.LastInsertId()
			err = nil
			break
		}
		err = execErr
	}
	if err != nil || ticketID == 0 {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "工单编号生成失败，请重试"})
		return
	}
	if _, err = tx.ExecContext(r.Context(), `INSERT INTO support_ticket_messages(ticket_id,author_type,author_user_id,body,ip_address) VALUES(?,'customer',?,?,?)`, ticketID, u.ID, in.Message, clientIP(r)); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "工单内容保存失败"})
		return
	}
	if err = tx.Commit(); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "工单保存失败"})
		return
	}
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(actor_user_id,workspace_id,action,target_type,target_id,metadata,ip_address) VALUES(?,?, 'support.ticket_created','support_ticket',?,JSON_OBJECT('number',?,'department',?,'priority',?),?)`, u.ID, in.WorkspaceID, ticketID, number, departmentName, in.Priority, clientIP(r))
	_, _ = s.mail.QueueTemplate(r.Context(), "support_ticket_created", u.Email, map[string]string{"site_name": "GoJet", "ticket_number": number, "subject": in.Subject})
	jsonResponse(w, http.StatusCreated, map[string]any{"id": ticketID, "ticket_number": number, "status": "open"})
}

func (s *server) listSupportTickets(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	rows, err := s.db.QueryContext(r.Context(), `SELECT t.id,t.ticket_number,t.user_id,t.workspace_id,t.department_id,d.name,t.subject,t.priority,t.status,t.last_reply_at,t.last_reply_by,t.closed_at,t.created_at FROM support_tickets t JOIN support_departments d ON d.id=t.department_id WHERE t.user_id=? ORDER BY t.last_reply_at DESC,t.id DESC`, u.ID)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "工单列表暂时不可用"})
		return
	}
	defer rows.Close()
	items, err := scanSupportTicketRows(rows, false)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "工单列表读取失败"})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{"data": items})
}

func scanSupportTicketRows(rows *sql.Rows, withEmail bool) ([]supportTicketSummary, error) {
	items := []supportTicketSummary{}
	for rows.Next() {
		var item supportTicketSummary
		var workspace sql.NullInt64
		var closed sql.NullTime
		var err error
		if withEmail {
			err = rows.Scan(&item.ID, &item.TicketNumber, &item.UserID, &item.UserEmail, &workspace, &item.DepartmentID, &item.DepartmentName, &item.Subject, &item.Priority, &item.Status, &item.LastReplyAt, &item.LastReplyBy, &closed, &item.CreatedAt)
		} else {
			err = rows.Scan(&item.ID, &item.TicketNumber, &item.UserID, &workspace, &item.DepartmentID, &item.DepartmentName, &item.Subject, &item.Priority, &item.Status, &item.LastReplyAt, &item.LastReplyBy, &closed, &item.CreatedAt)
		}
		if err != nil {
			return nil, err
		}
		if workspace.Valid {
			value := workspace.Int64
			item.WorkspaceID = &value
		}
		if closed.Valid {
			value := closed.Time
			item.ClosedAt = &value
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *server) supportTicketDetail(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id, err := pathID(r, "ticket")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工单编号无效"})
		return
	}
	item, messages, err := s.loadSupportTicket(r, id, &u.ID, false)
	if err != nil {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "工单不存在"})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{"ticket": item, "messages": messages})
}

func (s *server) replySupportTicket(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id, err := pathID(r, "ticket")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工单编号无效"})
		return
	}
	var in struct{ Message string `json:"message"` }
	if decode(w, r, &in) != nil {
		return
	}
	in.Message = strings.TrimSpace(in.Message)
	if len(in.Message) < 2 || len(in.Message) > 50000 {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "回复内容无效"})
		return
	}
	var status string
	if err = s.db.QueryRowContext(r.Context(), `SELECT status FROM support_tickets WHERE id=? AND user_id=?`, id, u.ID).Scan(&status); err != nil {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "工单不存在"})
		return
	}
	if status == "closed" {
		jsonResponse(w, http.StatusConflict, map[string]string{"error": "已关闭工单请先重新打开"})
		return
	}
	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "工单服务暂时不可用"})
		return
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(r.Context(), `INSERT INTO support_ticket_messages(ticket_id,author_type,author_user_id,body,ip_address) VALUES(?,'customer',?,?,?)`, id, u.ID, in.Message, clientIP(r)); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "回复保存失败"})
		return
	}
	if _, err = tx.ExecContext(r.Context(), `UPDATE support_tickets SET status='customer_reply',last_reply_at=UTC_TIMESTAMP(),last_reply_by='customer',closed_at=NULL WHERE id=? AND user_id=?`, id, u.ID); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "工单状态更新失败"})
		return
	}
	if err = tx.Commit(); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "回复保存失败"})
		return
	}
	jsonResponse(w, http.StatusCreated, map[string]bool{"saved": true})
}

func (s *server) setSupportTicketState(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id, err := pathID(r, "ticket")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工单编号无效"})
		return
	}
	var in struct{ Action string `json:"action"` }
	if decode(w, r, &in) != nil {
		return
	}
	var result sql.Result
	if in.Action == "close" {
		result, err = s.db.ExecContext(r.Context(), `UPDATE support_tickets SET status='closed',closed_at=UTC_TIMESTAMP() WHERE id=? AND user_id=? AND status<>'closed'`, id, u.ID)
	} else if in.Action == "reopen" {
		result, err = s.db.ExecContext(r.Context(), `UPDATE support_tickets SET status='open',closed_at=NULL,last_reply_at=UTC_TIMESTAMP() WHERE id=? AND user_id=? AND status='closed'`, id, u.ID)
	} else {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "不支持的工单操作"})
		return
	}
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "工单状态更新失败"})
		return
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		jsonResponse(w, http.StatusConflict, map[string]string{"error": "当前工单状态无法执行此操作"})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]bool{"updated": true})
}

func (s *server) adminSupportTickets(w http.ResponseWriter, r *http.Request) {
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	department := strings.TrimSpace(r.URL.Query().Get("department"))
	search := strings.TrimSpace(r.URL.Query().Get("search"))
	query := `SELECT t.id,t.ticket_number,t.user_id,u.email,t.workspace_id,t.department_id,d.name,t.subject,t.priority,t.status,t.last_reply_at,t.last_reply_by,t.closed_at,t.created_at FROM support_tickets t JOIN users u ON u.id=t.user_id JOIN support_departments d ON d.id=t.department_id WHERE 1=1`
	args := []any{}
	if status != "" {
		if !validTicketStatus(status) {
			jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "工单状态筛选无效"})
			return
		}
		query += ` AND t.status=?`
		args = append(args, status)
	}
	if department != "" {
		id, err := strconv.ParseInt(department, 10, 64)
		if err != nil {
			jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "支持部门筛选无效"})
			return
		}
		query += ` AND t.department_id=?`
		args = append(args, id)
	}
	if search != "" {
		query += ` AND (t.ticket_number LIKE ? OR t.subject LIKE ? OR u.email LIKE ?)`
		like := "%" + search + "%"
		args = append(args, like, like, like)
	}
	query += ` ORDER BY FIELD(t.status,'customer_reply','open','in_progress','staff_reply','resolved','closed'),FIELD(t.priority,'urgent','high','normal','low'),t.last_reply_at ASC LIMIT 200`
	rows, err := s.db.QueryContext(r.Context(), query, args...)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "工单队列暂时不可用"})
		return
	}
	defer rows.Close()
	items, err := scanSupportTicketRows(rows, true)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "工单队列读取失败"})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{"data": items})
}

func (s *server) adminSupportTicketDetail(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "ticket")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工单编号无效"})
		return
	}
	item, messages, err := s.loadSupportTicket(r, id, nil, true)
	if err != nil {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "工单不存在"})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{"ticket": item, "messages": messages})
}

func (s *server) adminReplySupportTicket(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "ticket")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工单编号无效"})
		return
	}
	var in struct {
		Message  string `json:"message"`
		Internal bool   `json:"internal"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	in.Message = strings.TrimSpace(in.Message)
	if len(in.Message) < 2 || len(in.Message) > 50000 {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "回复内容无效"})
		return
	}
	admin := currentAdmin(r)
	var userEmail, subject, number, status string
	if err = s.db.QueryRowContext(r.Context(), `SELECT u.email,t.subject,t.ticket_number,t.status FROM support_tickets t JOIN users u ON u.id=t.user_id WHERE t.id=?`, id).Scan(&userEmail, &subject, &number, &status); err != nil {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "工单不存在"})
		return
	}
	if status == "closed" && !in.Internal {
		jsonResponse(w, http.StatusConflict, map[string]string{"error": "已关闭工单需要先重新打开"})
		return
	}
	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "工单服务暂时不可用"})
		return
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(r.Context(), `INSERT INTO support_ticket_messages(ticket_id,author_type,author_administrator_id,body,is_internal) VALUES(?,'administrator',?,?,?)`, id, admin.ID, in.Message, in.Internal); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "回复保存失败"})
		return
	}
	if !in.Internal {
		if _, err = tx.ExecContext(r.Context(), `UPDATE support_tickets SET status='staff_reply',last_reply_at=UTC_TIMESTAMP(),last_reply_by='staff' WHERE id=?`, id); err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "工单状态更新失败"})
			return
		}
	}
	if err = tx.Commit(); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "回复保存失败"})
		return
	}
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO administrator_audit_logs(administrator_id,action,method,path,ip_address,user_agent,outcome,reason) VALUES(?, 'support.ticket_reply','POST',?,?,?,'success',?)`, admin.ID, r.URL.Path, clientIP(r), r.UserAgent(), map[bool]string{true: "internal note", false: "customer reply"}[in.Internal])
	if !in.Internal {
		_, _ = s.mail.QueueTemplate(r.Context(), "support_ticket_reply", userEmail, map[string]string{"site_name": "GoJet", "ticket_number": number, "subject": subject})
	}
	jsonResponse(w, http.StatusCreated, map[string]bool{"saved": true})
}

func (s *server) adminUpdateSupportTicket(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "ticket")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工单编号无效"})
		return
	}
	var in struct {
		Status       string `json:"status"`
		Priority     string `json:"priority"`
		DepartmentID int64  `json:"department_id"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	sets := []string{}
	args := []any{}
	if in.Status != "" {
		if !validTicketStatus(in.Status) {
			jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "工单状态无效"})
			return
		}
		sets = append(sets, "status=?")
		args = append(args, in.Status)
		if in.Status == "closed" {
			sets = append(sets, "closed_at=UTC_TIMESTAMP()")
		} else {
			sets = append(sets, "closed_at=NULL")
		}
	}
	if in.Priority != "" {
		if !validTicketPriority(in.Priority) {
			jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "工单优先级无效"})
			return
		}
		sets = append(sets, "priority=?")
		args = append(args, in.Priority)
	}
	if in.DepartmentID != 0 {
		var count int
		if s.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM support_departments WHERE id=? AND is_active=TRUE`, in.DepartmentID).Scan(&count) != nil || count == 0 {
			jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "支持部门无效"})
			return
		}
		sets = append(sets, "department_id=?")
		args = append(args, in.DepartmentID)
	}
	if len(sets) == 0 {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "没有需要更新的工单字段"})
		return
	}
	args = append(args, id)
	result, err := s.db.ExecContext(r.Context(), `UPDATE support_tickets SET `+strings.Join(sets, ",")+` WHERE id=?`, args...)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "工单更新失败"})
		return
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "工单不存在"})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]bool{"updated": true})
}

func (s *server) loadSupportTicket(r *http.Request, id int64, ownerID *int64, adminView bool) (supportTicketSummary, []supportTicketMessage, error) {
	var item supportTicketSummary
	var workspace sql.NullInt64
	var closed sql.NullTime
	query := `SELECT t.id,t.ticket_number,t.user_id,u.email,t.workspace_id,t.department_id,d.name,t.subject,t.priority,t.status,t.last_reply_at,t.last_reply_by,t.closed_at,t.created_at FROM support_tickets t JOIN users u ON u.id=t.user_id JOIN support_departments d ON d.id=t.department_id WHERE t.id=?`
	args := []any{id}
	if ownerID != nil {
		query += ` AND t.user_id=?`
		args = append(args, *ownerID)
	}
	if err := s.db.QueryRowContext(r.Context(), query, args...).Scan(&item.ID, &item.TicketNumber, &item.UserID, &item.UserEmail, &workspace, &item.DepartmentID, &item.DepartmentName, &item.Subject, &item.Priority, &item.Status, &item.LastReplyAt, &item.LastReplyBy, &closed, &item.CreatedAt); err != nil {
		return item, nil, err
	}
	if workspace.Valid {
		value := workspace.Int64
		item.WorkspaceID = &value
	}
	if closed.Valid {
		value := closed.Time
		item.ClosedAt = &value
	}
	query = `SELECT m.id,m.author_type,m.author_user_id,m.author_administrator_id,COALESCE(u.display_name,a.display_name,'GoJet Support'),m.body,m.is_internal,COALESCE(m.ip_address,''),m.created_at FROM support_ticket_messages m LEFT JOIN users u ON u.id=m.author_user_id LEFT JOIN administrators a ON a.id=m.author_administrator_id WHERE m.ticket_id=?`
	if !adminView {
		query += ` AND m.is_internal=FALSE`
	}
	query += ` ORDER BY m.created_at,m.id`
	rows, err := s.db.QueryContext(r.Context(), query, id)
	if err != nil {
		return item, nil, err
	}
	defer rows.Close()
	messages := []supportTicketMessage{}
	for rows.Next() {
		var message supportTicketMessage
		var userID, adminID sql.NullInt64
		if err = rows.Scan(&message.ID, &message.AuthorType, &userID, &adminID, &message.AuthorName, &message.Body, &message.Internal, &message.IPAddress, &message.CreatedAt); err != nil {
			return item, nil, err
		}
		if userID.Valid {
			value := userID.Int64
			message.AuthorUserID = &value
		}
		if adminID.Valid {
			value := adminID.Int64
			message.AuthorAdministratorID = &value
		}
		if !adminView {
			message.IPAddress = ""
		}
		messages = append(messages, message)
	}
	return item, messages, rows.Err()
}
