package main

import (
	"net/http"

	"github.com/Techshrr/GoJet_Short_Link/app/links"
)

func (s *server) createOfficialLink(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工作区编号无效"})
		return
	}
	var in links.Link
	if decode(w, r, &in) != nil {
		return
	}
	created, err := s.links.CreateOfficialWithPolicy(r.Context(), currentUser(r).ID, workspaceID, in, s.linkCreatePolicy(r))
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, http.StatusCreated, created)
}
