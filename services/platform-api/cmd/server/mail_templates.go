package main

import (
	"net/http"
	"strings"

	appmail "github.com/Techshrr/GoJet_Short_Link/app/mail"
)

func mailTemplateIsFragment(body string) bool {
	lower := strings.ToLower(strings.TrimSpace(body))
	for _, marker := range []string{"<!doctype", "<html", "</html", "<head", "</head", "<body", "</body"} {
		if strings.Contains(lower, marker) {
			return false
		}
	}
	return true
}

func (s *server) adminMailTemplates(w http.ResponseWriter, r *http.Request) {
	items, err := s.mail.Templates(r.Context())
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "无法读取邮件模板"})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{"data": items})
}

func (s *server) adminSaveMailTemplate(w http.ResponseWriter, r *http.Request) {
	var item appmail.Template
	if decode(w, r, &item) != nil {
		return
	}
	item.Key = r.PathValue("key")
	if !mailTemplateIsFragment(item.HTML) {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "邮件模板只能编辑内容区，请不要加入 html、head 或 body 外层；品牌页眉、卡片和页脚由系统统一生成"})
		return
	}
	if err := s.mail.SaveTemplate(r.Context(), item); err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]bool{"saved": true})
}
