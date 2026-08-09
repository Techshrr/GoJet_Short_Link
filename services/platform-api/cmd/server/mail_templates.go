package main

import (
	"net/http"

	appmail "github.com/Techshrr/GoJet_Short_Link/app/mail"
)

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
	if err := s.mail.SaveTemplate(r.Context(), item); err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]bool{"saved": true})
}
