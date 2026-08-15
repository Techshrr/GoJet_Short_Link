package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/Techshrr/GoJet_Short_Link/app/destinationrisk"
)

func (s *server) destinationRiskStore() *destinationrisk.Store { return destinationrisk.NewStore(s.db) }

func (s *server) currentDestinationRiskTargets(r *http.Request, linkID int64) ([]string, error) {
	var destination string
	var routingRules, abDestinations []byte
	err := s.db.QueryRowContext(r.Context(), `
		SELECT destination,COALESCE(routing_rules,JSON_ARRAY()),COALESCE(ab_destinations,JSON_ARRAY())
		FROM short_links WHERE id=? AND deleted_at IS NULL`, linkID).Scan(&destination, &routingRules, &abDestinations)
	if err != nil {
		return nil, err
	}
	return destinationrisk.Targets(destination, json.RawMessage(routingRules), json.RawMessage(abDestinations)), nil
}

func parseDestinationRiskLinkIDs(raw string) ([]int64, error) {
	parts := strings.Split(raw, ",")
	if len(parts) > 100 {
		return nil, strconv.ErrRange
	}
	ids := make([]int64, 0, len(parts))
	seen := map[int64]bool{}
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		id, err := strconv.ParseInt(part, 10, 64)
		if err != nil || id < 1 {
			return nil, strconv.ErrSyntax
		}
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return nil, strconv.ErrSyntax
	}
	return ids, nil
}

func (s *server) adminDestinationRisks(w http.ResponseWriter, r *http.Request) {
	linkIDs := strings.TrimSpace(r.URL.Query().Get("link_ids"))
	if linkIDs != "" {
		ids, err := parseDestinationRiskLinkIDs(linkIDs)
		if err != nil {
			jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "链接编号列表无效"})
			return
		}
		items, err := s.destinationRiskStore().ListByLinkIDs(r.Context(), ids)
		if err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "风险状态暂时不可用"})
			return
		}
		jsonResponse(w, http.StatusOK, map[string]any{"data": items, "total": len(items), "requested": len(ids)})
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	decision := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("decision")))
	items, total, err := s.destinationRiskStore().List(r.Context(), decision, limit, offset)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	jsonResponse(w, http.StatusOK, map[string]any{"data": items, "total": total, "limit": limit, "offset": offset})
}

func (s *server) adminDestinationRiskDetail(w http.ResponseWriter, r *http.Request) {
	linkID, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "链接编号无效"})
		return
	}
	record, err := s.destinationRiskStore().Get(r.Context(), linkID)
	if err != nil {
		status := http.StatusServiceUnavailable
		if err == sql.ErrNoRows {
			status = http.StatusNotFound
		}
		jsonResponse(w, status, map[string]string{"error": "风险记录不存在或暂时不可用"})
		return
	}
	targets, err := s.currentDestinationRiskTargets(r, linkID)
	if err != nil {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "链接不存在或已删除"})
		return
	}
	currentFingerprint := destinationrisk.Fingerprint(targets)
	jsonResponse(w, http.StatusOK, map[string]any{
		"risk":                record,
		"targets":             targets,
		"current_fingerprint": currentFingerprint,
		"stale":               record.TargetFingerprint != "" && record.TargetFingerprint != currentFingerprint,
	})
}

func (s *server) requireFreshRiskTarget(w http.ResponseWriter, r *http.Request, linkID int64) (destinationrisk.Record, []string, bool) {
	store := s.destinationRiskStore()
	record, err := store.Get(r.Context(), linkID)
	if err != nil {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "风险记录不存在，请先重新扫描"})
		return destinationrisk.Record{}, nil, false
	}
	targets, err := s.currentDestinationRiskTargets(r, linkID)
	if err != nil || len(targets) == 0 {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "链接不存在或没有可扫描目标"})
		return destinationrisk.Record{}, nil, false
	}
	fingerprint := destinationrisk.Fingerprint(targets)
	if record.TargetFingerprint == "" || record.TargetFingerprint != fingerprint {
		_, _ = s.db.ExecContext(r.Context(), `
			UPDATE link_destination_risk
			SET next_scan_at=UTC_TIMESTAMP(),manual_decision=NULL,manual_reason=NULL,manual_administrator_id=NULL,manual_at=NULL
			WHERE link_id=?`, linkID)
		_ = s.redis.Del(r.Context(), destinationrisk.RedisKey(linkID, targets)).Err()
		jsonResponse(w, http.StatusConflict, map[string]string{"error": "目标地址已变化，旧审核结论不能继续使用；已安排重新扫描"})
		return destinationrisk.Record{}, nil, false
	}
	return record, targets, true
}

func (s *server) failClosedRiskCache(r *http.Request, linkID int64, targets []string) error {
	return s.redis.Del(r.Context(), destinationrisk.RedisKey(linkID, targets)).Err()
}

func (s *server) adminOverrideDestinationRisk(w http.ResponseWriter, r *http.Request) {
	linkID, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "链接编号无效"})
		return
	}
	var input struct {
		Decision destinationrisk.Decision `json:"decision"`
		Reason   string                   `json:"reason"`
	}
	if decode(w, r, &input) != nil {
		return
	}
	input.Decision = destinationrisk.Decision(strings.ToLower(strings.TrimSpace(string(input.Decision))))
	input.Reason = strings.TrimSpace(input.Reason)
	previous, targets, ok := s.requireFreshRiskTarget(w, r, linkID)
	if !ok {
		return
	}
	// Remove the currently-authorizing key before changing the authoritative DB
	// decision. Any database/Redis failure from this point therefore fails closed.
	if err = s.failClosedRiskCache(r, linkID, targets); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "无法进入安全审核状态，请稍后重试"})
		return
	}
	admin := currentAdmin(r)
	record, err := s.destinationRiskStore().Override(r.Context(), linkID, admin.ID, input.Decision, input.Reason)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	if err = destinationrisk.SyncDecision(r.Context(), s.redis, linkID, targets, record.EffectiveDecision); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "人工审核已保存，但跳转缓存同步失败；当前链接保持安全阻断，请重试"})
		return
	}
	_, _ = s.db.ExecContext(r.Context(), `
		INSERT INTO audit_logs(action,target_type,target_id,metadata)
		VALUES('admin.destination_risk_override','short_link',?,JSON_OBJECT('administrator_id',?,'previous_effective_decision',?,'decision',?,'reason',?,'target_fingerprint',?))`,
		linkID, admin.ID, previous.EffectiveDecision, record.EffectiveDecision, input.Reason, record.TargetFingerprint)
	jsonResponse(w, http.StatusOK, record)
}

func (s *server) adminClearDestinationRiskOverride(w http.ResponseWriter, r *http.Request) {
	linkID, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "链接编号无效"})
		return
	}
	previous, targets, ok := s.requireFreshRiskTarget(w, r, linkID)
	if !ok {
		return
	}
	if err = s.failClosedRiskCache(r, linkID, targets); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "无法进入安全审核状态，请稍后重试"})
		return
	}
	record, err := s.destinationRiskStore().ClearOverride(r.Context(), linkID)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "清除人工审核失败；当前链接保持安全阻断"})
		return
	}
	if err = destinationrisk.SyncDecision(r.Context(), s.redis, linkID, targets, record.EffectiveDecision); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "人工审核已清除，但跳转缓存同步失败；当前链接保持安全阻断，请重试"})
		return
	}
	_, _ = s.db.ExecContext(r.Context(), `
		INSERT INTO audit_logs(action,target_type,target_id,metadata)
		VALUES('admin.destination_risk_override_cleared','short_link',?,JSON_OBJECT('administrator_id',?,'previous_effective_decision',?,'automatic_decision',?,'target_fingerprint',?))`,
		linkID, currentAdmin(r).ID, previous.EffectiveDecision, record.Decision, record.TargetFingerprint)
	jsonResponse(w, http.StatusOK, record)
}

func (s *server) adminRescanDestinationRisk(w http.ResponseWriter, r *http.Request) {
	linkID, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "链接编号无效"})
		return
	}
	targets, err := s.currentDestinationRiskTargets(r, linkID)
	if err != nil || len(targets) == 0 {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "链接不存在或没有可扫描目标"})
		return
	}
	if err = s.failClosedRiskCache(r, linkID, targets); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "无法进入重新扫描状态，请稍后重试"})
		return
	}
	result, err := s.db.ExecContext(r.Context(), `
		UPDATE link_destination_risk
		SET next_scan_at=UTC_TIMESTAMP(),manual_decision=NULL,manual_reason=NULL,manual_administrator_id=NULL,manual_at=NULL
		WHERE link_id=?`, linkID)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "无法安排重新扫描；当前链接保持安全阻断"})
		return
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "风险记录不存在"})
		return
	}
	_, _ = s.db.ExecContext(r.Context(), `
		INSERT INTO audit_logs(action,target_type,target_id,metadata)
		VALUES('admin.destination_risk_rescan','short_link',?,JSON_OBJECT('administrator_id',?,'target_fingerprint',?))`,
		linkID, currentAdmin(r).ID, destinationrisk.Fingerprint(targets))
	jsonResponse(w, http.StatusAccepted, map[string]any{"queued": true, "link_id": linkID, "effective_decision": destinationrisk.Review})
}
