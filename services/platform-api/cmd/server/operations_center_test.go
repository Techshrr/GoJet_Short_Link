package main

import (
	"errors"
	"strings"
	"testing"
)

func TestOperationsDiagnosticsJSONEscapesErrors(t *testing.T) {
	value := jsonObject(map[string]int64{"cleaned": 3}, errors.New("scanner \"offline\"\nretry"))
	if !strings.Contains(value, `"cleaned":3`) || !strings.Contains(value, `scanner \"offline\"\nretry`) {
		t.Fatalf("unsafe or incomplete job details: %s", value)
	}
}

func TestResourceQuarantineTypesUseServerOwnedTables(t *testing.T) {
	for _, kind := range []string{"link", "text", "bio", "qr", "file"} {
		spec, ok := resourceSpecs[kind]
		if !ok || spec.table == "" || strings.ContainsAny(spec.table, " ;'") {
			t.Fatalf("invalid resource spec for %s", kind)
		}
	}
	if _, ok := resourceSpecs["users; DROP TABLE users"]; ok {
		t.Fatal("caller-controlled table selection must never be accepted")
	}
}
