package main

import (
	"net"
	"net/http"
	"strings"
)

func (s *server) organizationSnapshot(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工作区编号无效"})
		return
	}
	result, err := s.organizer.Snapshot(r.Context(), currentUser(r).ID, workspaceID)
	if err != nil {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "无权查看该工作区资源组织"})
		return
	}
	jsonResponse(w, http.StatusOK, result)
}

func (s *server) createCampaign(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := pathID(r, "id")
	var input struct {
		Name string `json:"name"`
	}
	if decode(w, r, &input) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工作区编号无效"})
		return
	}
	item, err := s.organizer.CreateCampaign(r.Context(), currentUser(r).ID, workspaceID, input.Name)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, http.StatusCreated, item)
}

func (s *server) updateCampaign(w http.ResponseWriter, r *http.Request) {
	workspaceID, workspaceErr := pathID(r, "id")
	campaignID, campaignErr := pathID(r, "campaign")
	var input struct {
		Status string `json:"status"`
	}
	if decode(w, r, &input) != nil {
		return
	}
	if workspaceErr != nil || campaignErr != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "编号无效"})
		return
	}
	if err := s.organizer.SetCampaignStatus(r.Context(), currentUser(r).ID, workspaceID, campaignID, input.Status); err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]bool{"updated": true})
}

func (s *server) createFolder(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := pathID(r, "id")
	var input struct {
		Name string `json:"name"`
	}
	if decode(w, r, &input) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工作区编号无效"})
		return
	}
	item, err := s.organizer.CreateFolder(r.Context(), currentUser(r).ID, workspaceID, input.Name)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, http.StatusCreated, item)
}

func (s *server) createTag(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := pathID(r, "id")
	var input struct {
		Name  string `json:"name"`
		Color string `json:"color"`
	}
	if decode(w, r, &input) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工作区编号无效"})
		return
	}
	item, err := s.organizer.CreateTag(r.Context(), currentUser(r).ID, workspaceID, input.Name, input.Color)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, http.StatusCreated, item)
}

func (s *server) recordCampaignConversion(w http.ResponseWriter, r *http.Request) {
	campaignID, err := pathID(r, "campaign")
	var input struct {
		Token string `json:"token"`
	}
	if decode(w, r, &input) != nil {
		return
	}
	if err != nil || len(input.Token) != 64 {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "活动转化凭据无效"})
		return
	}
	visitor := clientIP(r) + "|" + r.UserAgent()
	recorded, err := s.organizer.RecordConversion(r.Context(), campaignID, input.Token, visitor)
	if err != nil {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "活动转化凭据无效"})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]bool{"recorded": recorded})
}

func clientIP(r *http.Request) string {
	if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); net.ParseIP(realIP) != nil {
		return realIP
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}
