#!/usr/bin/env python3
from pathlib import Path
p=Path(__file__).resolve().parents[1]/'services/platform-api/cmd/server/product_resource_actions.go'
text=p.read_text()
start=text.find('func (s *server) adminDeleteLink(')
end=text.find('\nfunc (s *server) adminUpdateDomainStatus',start)
if start<0 or end<0: raise SystemExit('adminDeleteLink function boundary missing')
new=r'''func (s *server) adminDeleteLink(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "链接编号无效"})
		return
	}
	// First make the live redirect non-routable while the record is still
	// visible to SyncByID. Only after Redis/redirect state is safe do we
	// commit the soft-delete marker.
	result, err := s.db.ExecContext(r.Context(), `UPDATE short_links SET status='paused' WHERE id=? AND deleted_at IS NULL`, id)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "链接停用失败"})
		return
	}
	if n, _ := result.RowsAffected(); n != 1 {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "链接不存在或已经删除"})
		return
	}
	if err = s.links.SyncByID(r.Context(), id); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "链接已暂停，但跳转缓存同步失败；请重试删除"})
		return
	}
	if _, err = s.db.ExecContext(r.Context(), `UPDATE short_links SET deleted_at=NOW() WHERE id=? AND deleted_at IS NULL`, id); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "跳转已停用，但软删除记录失败；请重试"})
		return
	}
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.link_deleted','link',?,JSON_OBJECT('administrator_id',?))`, id, currentAdmin(r).ID)
	w.WriteHeader(http.StatusNoContent)
}
'''
p.write_text(text[:start]+new+text[end:])
print('admin link deletion order hardened')
