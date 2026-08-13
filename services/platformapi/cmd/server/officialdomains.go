package main

import (
	"database/sql"
	"errors"
	"net"
	"net/http"
	"strconv"
	"strings"
)

type officialShortDomain struct {
	ID        int64  `json:"id"`
	Hostname  string `json:"hostname"`
	Label     string `json:"label"`
	Status    string `json:"status"`
	IsDefault bool   `json:"is_default"`
	SortOrder int    `json:"sort_order"`
}

func normalizeShortDomain(value string) (string, error) {
	value = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(value), "."))
	if len(value) < 3 || len(value) > 253 || net.ParseIP(value) != nil || !strings.Contains(value, ".") || strings.ContainsAny(value, " /:@?#") {
		return "", errors.New("短链域名格式无效")
	}
	for _, label := range strings.Split(value, ".") {
		if label == "" || len(label) > 63 || strings.HasPrefix(label, "-") || strings.HasSuffix(label, "-") {
			return "", errors.New("短链域名格式无效")
		}
		for _, r := range label {
			if (r < 'a' || r > 'z') && (r < '0' || r > '9') && r != '-' {
				return "", errors.New("短链域名仅支持标准 ASCII 域名")
			}
		}
	}
	return value, nil
}

func (s *server) adminOfficialShortDomains(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.QueryContext(r.Context(), `SELECT id,hostname,label,status,is_default,sort_order FROM official_short_domains ORDER BY is_default DESC,sort_order,id`)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "短链域名列表暂时不可用"})
		return
	}
	defer rows.Close()
	items := []officialShortDomain{}
	for rows.Next() {
		var item officialShortDomain
		if err = rows.Scan(&item.ID, &item.Hostname, &item.Label, &item.Status, &item.IsDefault, &item.SortOrder); err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "短链域名列表读取失败"})
			return
		}
		items = append(items, item)
	}
	jsonResponse(w, http.StatusOK, map[string]any{"data": items})
}

func (s *server) adminCreateOfficialShortDomain(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Hostname  string `json:"hostname"`
		Label     string `json:"label"`
		IsDefault bool   `json:"is_default"`
		SortOrder int    `json:"sort_order"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	hostname, err := normalizeShortDomain(in.Hostname)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	in.Label = strings.TrimSpace(in.Label)
	if len(in.Label) > 120 || in.SortOrder < -10000 || in.SortOrder > 10000 {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "短链域名设置无效"})
		return
	}
	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "短链域名保存失败"})
		return
	}
	defer tx.Rollback()
	if in.IsDefault {
		if _, err = tx.ExecContext(r.Context(), `UPDATE official_short_domains SET is_default=FALSE WHERE is_default=TRUE`); err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "默认域名更新失败"})
			return
		}
	}
	result, err := tx.ExecContext(r.Context(), `INSERT INTO official_short_domains(hostname,label,status,is_default,sort_order) VALUES(?,?,'active',?,?)`, hostname, in.Label, in.IsDefault, in.SortOrder)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "该短链域名已存在或无法保存"})
		return
	}
	if err = tx.Commit(); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "短链域名保存失败"})
		return
	}
	id, _ := result.LastInsertId()
	jsonResponse(w, http.StatusCreated, map[string]any{"id": id, "hostname": hostname})
}

func (s *server) adminUpdateOfficialShortDomain(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("domain"), 10, 64)
	if err != nil || id < 1 {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "短链域名编号无效"})
		return
	}
	var in struct {
		Label     *string `json:"label"`
		Status    *string `json:"status"`
		IsDefault *bool   `json:"is_default"`
		SortOrder *int    `json:"sort_order"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	sets := []string{}
	args := []any{}
	if in.Label != nil {
		value := strings.TrimSpace(*in.Label)
		if len(value) > 120 {
			jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "域名备注不能超过 120 字"})
			return
		}
		sets = append(sets, "label=?")
		args = append(args, value)
	}
	if in.Status != nil {
		if *in.Status != "active" && *in.Status != "disabled" {
			jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "域名状态无效"})
			return
		}
		sets = append(sets, "status=?")
		args = append(args, *in.Status)
	}
	if in.SortOrder != nil {
		if *in.SortOrder < -10000 || *in.SortOrder > 10000 {
			jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "排序值无效"})
			return
		}
		sets = append(sets, "sort_order=?")
		args = append(args, *in.SortOrder)
	}
	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "短链域名更新失败"})
		return
	}
	defer tx.Rollback()
	if in.IsDefault != nil {
		if *in.IsDefault {
			if _, err = tx.ExecContext(r.Context(), `UPDATE official_short_domains SET is_default=FALSE WHERE is_default=TRUE`); err != nil {
				jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "默认域名更新失败"})
				return
			}
		}
		sets = append(sets, "is_default=?")
		args = append(args, *in.IsDefault)
	}
	if len(sets) == 0 {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "没有需要更新的字段"})
		return
	}
	args = append(args, id)
	result, err := tx.ExecContext(r.Context(), `UPDATE official_short_domains SET `+strings.Join(sets, ",")+` WHERE id=?`, args...)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "短链域名更新失败"})
		return
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "短链域名不存在"})
		return
	}
	if err = tx.Commit(); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "短链域名更新失败"})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]bool{"updated": true})
}

func (s *server) adminDeleteOfficialShortDomain(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("domain"), 10, 64)
	if err != nil || id < 1 {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "短链域名编号无效"})
		return
	}
	var hostname string
	if err = s.db.QueryRowContext(r.Context(), `SELECT hostname FROM official_short_domains WHERE id=?`, id).Scan(&hostname); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			jsonResponse(w, http.StatusNotFound, map[string]string{"error": "短链域名不存在"})
			return
		}
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "短链域名读取失败"})
		return
	}
	var used int
	if err = s.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM short_links WHERE domain=? AND deleted_at IS NULL`, hostname).Scan(&used); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "短链域名使用情况读取失败"})
		return
	}
	if used > 0 {
		jsonResponse(w, http.StatusConflict, map[string]string{"error": "该域名仍有短链接在使用，请先停用域名，不要直接删除"})
		return
	}
	if _, err = s.db.ExecContext(r.Context(), `DELETE FROM official_short_domains WHERE id=?`, id); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "短链域名删除失败"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) workspaceLinkDomains(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工作区编号无效"})
		return
	}
	if _, err = s.workspace.Role(r.Context(), workspaceID, currentUser(r).ID); err != nil {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "无权查看该工作区的短链域名"})
		return
	}
	items := []map[string]any{}
	rows, err := s.db.QueryContext(r.Context(), `SELECT hostname,label,is_default FROM official_short_domains WHERE status='active' ORDER BY is_default DESC,sort_order,id`)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "短链域名暂时不可用"})
		return
	}
	for rows.Next() {
		var hostname, label string
		var isDefault bool
		if rows.Scan(&hostname, &label, &isDefault) == nil {
			items = append(items, map[string]any{"hostname": hostname, "label": label, "source": "official", "is_default": isDefault})
		}
	}
	rows.Close()
	rows, err = s.db.QueryContext(r.Context(), `SELECT hostname FROM custom_domains WHERE workspace_id=? AND status='active' AND https_status='active' ORDER BY created_at DESC`, workspaceID)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "自定义域名暂时不可用"})
		return
	}
	defer rows.Close()
	for rows.Next() {
		var hostname string
		if rows.Scan(&hostname) == nil {
			items = append(items, map[string]any{"hostname": hostname, "label": "自定义域名", "source": "custom", "is_default": false})
		}
	}
	jsonResponse(w, http.StatusOK, map[string]any{"data": items})
}
