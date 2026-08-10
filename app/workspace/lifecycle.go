package workspace

import (
	"context"
	"database/sql"
	"errors"
	"strings"
)

type Detail struct {
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	Type    string `json:"type"`
	OwnerID int64  `json:"owner_user_id"`
	Role    string `json:"role"`
}

func (s *Service) Detail(ctx context.Context, actor, workspaceID int64) (Detail, error) {
	var out Detail
	err := s.db.QueryRowContext(ctx, `SELECT w.id,w.name,w.workspace_type,w.owner_id,m.role FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id AND m.user_id=? AND m.status='active' WHERE w.id=?`, actor, workspaceID).Scan(&out.ID, &out.Name, &out.Type, &out.OwnerID, &out.Role)
	return out, err
}

func (s *Service) Rename(ctx context.Context, actor, workspaceID int64, name string) error {
	role, err := s.Role(ctx, workspaceID, actor)
	if err != nil || !Allowed(role, "manage") {
		return errors.New("没有管理工作区的权限")
	}
	name = strings.TrimSpace(name)
	if name == "" || len([]rune(name)) > 120 {
		return errors.New("工作区名称不能为空且不能超过 120 个字符")
	}
	result, err := s.db.ExecContext(ctx, `UPDATE workspaces SET name=? WHERE id=?`, name, workspaceID)
	if err != nil {
		return err
	}
	if count, _ := result.RowsAffected(); count != 1 {
		return sql.ErrNoRows
	}
	s.audit(ctx, actor, workspaceID, "workspace.renamed", "workspace", workspaceID, map[string]any{"name": name})
	return nil
}

func (s *Service) TransferOwnership(ctx context.Context, actor, workspaceID, newOwner int64) error {
	if actor == newOwner {
		return errors.New("请选择其他成员接收所有权")
	}
	role, err := s.Role(ctx, workspaceID, actor)
	if err != nil || role != "owner" {
		return errors.New("只有当前所有者可以转移工作区")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var targetRole string
	if err = tx.QueryRowContext(ctx, `SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=? AND status='active' FOR UPDATE`, workspaceID, newOwner).Scan(&targetRole); err != nil {
		return errors.New("接收人必须是当前工作区的有效成员")
	}
	if _, err = tx.ExecContext(ctx, `UPDATE workspace_members SET role='admin' WHERE workspace_id=? AND user_id=? AND role='owner'`, workspaceID, actor); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE workspace_members SET role='owner' WHERE workspace_id=? AND user_id=? AND status='active'`, workspaceID, newOwner); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE workspaces SET owner_id=? WHERE id=? AND owner_id=?`, newOwner, workspaceID, actor); err != nil {
		return err
	}
	s.auditTx(ctx, tx, actor, workspaceID, "workspace.ownership_transferred", "workspace", workspaceID, map[string]any{"new_owner_user_id": newOwner})
	return tx.Commit()
}

func (s *Service) Delete(ctx context.Context, actor, workspaceID int64) error {
	role, err := s.Role(ctx, workspaceID, actor)
	if err != nil || role != "owner" {
		return errors.New("只有工作区所有者可以删除工作区")
	}
	result, err := s.db.ExecContext(ctx, `DELETE FROM workspaces WHERE id=? AND owner_id=?`, workspaceID, actor)
	if err != nil {
		return err
	}
	if count, _ := result.RowsAffected(); count != 1 {
		return sql.ErrNoRows
	}
	return nil
}
