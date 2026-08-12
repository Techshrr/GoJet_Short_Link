//go:build integration_clamav

package resources

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestRealClamAVEICARAndCleanFile(t *testing.T) {
	address := os.Getenv("INTEGRATION_CLAMAV_ADDRESS")
	if address == "" {
		address = "127.0.0.1:3319"
	}
	directory := t.TempDir()
	eicar := filepath.Join(directory, "eicar.txt")
	// The canonical harmless anti-malware test signature, assembled to avoid
	// source-tree scanners quarantining this test file itself.
	signature := "X5O!P%@AP[4\\PZX54(P^)7CC)7}$" + "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
	if err := os.WriteFile(eicar, []byte(signature), 0644); err != nil {
		t.Fatal(err)
	}
	clean, response, err := ScanClamAV(context.Background(), address, eicar)
	if err != nil {
		t.Fatalf("scan EICAR: %v (%s)", err, response)
	}
	if clean || !strings.Contains(response, "FOUND") {
		t.Fatalf("EICAR was not quarantined: clean=%v response=%q", clean, response)
	}
	cleanFile := filepath.Join(directory, "clean.txt")
	if err = os.WriteFile(cleanFile, []byte("GoJet integration "+time.Now().UTC().Format(time.RFC3339Nano)), 0644); err != nil {
		t.Fatal(err)
	}
	clean, response, err = ScanClamAV(context.Background(), address, cleanFile)
	if err != nil || !clean || !strings.HasSuffix(response, "OK") {
		t.Fatalf("clean file rejected: clean=%v response=%q error=%v", clean, response, err)
	}
}
