package main

import "net/http"

func (s *server) registerSupportAndBotRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/public/turnstile", s.publicBotProtection)
	mux.HandleFunc("POST /api/public/abuse-reports", s.createPublicAbuseReport)

	mux.HandleFunc("GET /api/support/departments", s.user(s.supportDepartments))
	mux.HandleFunc("GET /api/support/tickets", s.user(s.listSupportTickets))
	mux.HandleFunc("POST /api/support/tickets", s.user(s.turnstileGuard("ticket_create", "support_ticket_create", s.createSupportTicket)))
	mux.HandleFunc("GET /api/support/tickets/{ticket}", s.user(s.supportTicketDetail))
	mux.HandleFunc("POST /api/support/tickets/{ticket}/replies", s.user(s.turnstileGuard("ticket_reply", "support_ticket_reply", s.replySupportTicket)))
	mux.HandleFunc("PATCH /api/support/tickets/{ticket}/state", s.user(s.setSupportTicketState))

	mux.HandleFunc("GET /api/admin/support/tickets", s.admin("tickets.manage", s.adminSupportTickets))
	mux.HandleFunc("GET /api/admin/support/tickets/{ticket}", s.admin("tickets.manage", s.adminSupportTicketDetail))
	mux.HandleFunc("POST /api/admin/support/tickets/{ticket}/replies", s.admin("tickets.manage", s.adminReplySupportTicket))
	mux.HandleFunc("PATCH /api/admin/support/tickets/{ticket}", s.admin("tickets.manage", s.adminUpdateSupportTicket))

	mux.HandleFunc("POST /api/admin/plans", s.admin("billing.manage", s.adminCreatePlan))
	mux.HandleFunc("DELETE /api/admin/plans/{id}", s.admin("billing.manage", s.adminArchivePlan))

	mux.HandleFunc("GET /api/admin/bot-protection", s.admin("settings.manage", s.getBotProtectionSettings))
	mux.HandleFunc("PUT /api/admin/bot-protection", s.admin("settings.manage", s.saveBotProtectionSettings))
}
