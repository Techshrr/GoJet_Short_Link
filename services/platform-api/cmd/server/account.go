package main

import (
	"net/http"
	"strings"
)

func (s *server) updateMe(w http.ResponseWriter, r *http.Request) {
	var in struct {
		DisplayName string `json:"display_name"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	u := currentUser(r)
	if err := s.identity.UpdateDisplayName(r.Context(), u.ID, in.DisplayName); err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	updated, err := s.identity.Authenticate(r.Context(), strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	if err != nil {
		jsonResponse(w, http.StatusOK, map[string]bool{"updated": true})
		return
	}
	jsonResponse(w, http.StatusOK, updated)
}

func (s *server) changeMyPassword(w http.ResponseWriter, r *http.Request) {
	var in struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if err := s.identity.ChangePassword(r.Context(), currentUser(r).ID, in.CurrentPassword, in.NewPassword); err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]bool{"updated": true, "sessions_revoked": true})
}

func (s *server) logoutUser(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if err := s.identity.RevokeToken(r.Context(), token); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "暂时无法退出登录"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
