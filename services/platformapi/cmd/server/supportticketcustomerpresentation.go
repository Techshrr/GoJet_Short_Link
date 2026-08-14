package main

import "net/http"

// supportTicketDetailCustomer keeps internal staff notes hidden while allowing
// a customer to see the IP recorded for their own ticket creation and replies.
// Administrator replies never expose an administrator IP to the customer.
func (s *server) supportTicketDetailCustomer(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id, err := pathID(r, "ticket")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工单编号无效"})
		return
	}
	item, messages, err := s.loadSupportTicket(r, id, &u.ID, true)
	if err != nil {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "工单不存在"})
		return
	}
	visible := make([]supportTicketMessage, 0, len(messages))
	for _, message := range messages {
		if message.Internal {
			continue
		}
		message.Internal = false
		if message.AuthorType != "customer" {
			message.IPAddress = ""
		}
		visible = append(visible, message)
	}
	jsonResponse(w, http.StatusOK, map[string]any{"ticket": item, "messages": visible})
}
