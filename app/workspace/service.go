package workspace

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
)

type Service struct{ db *sql.DB }

func New(db *sql.DB) *Service { return &Service{db: db} }

var permissions = map[string]map[string]bool{"owner": {"manage": true, "edit": true, "analytics": true, "view": true}, "admin": {"manage": true, "edit": true, "analytics": true, "view": true}, "editor": {"edit": true, "analytics": true, "view": true}, "analyst": {"analytics": true, "view": true}, "viewer": {"view": true}}

func Allowed(role, permission string) bool { return permissions[role][permission] }
func (s *Service) Role(ctx context.Context, workspaceID, userID int64) (string, error) {
	var role string
	err := s.db.QueryRowContext(ctx, `SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=? AND status='active'`, workspaceID, userID).Scan(&role)
	return role, err
}
func (s *Service) Create(ctx context.Context, userID int64, name, kind string) (int64, error) {
	if name == "" || (kind != "personal" && kind != "company") {
		return 0, errors.New("invalid workspace")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `INSERT INTO workspaces(name,workspace_type,owner_id) VALUES(?,?,?)`, name, kind, userID)
	if err != nil {
		return 0, err
	}
	id, _ := result.LastInsertId()
	if _, err = tx.ExecContext(ctx, `INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(?,?,'owner')`, id, userID); err != nil {
		return 0, err
	}
	s.auditTx(ctx, tx, userID, id, "workspace.created", "workspace", id, map[string]any{"name": name})
	return id, tx.Commit()
}
func (s *Service) Invite(ctx context.Context, actor, workspaceID int64, email, role string) (string, error) {
	actorRole, err := s.Role(ctx, workspaceID, actor)
	if err != nil || !Allowed(actorRole, "manage") || role == "owner" || !Allowed(role, "view") {
		return "", errors.New("forbidden")
	}
	raw := make([]byte, 32)
	if _, err = rand.Read(raw); err != nil {
		return "", err
	}
	token := hex.EncodeToString(raw)
	sum := sha256.Sum256([]byte(token))
	result, err := s.db.ExecContext(ctx, `INSERT INTO workspace_invitations(workspace_id,email,role,token_hash,invited_by,expires_at) VALUES(?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 7 DAY))`, workspaceID, email, role, hex.EncodeToString(sum[:]), actor)
	if err != nil {
		return "", err
	}
	id, _ := result.LastInsertId()
	s.audit(ctx, actor, workspaceID, "invitation.created", "invitation", id, map[string]any{"email": email, "role": role})
	return token, nil
}
func (s *Service) Accept(ctx context.Context, userID int64, token string) error {
	sum := sha256.Sum256([]byte(token))
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var id, wid int64
	var email, role string
	err = tx.QueryRowContext(ctx, `SELECT i.id,i.workspace_id,i.email,i.role FROM workspace_invitations i JOIN users u ON u.id=? AND u.email=i.email WHERE i.token_hash=? AND i.status='pending' AND i.expires_at>NOW() FOR UPDATE`, userID, hex.EncodeToString(sum[:])).Scan(&id, &wid, &email, &role)
	if err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO workspace_members(workspace_id,user_id,role,status) VALUES(?,?,?,'active') ON DUPLICATE KEY UPDATE role=VALUES(role),status='active'`, wid, userID, role); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE workspace_invitations SET status='accepted',accepted_at=NOW() WHERE id=?`, id); err != nil {
		return err
	}
	s.auditTx(ctx, tx, userID, wid, "invitation.accepted", "invitation", id, nil)
	return tx.Commit()
}
func (s *Service) Revoke(ctx context.Context, actor, workspaceID, invitationID int64) error {
	role, err := s.Role(ctx, workspaceID, actor)
	if err != nil || !Allowed(role, "manage") {
		return errors.New("forbidden")
	}
	result, err := s.db.ExecContext(ctx, `UPDATE workspace_invitations SET status='revoked' WHERE id=? AND workspace_id=? AND status='pending'`, invitationID, workspaceID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	s.audit(ctx, actor, workspaceID, "invitation.revoked", "invitation", invitationID, nil)
	return nil
}
func (s *Service) ChangeRole(ctx context.Context, actor, workspaceID, userID int64, role string) error {
	actorRole, err := s.Role(ctx, workspaceID, actor)
	if err != nil || !Allowed(actorRole, "manage") || role == "owner" || !Allowed(role, "view") {
		return errors.New("forbidden")
	}
	result, err := s.db.ExecContext(ctx, `UPDATE workspace_members SET role=? WHERE workspace_id=? AND user_id=? AND role<>'owner' AND status='active'`, role, workspaceID, userID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	s.audit(ctx, actor, workspaceID, "member.role_changed", "user", userID, map[string]any{"role": role})
	return nil
}
func (s *Service) Remove(ctx context.Context, actor, workspaceID, userID int64) error {
	role, err := s.Role(ctx, workspaceID, actor)
	if err != nil || !Allowed(role, "manage") || actor == userID {
		return errors.New("forbidden")
	}
	result, err := s.db.ExecContext(ctx, `UPDATE workspace_members SET status='removed' WHERE workspace_id=? AND user_id=? AND role<>'owner'`, workspaceID, userID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	s.audit(ctx, actor, workspaceID, "member.removed", "user", userID, nil)
	return nil
}
func (s *Service) Expire(ctx context.Context) (int64, error) {
	result, err := s.db.ExecContext(ctx, `UPDATE workspace_invitations SET status='expired' WHERE status='pending' AND expires_at<=NOW()`)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
func (s *Service) audit(ctx context.Context, actor, wid int64, action, target string, targetID any, meta any) {
	payload, _ := json.Marshal(meta)
	_, _ = s.db.ExecContext(ctx, `INSERT INTO audit_logs(actor_user_id,workspace_id,action,target_type,target_id,metadata) VALUES(?,?,?,?,?,?)`, actor, wid, action, target, targetID, payload)
}
func (s *Service) auditTx(ctx context.Context, tx *sql.Tx, actor, wid int64, action, target string, targetID any, meta any) {
	payload, _ := json.Marshal(meta)
	_, _ = tx.ExecContext(ctx, `INSERT INTO audit_logs(actor_user_id,workspace_id,action,target_type,target_id,metadata) VALUES(?,?,?,?,?,?)`, actor, wid, action, target, targetID, payload)
}
