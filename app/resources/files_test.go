package resources

import (
	"context"
	"encoding/binary"
	"io"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestScanClamAVStreamsFileAndAcceptsCleanResponse(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sample.txt")
	if err := os.WriteFile(path, []byte("safe payload"), 0600); err != nil {
		t.Fatal(err)
	}
	address, received, closeServer := fakeClamd(t, "stream: OK\x00")
	defer closeServer()
	clean, result, err := ScanClamAV(context.Background(), address, path)
	if err != nil || !clean || result != "stream: OK" {
		t.Fatalf("clean=%v result=%q err=%v", clean, result, err)
	}
	if value := <-received; value != "safe payload" {
		t.Fatalf("clamd received %q", value)
	}
}

func TestScanClamAVKeepsDetectedFileQuarantined(t *testing.T) {
	path := filepath.Join(t.TempDir(), "eicar.txt")
	if err := os.WriteFile(path, []byte("test signature"), 0600); err != nil {
		t.Fatal(err)
	}
	address, _, closeServer := fakeClamd(t, "stream: Win.Test.EICAR_HDB-1 FOUND\x00")
	defer closeServer()
	clean, result, err := ScanClamAV(context.Background(), address, path)
	if err != nil || clean || !strings.Contains(result, "FOUND") {
		t.Fatalf("clean=%v result=%q err=%v", clean, result, err)
	}
}

func fakeClamd(t *testing.T, response string) (string, <-chan string, func()) {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	received := make(chan string, 1)
	go func() {
		conn, acceptErr := listener.Accept()
		if acceptErr != nil {
			return
		}
		defer conn.Close()
		command := make([]byte, len("zINSTREAM\x00"))
		_, _ = io.ReadFull(conn, command)
		var payload []byte
		for {
			var size [4]byte
			if _, err := io.ReadFull(conn, size[:]); err != nil {
				return
			}
			length := binary.BigEndian.Uint32(size[:])
			if length == 0 {
				break
			}
			chunk := make([]byte, length)
			if _, err := io.ReadFull(conn, chunk); err != nil {
				return
			}
			payload = append(payload, chunk...)
		}
		received <- string(payload)
		_, _ = conn.Write([]byte(response))
	}()
	return listener.Addr().String(), received, func() { _ = listener.Close() }
}
