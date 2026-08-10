package organization

import (
	"context"
	"database/sql"
	"errors"
	"regexp"
	"strings"
)

func normalizeResourceName(value string, max int) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" || len([]rune(value)) > max {
		return "", errors.New("名称无效")
	}
	return value, nil
}

func (s *Service) UpdateFolder(ctx context.Context, uid, wid, id int64, name string) error {
	if err := s.manage(ctx, wid, uid); err != nil {
		return err
	}
	name, err := normalizeResourceName(name, 120)
	if err != nil {
		return err
	}
	res, err := s.db.ExecContext(ctx, `UPDATE folders SET name=? WHERE id=? AND workspace_id=?`, name, id, wid)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Service) DeleteFolder(ctx context.Context, uid, wid, id int64) error {
	if err := s.manage(ctx, wid, uid); err != nil {
		return err
	}
	res, err := s.db.ExecContext(ctx, `DELETE FROM folders WHERE id=? AND workspace_id=?`, id, wid)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Service) UpdateCampaign(ctx context.Context, uid, wid, id int64, name, status string) error {
	if err := s.manage(ctx, wid, uid); err != nil {
		return err
	}
	name, err := normalizeResourceName(name, 120)
	if err != nil {
		return err
	}
	if status != "active" && status != "paused" && status != "completed" {
		return errors.New("活动状态无效")
	}
	res, err := s.db.ExecContext(ctx, `UPDATE campaigns SET name=?,status=? WHERE id=? AND workspace_id=?`, name, status, id, wid)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Service) DeleteCampaign(ctx context.Context, uid, wid, id int64) error {
	if err := s.manage(ctx, wid, uid); err != nil {
		return err
	}
	res, err := s.db.ExecContext(ctx, `DELETE FROM campaigns WHERE id=? AND workspace_id=?`, id, wid)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Service) UpdateTag(ctx context.Context, uid, wid, id int64, name, color string) error {
	if err := s.manage(ctx, wid, uid); err != nil {
		return err
	}
	name, err := normalizeResourceName(name, 80)
	if err != nil {
		return err
	}
	if color == "" {
		color = "#64748b"
	}
	if !regexp.MustCompile(`^#[0-9a-fA-F]{6}$`).MatchString(color) {
		return errors.New("标签颜色无效")
	}
	res, err := s.db.ExecContext(ctx, `UPDATE tags SET name=?,color=? WHERE id=? AND workspace_id=?`, name, color, id, wid)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Service) DeleteTag(ctx context.Context, uid, wid, id int64) error {
	if err := s.manage(ctx, wid, uid); err != nil {
		return err
	}
	res, err := s.db.ExecContext(ctx, `DELETE FROM tags WHERE id=? AND workspace_id=?`, id, wid)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}
	return nil
}
