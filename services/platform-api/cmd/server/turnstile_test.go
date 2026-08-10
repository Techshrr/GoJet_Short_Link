package main

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func turnstileTestServer(t *testing.T, status int, body string, inspect func(url.Values)) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("method = %s, want POST", r.Method)
		}
		if got := r.Header.Get("Content-Type"); !strings.HasPrefix(got, "application/x-www-form-urlencoded") {
			t.Fatalf("content type = %q", got)
		}
		if err := r.ParseForm(); err != nil {
			t.Fatal(err)
		}
		if inspect != nil {
			inspect(r.PostForm)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
}

func TestTurnstileRejectsMissingSecretAndToken(t *testing.T) {
	ctx := context.Background()
	if err := verifyTurnstileWithClient(ctx, nil, "", "", "login", "token", "", nil, false); err == nil || !strings.Contains(err.Error(), "Secret Key") {
		t.Fatalf("missing secret error = %v", err)
	}
	if err := verifyTurnstileWithClient(ctx, nil, "", "secret", "login", "", "", nil, false); err == nil || !strings.Contains(err.Error(), "完成人机验证") {
		t.Fatalf("missing token error = %v", err)
	}
}

func TestTurnstileAcceptsValidChallengeAndSendsExpectedFields(t *testing.T) {
	ts := turnstileTestServer(t, http.StatusOK, `{"success":true,"hostname":"app.gojet.cc","action":"login"}`, func(form url.Values) {
		if form.Get("secret") != "secret-value" || form.Get("response") != "token-value" || form.Get("remoteip") != "203.0.113.10" {
			t.Fatalf("unexpected siteverify form: %#v", form)
		}
	})
	defer ts.Close()
	err := verifyTurnstileWithClient(context.Background(), ts.Client(), ts.URL, "secret-value", "login", "token-value", "203.0.113.10", []string{"APP.GOJET.CC."}, false)
	if err != nil {
		t.Fatal(err)
	}
}

func TestTurnstileNeverFailOpensNegativeChallenge(t *testing.T) {
	ts := turnstileTestServer(t, http.StatusOK, `{"success":false,"error-codes":["invalid-input-response"]}`, nil)
	defer ts.Close()
	if err := verifyTurnstileWithClient(context.Background(), ts.Client(), ts.URL, "secret", "login", "bad", "", nil, true); err == nil || !strings.Contains(err.Error(), "验证失败") {
		t.Fatalf("negative challenge unexpectedly passed: %v", err)
	}
}

func TestTurnstileRejectsActionAndHostnameMismatch(t *testing.T) {
	ts := turnstileTestServer(t, http.StatusOK, `{"success":true,"hostname":"evil.example","action":"register"}`, nil)
	defer ts.Close()
	if err := verifyTurnstileWithClient(context.Background(), ts.Client(), ts.URL, "secret", "login", "token", "", []string{"gojet.cc"}, false); err == nil || !strings.Contains(err.Error(), "场景不匹配") {
		t.Fatalf("action mismatch = %v", err)
	}

	ts2 := turnstileTestServer(t, http.StatusOK, `{"success":true,"hostname":"evil.example","action":"login"}`, nil)
	defer ts2.Close()
	if err := verifyTurnstileWithClient(context.Background(), ts2.Client(), ts2.URL, "secret", "login", "token", "", []string{"gojet.cc"}, false); err == nil || !strings.Contains(err.Error(), "域名不匹配") {
		t.Fatalf("hostname mismatch = %v", err)
	}
}

func TestTurnstileFailOpenOnlyForTransportOrUpstreamFailure(t *testing.T) {
	upstream := turnstileTestServer(t, http.StatusServiceUnavailable, `{"error":"maintenance"}`, nil)
	defer upstream.Close()
	if err := verifyTurnstileWithClient(context.Background(), upstream.Client(), upstream.URL, "secret", "login", "token", "", nil, false); err == nil || !strings.Contains(err.Error(), "暂时不可用") {
		t.Fatalf("fail-closed upstream error = %v", err)
	}
	if err := verifyTurnstileWithClient(context.Background(), upstream.Client(), upstream.URL, "secret", "login", "token", "", nil, true); err != nil {
		t.Fatalf("explicit fail-open should accept upstream outage: %v", err)
	}

	invalid := turnstileTestServer(t, http.StatusOK, `not-json`, nil)
	defer invalid.Close()
	if err := verifyTurnstileWithClient(context.Background(), invalid.Client(), invalid.URL, "secret", "login", "token", "", nil, true); err == nil || !strings.Contains(err.Error(), "响应无效") {
		t.Fatalf("malformed response must fail closed even when fail-open enabled: %v", err)
	}
}

func TestTurnstileNetworkFailureHonorsFailOpen(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	address := listener.Addr().String()
	_ = listener.Close()
	client := &http.Client{Timeout: 200 * time.Millisecond}
	endpoint := "http://" + address
	if err := verifyTurnstileWithClient(context.Background(), client, endpoint, "secret", "login", "token", "", nil, false); err == nil || !strings.Contains(err.Error(), "暂时不可用") {
		t.Fatalf("network failure should fail closed by default: %v", err)
	}
	if err := verifyTurnstileWithClient(context.Background(), client, endpoint, "secret", "login", "token", "", nil, true); err != nil {
		t.Fatalf("network failure should honor explicit fail-open: %v", err)
	}
}
