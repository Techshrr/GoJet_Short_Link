package main

import (
	appresources "github.com/Techshrr/GoJet_Short_Link/app/resources"
	"net/http"
)

func (s *server) createTextShare(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	var in struct {
		appresources.TextShare
		Password string `json:"password"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid workspace"})
		return
	}
	item, err := s.resources.CreateText(r.Context(), currentUser(r).ID, wid, in.TextShare, in.Password)
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	item.Content = ""
	jsonResponse(w, 201, item)
}
func (s *server) readTextShare(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Password string `json:"password"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	item, err := s.resources.ReadText(r.Context(), r.PathValue("slug"), in.Password)
	if err != nil {
		jsonResponse(w, 403, map[string]string{"error": "文本不存在、已过期、已读取或密码错误"})
		return
	}
	jsonResponse(w, 200, item)
}
func (s *server) createBioPage(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	var item appresources.BioPage
	if decode(w, r, &item) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid workspace"})
		return
	}
	item, err = s.resources.CreateBio(r.Context(), currentUser(r).ID, wid, item)
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 201, item)
}
func (s *server) readBioPage(w http.ResponseWriter, r *http.Request) {
	item, err := s.resources.ReadBio(r.Context(), r.PathValue("slug"))
	if err != nil {
		jsonResponse(w, 404, map[string]string{"error": "个人主页不存在或尚未发布"})
		return
	}
	jsonResponse(w, 200, item)
}
func (s *server) createQRCode(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	var in struct {
		LinkID                       int64 `json:"link_id"`
		Name, Foreground, Background string
		Size                         int
	}
	if decode(w, r, &in) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid workspace"})
		return
	}
	item, err := s.resources.CreateQR(r.Context(), currentUser(r).ID, wid, in.LinkID, in.Name, in.Foreground, in.Background, in.Size)
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 201, item)
}
