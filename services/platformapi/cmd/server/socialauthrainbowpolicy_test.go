package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRainbowCallbackPolicyRejectsInvalidLoginType(t *testing.T) {
	called := false
	handler := rainbowCallbackPolicyHandler(func(context.Context, string) bool { return true }, func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	handler(recorder, httptest.NewRequest(http.MethodGet, "/api/public/auth/rainbow/callback?type=unknown&state=test", nil))

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid Rainbow callback type to return 400, got %d", recorder.Code)
	}
	if called {
		t.Fatal("invalid Rainbow callback type reached the downstream callback")
	}
}

func TestRainbowCallbackPolicyRejectsMethodRevokedAfterStart(t *testing.T) {
	called := false
	handler := rainbowCallbackPolicyHandler(func(_ context.Context, loginType string) bool {
		return loginType == "wx"
	}, func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	handler(recorder, httptest.NewRequest(http.MethodGet, "/api/public/auth/rainbow/callback?type=qq&state=pending-before-admin-change&code=upstream-code", nil))

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected revoked Rainbow method to return 403, got %d", recorder.Code)
	}
	if called {
		t.Fatal("revoked Rainbow method reached the downstream login/bind callback")
	}
}

func TestRainbowCallbackPolicyAllowsCurrentlyApprovedMethod(t *testing.T) {
	called := false
	handler := rainbowCallbackPolicyHandler(func(_ context.Context, loginType string) bool {
		return loginType == "qq"
	}, func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	handler(recorder, httptest.NewRequest(http.MethodGet, "/api/public/auth/rainbow/callback?type=QQ&state=current&code=upstream-code", nil))

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected approved Rainbow method to reach callback, got %d", recorder.Code)
	}
	if !called {
		t.Fatal("approved Rainbow method did not reach the downstream callback")
	}
}

func TestRainbowCallbackPolicyFailsClosedWithoutApprovalResolver(t *testing.T) {
	called := false
	handler := rainbowCallbackPolicyHandler(nil, func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	handler(recorder, httptest.NewRequest(http.MethodGet, "/api/public/auth/rainbow/callback?type=qq&state=current&code=upstream-code", nil))

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected missing approval resolver to fail closed with 403, got %d", recorder.Code)
	}
	if called {
		t.Fatal("missing approval resolver reached the downstream callback")
	}
}
