package billing

import (
	"encoding/json"
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
