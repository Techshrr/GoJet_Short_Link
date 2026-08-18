package main

import (
	"crypto/sha256"
	"net"
	"reflect"
	"strings"
	"testing"
)

func TestP17WebhookIPPolicy(t *testing.T) {
	blocked := []string{"127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.10.20", "::1", "fc00::1", "fe80::1"}
	for _, raw := range blocked {
		if !isBlockedWebhookIP(net.ParseIP(raw)) { t.Fatalf("expected %s to be blocked", raw) }
	}
	for _, raw := range []string{"8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"} {
		if isBlockedWebhookIP(net.ParseIP(raw)) { t.Fatalf("expected %s to remain public", raw) }
	}
}

func TestP17APIKeySecretIsHashVerifiable(t *testing.T) {
	token, stored, err := generateIntegrationSecret("gjk_")
	if err != nil { t.Fatal(err) }
	if !strings.HasPrefix(token, "gjk_") || len(token) < 40 { t.Fatalf("unexpected token format: %q", token) }
	sum := sha256.Sum256([]byte(token))
	if !reflect.DeepEqual(stored, sum[:]) { t.Fatal("stored API key hash does not match generated token") }
}

func TestP17ScopeAllowlistAndServiceCatalog(t *testing.T) {
	got := normalizedScopes([]string{"read", "admin.read", "root", "read"})
	want := []string{"read", "admin.read"}
	if !reflect.DeepEqual(got, want) { t.Fatalf("scopes=%v want=%v", got, want) }
	if len(p17Services) != 8 { t.Fatalf("expected 8 Go services, got %d", len(p17Services)) }
}
