package billing

import (
	"encoding/json"
	"regexp"
	"strings"
	"testing"
)

func TestUsageJSONFieldsRemainStable(t *testing.T) {
	usage := Usage{PlanCode: "starter", Links: 5, LinkLimit: 100}
	if usage.PlanCode != "starter" || usage.Links >= usage.LinkLimit {
		t.Fatal("unexpected usage fixture")
	}
	payload, err := json.Marshal(usage)
	if err != nil {
		t.Fatal(err)
	}
	for _, field := range []string{`"links":5`, `"link_limit":100`, `"plan_code":"starter"`} {
		if !strings.Contains(string(payload), field) {
			t.Fatalf("missing stable API field %s in %s", field, payload)
		}
	}
}

func TestInvoiceNumbersAreOpaqueAndUnique(t *testing.T) {
	a, err := invoiceNumber()
	if err != nil {
		t.Fatal(err)
	}
	b, err := invoiceNumber()
	if err != nil {
		t.Fatal(err)
	}
	if a == b {
		t.Fatal("invoice numbers must be unique")
	}
	if !regexp.MustCompile(`^GJ-[0-9]{8}-[A-F0-9]{12}$`).MatchString(a) {
		t.Fatalf("unexpected invoice number %q", a)
	}
}

func TestOnlyWorkspaceManagersCanChangeBilling(t *testing.T) {
	for role, allowed := range map[string]bool{"owner": true, "admin": true, "editor": false, "analyst": false, "viewer": false} {
		if canManage(role) != allowed {
			t.Fatalf("role %s permission mismatch", role)
		}
	}
}
