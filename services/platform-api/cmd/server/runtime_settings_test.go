package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/Techshrr/GoJet_Short_Link/app/settings"
)

func runtimeTestServer(t *testing.T) (*server, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	store, err := settings.NewStore(db, []byte("0123456789abcdef0123456789abcdef"))
	if err != nil {
		t.Fatal(err)
	}
	return &server{db: db, settings: store}, mock
}

func expectRuntimeSetting(mock sqlmock.Sqlmock, key, value string) {
	mock.ExpectQuery("SELECT setting_value,is_encrypted FROM system_settings WHERE setting_key=\\?").WithArgs(key).
		WillReturnRows(sqlmock.NewRows([]string{"setting_value", "is_encrypted"}).AddRow(value, false))
}

func TestRuntimeGateCanPauseUserAPI(t *testing.T) {
	s, mock := runtimeTestServer(t)
	expectRuntimeSetting(mock, "system.maintenance_mode", "false")
	expectRuntimeSetting(mock, "api.enabled", "false")
	called := false
	handler := s.maintenance(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { called = true }))
	request := httptest.NewRequest(http.MethodGet, "/api/workspaces", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusServiceUnavailable || called || !strings.Contains(response.Body.String(), "API 已由管理员暂停") {
		t.Fatalf("unexpected response %d %s called=%v", response.Code, response.Body.String(), called)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestRuntimeGateKeepsRecoveryEndpointsAvailable(t *testing.T) {
	s, mock := runtimeTestServer(t)
	called := false
	handler := s.maintenance(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { called = true }))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/admin/diagnostics", nil))
	if response.Code != http.StatusOK || !called {
		t.Fatalf("admin recovery route was blocked: %d", response.Code)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestValidateRuntimeSettings(t *testing.T) {
	if err := validateRuntimeSettings(map[string]any{"api.enabled": true, "cache.enabled": true, "cache.default_ttl_seconds": float64(300)}); err != nil {
		t.Fatal(err)
	}
	for name, values := range map[string]map[string]any{
		"api type":  {"api.enabled": "yes"},
		"low ttl":   {"cache.default_ttl_seconds": float64(5)},
		"float ttl": {"cache.default_ttl_seconds": 30.5},
	} {
		t.Run(name, func(t *testing.T) {
			if validateRuntimeSettings(values) == nil {
				t.Fatal("invalid runtime setting was accepted")
			}
		})
	}
}
