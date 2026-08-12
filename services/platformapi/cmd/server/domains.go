package main

import "net/http"

func (s *server) listDomains(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "工作区编号无效"})
		return
	}
	items, err := s.domains.List(r.Context(), currentUser(r).ID, wid)
	if err != nil {
		jsonResponse(w, 403, map[string]string{"error": "无法读取该工作区的域名"})
		return
	}
	jsonResponse(w, 200, map[string]any{"data": items})
}
func (s *server) createDomain(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	var in struct {
		Hostname string `json:"hostname"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "工作区编号无效"})
		return
	}
	item, token, err := s.domains.Create(r.Context(), currentUser(r).ID, wid, in.Hostname)
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 201, map[string]any{"domain": item, "dns_record": domainDNSRecord(item.Hostname, token)})
}
func (s *server) verifyDomain(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	domainID, e2 := pathID(r, "domain")
	if e1 != nil || e2 != nil {
		jsonResponse(w, 400, map[string]string{"error": "域名编号无效"})
		return
	}
	if r.URL.Query().Get("rotate") == "1" {
		item, token, err := s.domains.RotateVerification(r.Context(), currentUser(r).ID, wid, domainID)
		if err != nil {
			jsonResponse(w, 422, map[string]string{"error": "无法重新生成域名验证记录"})
			return
		}
		jsonResponse(w, 200, map[string]any{"domain": item, "dns_record": domainDNSRecord(item.Hostname, token)})
		return
	}
	if err := s.domains.Verify(r.Context(), currentUser(r).ID, wid, domainID); err != nil {
		jsonResponse(w, 422, map[string]string{"error": "域名验证未通过，请检查验证记录和安全连接状态"})
		return
	}
	jsonResponse(w, 200, map[string]bool{"checked": true})
}

func domainDNSRecord(hostname, token string) map[string]string {
	return map[string]string{"type": "TXT", "name": "_gojet." + hostname, "value": "gojet-verification=" + token}
}
