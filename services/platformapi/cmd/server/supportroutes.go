package main

import "net/http"

func (s *server) registerSupportAndBotRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/public/turnstile", s.publicBotProtection)
	mux.HandleFunc("POST /api/public/abuse-reports", s.createPublicAbuseReport)
	s.registerEmailCodeRoutes(mux)
	s.registerP15AccountRoutes(mux)
	s.registerP17AdminRoutes(mux)

	mux.HandleFunc("GET /api/support/departments", s.user(s.supportDepartments))
	mux.HandleFunc("GET /api/support/tickets", s.user(s.listSupportTickets))
	mux.HandleFunc("POST /api/support/tickets", s.user(s.turnstileGuard("ticket_create", "support_ticket_create", s.createSupportTicket)))
	mux.HandleFunc("GET /api/support/tickets/{ticket}", s.user(s.supportTicketDetailCustomer))
	mux.HandleFunc("POST /api/support/tickets/{ticket}/replies", s.user(s.turnstileGuard("ticket_reply", "support_ticket_reply", s.replySupportTicket)))
	mux.HandleFunc("PATCH /api/support/tickets/{ticket}/state", s.user(s.setSupportTicketState))
	mux.HandleFunc("GET /api/support/tickets/{ticket}/attachments", s.user(s.listSupportAttachments))
	mux.HandleFunc("POST /api/support/tickets/{ticket}/attachments", s.user(s.uploadSupportAttachment))
	mux.HandleFunc("GET /api/support/tickets/{ticket}/attachments/{attachment}", s.user(s.downloadSupportAttachment))

	mux.HandleFunc("GET /api/admin/support/tickets", s.admin("tickets.manage", s.adminSupportTickets))
	mux.HandleFunc("GET /api/admin/support/tickets/{ticket}", s.admin("tickets.manage", s.adminSupportTicketDetail))
	mux.HandleFunc("POST /api/admin/support/tickets/{ticket}/replies", s.admin("tickets.manage", s.adminReplySupportTicket))
	mux.HandleFunc("PATCH /api/admin/support/tickets/{ticket}", s.admin("tickets.manage", s.adminUpdateSupportTicket))
	mux.HandleFunc("GET /api/admin/support/tickets/{ticket}/attachments", s.admin("tickets.manage", s.adminListSupportAttachments))
	mux.HandleFunc("GET /api/admin/support/tickets/{ticket}/attachments/{attachment}", s.admin("tickets.manage", s.adminDownloadSupportAttachment))

	// V5.0.3 uses a separate authoritative runtime-health endpoint rather than
	// the legacy expected-service inventory. The latter remains available only
	// for compatibility with older clients.
	mux.HandleFunc("GET /api/admin/runtime-services", s.admin("operations.manage", s.adminRuntimeServicesV503))

	// Workspace link-domain and official-link creation routes are owned by
	// registerProductRoutes. Plan creation is owned by
	// registerBillingPresentationRoutes. Keeping one registration owner per
	// production pattern prevents net/http ServeMux startup conflicts.
	mux.HandleFunc("GET /api/admin/official-domains", s.admin("domains.manage", s.adminOfficialShortDomains))
	mux.HandleFunc("POST /api/admin/official-domains", s.admin("domains.manage", s.adminCreateOfficialShortDomain))
	mux.HandleFunc("PATCH /api/admin/official-domains/{domain}", s.admin("domains.manage", s.adminUpdateOfficialShortDomain))
	mux.HandleFunc("DELETE /api/admin/official-domains/{domain}", s.admin("domains.manage", s.adminDeleteOfficialShortDomain))

	// Preserve the legacy DELETE alias while the canonical P13 archive route
	// remains POST /api/admin/plans/{id}/archive.
	mux.HandleFunc("DELETE /api/admin/plans/{id}", s.admin("billing.manage", s.adminArchivePlan))

	mux.HandleFunc("GET /api/admin/bot-protection", s.admin("settings.manage", s.getBotProtectionSettings))
	mux.HandleFunc("PUT /api/admin/bot-protection", s.admin("settings.manage", s.saveBotProtectionSettings))
}
