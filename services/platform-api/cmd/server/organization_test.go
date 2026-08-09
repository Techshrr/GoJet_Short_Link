package main

import (
	"net/http/httptest"
	"testing"
)

func TestClientIPUsesNginxNormalizedRealIP(t *testing.T) {
	request := httptest.NewRequest("POST", "/conversion", nil)
	request.RemoteAddr = "10.0.0.5:54321"
	request.Header.Set("X-Forwarded-For", "203.0.113.9")
	request.Header.Set("X-Real-IP", "198.51.100.7")
	if value := clientIP(request); value != "198.51.100.7" {
		t.Fatalf("unexpected client IP %q", value)
	}
}

func TestClientIPRejectsMalformedForwardedValue(t *testing.T) {
	request := httptest.NewRequest("POST", "/conversion", nil)
	request.RemoteAddr = "10.0.0.5:54321"
	request.Header.Set("X-Real-IP", "not-an-ip")
	if value := clientIP(request); value != "10.0.0.5" {
		t.Fatalf("unexpected fallback IP %q", value)
	}
}
