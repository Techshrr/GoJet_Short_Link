package main

import "testing"

func TestProductionDestinationRiskScannerAlwaysHasSemanticProvider(t *testing.T) {
	t.Setenv("DESTINATION_RISK_PROVIDER_URL", "")
	t.Setenv("DESTINATION_RISK_PROVIDER_TOKEN", "")
	scanner := newDestinationRiskScanner()
	if scanner == nil {
		t.Fatal("production destination-risk scanner is nil")
	}
	if scanner.Provider == nil {
		t.Fatal("production destination-risk scanner must not run without a provider")
	}
	if scanner.Provider.Name() != "semantic" {
		t.Fatalf("expected production scanner semantic fallback, got %q", scanner.Provider.Name())
	}
}

func TestOperationsHealthcheckFailsClosedWithoutDSN(t *testing.T) {
	t.Setenv("MYSQL_DSN", "")
	if operationsHealthcheck() {
		t.Fatal("operations healthcheck must fail closed when MySQL is not configured")
	}
}
