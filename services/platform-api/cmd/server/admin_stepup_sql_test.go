package main

import "testing"

func TestAdministratorOperationsDoNotRequireStepUp(t *testing.T) {
	for _, path := range []string{
		"/api/admin/settings/mail",
		"/api/admin/settings/basic",
		"/api/admin/settings/seo",
		"/api/admin/brand/logo",
		"/api/admin/mail/templates/verification",
		"/api/admin/mail/test",
		"/api/admin/administrators",
		"/api/admin/users/42/status",
		"/api/admin/diagnostics/cache/flush",
		"/api/admin/diagnostics/maintenance",
	} {
		if stepUpRequiredForPath(path) {
			t.Fatalf("administrator operation unexpectedly requires step-up: %s", path)
		}
	}
}
