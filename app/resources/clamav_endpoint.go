package resources

import (
	"bufio"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"strings"
	"time"
)

// ScanClamAVEndpoint supports both the Docker TCP endpoint and the native
// Debian/aaPanel Unix socket. Existing ScanClamAV remains available for TCP
// callers and tests.
func ScanClamAVEndpoint(ctx context.Context, endpoint, path string) (bool, string, error) {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" || endpoint == "disabled" {
		return false, "", errors.New("clamd scanner is disabled")
	}
	if strings.HasPrefix(endpoint, "tcp://") {
		return ScanClamAV(ctx, strings.TrimPrefix(endpoint, "tcp://"), path)
	}
	if !strings.HasPrefix(endpoint, "unix://") && !strings.HasPrefix(endpoint, "/") {
		return ScanClamAV(ctx, endpoint, path)
	}

	address := strings.TrimPrefix(endpoint, "unix://")
	if address == "" {
		return false, "", errors.New("clamd unix socket path is empty")
	}
	dialer := net.Dialer{Timeout: 5 * time.Second}
	conn, err := dialer.DialContext(ctx, "unix", address)
	if err != nil {
		return false, "", fmt.Errorf("clamd connection: %w", err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(2 * time.Minute))

	file, err := os.Open(path)
	if err != nil {
		return false, "", err
	}
	defer file.Close()
	if _, err = conn.Write([]byte("zINSTREAM\x00")); err != nil {
		return false, "", err
	}
	buffer := make([]byte, 32*1024)
	for {
		n, readErr := file.Read(buffer)
		if n > 0 {
			var size [4]byte
			binary.BigEndian.PutUint32(size[:], uint32(n))
			if _, err = conn.Write(size[:]); err == nil {
				_, err = conn.Write(buffer[:n])
			}
			if err != nil {
				return false, "", err
			}
		}
		if errors.Is(readErr, io.EOF) {
			break
		}
		if readErr != nil {
			return false, "", readErr
		}
	}
	if _, err = conn.Write([]byte{0, 0, 0, 0}); err != nil {
		return false, "", err
	}
	response, err := bufio.NewReader(conn).ReadString(0)
	response = strings.TrimSpace(strings.TrimSuffix(response, "\x00"))
	if err != nil && !errors.Is(err, io.EOF) {
		return false, response, err
	}
	if strings.HasSuffix(response, " OK") {
		return true, response, nil
	}
	if strings.Contains(response, " FOUND") {
		return false, response, nil
	}
	return false, response, errors.New("clamd returned an unknown response")
}
