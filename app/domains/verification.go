package domains

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"

	"github.com/Techshrr/GoJet_Short_Link/app/workspace"
)

// RotateVerification issues a fresh TXT verification secret for a domain whose
// original plaintext token may no longer be available to the user. Only a hash
// is persisted; requesting a new record invalidates the previous TXT value.
func (s *Service) RotateVerification(ctx context.Context, userID, workspaceID, id int64) (Domain, string, error) {
	role, err := s.workspaces.Role(ctx, workspaceID, userID)
	if err != nil || !workspace.Allowed(role, "manage") {
		return Domain{}, "", errors.New("forbidden")
	}
	var item Domain
	if err = s.db.QueryRowContext(ctx, `SELECT id,workspace_id,hostname,status,https_status,last_error,last_checked_at,created_at FROM custom_domains WHERE id=? AND workspace_id=?`, id, workspaceID).Scan(&item.ID, &item.WorkspaceID, &item.Hostname, &item.Status, &item.HTTPSStatus, &item.LastError, &item.LastCheckedAt, &item.CreatedAt); err != nil {
		return Domain{}, "", err
	}
	raw := make([]byte, 24)
	if _, err = rand.Read(raw); err != nil {
		return Domain{}, "", err
	}
	token := hex.EncodeToString(raw)
	sum := sha256.Sum256([]byte(token))
	if _, err = s.db.ExecContext(ctx, `UPDATE custom_domains SET verification_token_hash=?,status='pending',https_status='pending',last_error=NULL,last_checked_at=NULL WHERE id=? AND workspace_id=?`, hex.EncodeToString(sum[:]), id, workspaceID); err != nil {
		return Domain{}, "", err
	}
	item.Status = "pending"
	item.HTTPSStatus = "pending"
	item.LastError = nil
	item.LastCheckedAt = nil
	return item, token, nil
}
