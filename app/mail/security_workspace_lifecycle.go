package mail

import (
	"context"
	"database/sql"
	"encoding/json"
	"strconv"
	"strings"
	"time"
)

func (s *Service) QueueSecurityAndWorkspaceNotifications(ctx context.Context) error {
	if err:=s.queueEmailChanged(ctx);err!=nil{return err}
	if err:=s.queueWorkspaceRoleChanged(ctx);err!=nil{return err}
	if err:=s.queueWorkspaceMemberRemoved(ctx);err!=nil{return err}
	if err:=s.queueWorkspaceOwnershipTransferred(ctx);err!=nil{return err}
	if err:=s.queueDomainVerificationFailed(ctx);err!=nil{return err}
	return nil
}

func (s *Service) queueEmailChanged(ctx context.Context) error {
	rows,err:=s.db.QueryContext(ctx,`SELECT a.id,a.metadata,a.created_at FROM audit_logs a WHERE a.action='user.email_changed' ORDER BY a.id LIMIT 200`);if err!=nil{return err};defer rows.Close()
	for rows.Next(){var id int64;var raw []byte;var changed time.Time;if err=rows.Scan(&id,&raw,&changed);err!=nil{return err};var meta struct{OldEmail string `json:"old_email"`;NewEmail string `json:"new_email"`};if json.Unmarshal(raw,&meta)!=nil||!strings.Contains(meta.OldEmail,"@")||!strings.Contains(meta.NewEmail,"@"){continue};values:=map[string]string{"old_email":meta.OldEmail,"new_email":meta.NewEmail,"changed_at":changed.Local().Format("2006-01-02 15:04")};base:="email_changed:"+strconv.FormatInt(id,10);if _,err=s.QueueTemplateOnce(ctx,"email_changed",base+":old",meta.OldEmail,values);err!=nil{return err};if !strings.EqualFold(meta.OldEmail,meta.NewEmail){if _,err=s.QueueTemplateOnce(ctx,"email_changed",base+":new",meta.NewEmail,values);err!=nil{return err}}}
	return rows.Err()
}

func (s *Service) queueWorkspaceRoleChanged(ctx context.Context) error {
	rows,err:=s.db.QueryContext(ctx,`SELECT a.id,w.name,u.email,COALESCE(JSON_UNQUOTE(JSON_EXTRACT(a.metadata,'$.role')),''),COALESCE(NULLIF(actor.display_name,''),actor.email,'平台管理员') FROM audit_logs a JOIN workspaces w ON w.id=a.workspace_id JOIN users u ON u.id=CAST(a.target_id AS UNSIGNED) LEFT JOIN users actor ON actor.id=a.actor_user_id WHERE a.action='member.role_changed' ORDER BY a.id LIMIT 200`);if err!=nil{return err};defer rows.Close()
	for rows.Next(){var id int64;var workspace,email,role,actor string;if err=rows.Scan(&id,&workspace,&email,&role,&actor);err!=nil{return err};if role==""{continue};if _,err=s.QueueTemplateOnce(ctx,"workspace_role_changed","workspace_role_changed:"+strconv.FormatInt(id,10),email,map[string]string{"workspace_name":workspace,"new_role":workspaceRoleName(role),"actor":actor});err!=nil{return err}}
	return rows.Err()
}

func (s *Service) queueWorkspaceMemberRemoved(ctx context.Context) error {
	rows,err:=s.db.QueryContext(ctx,`SELECT a.id,w.name,u.email FROM audit_logs a JOIN workspaces w ON w.id=a.workspace_id JOIN users u ON u.id=CAST(a.target_id AS UNSIGNED) WHERE a.action='member.removed' ORDER BY a.id LIMIT 200`);if err!=nil{return err};defer rows.Close()
	for rows.Next(){var id int64;var workspace,email string;if err=rows.Scan(&id,&workspace,&email);err!=nil{return err};if _,err=s.QueueTemplateOnce(ctx,"workspace_member_removed","workspace_member_removed:"+strconv.FormatInt(id,10),email,map[string]string{"workspace_name":workspace});err!=nil{return err}}
	return rows.Err()
}

func (s *Service) queueWorkspaceOwnershipTransferred(ctx context.Context) error {
	rows,err:=s.db.QueryContext(ctx,`SELECT a.id,w.name,a.actor_user_id,COALESCE(JSON_UNQUOTE(JSON_EXTRACT(a.metadata,'$.new_owner_user_id')),''),a.created_at FROM audit_logs a JOIN workspaces w ON w.id=a.workspace_id WHERE a.action='workspace.ownership_transferred' ORDER BY a.id LIMIT 200`);if err!=nil{return err};defer rows.Close()
	for rows.Next(){var id int64;var workspace,newOwnerRaw string;var oldOwnerID sql.NullInt64;var changed time.Time;if err=rows.Scan(&id,&workspace,&oldOwnerID,&newOwnerRaw,&changed);err!=nil{return err};newOwnerID,parseErr:=strconv.ParseInt(newOwnerRaw,10,64);if parseErr!=nil||newOwnerID<1||!oldOwnerID.Valid{continue};var oldEmail,oldName,newEmail,newName string;if s.db.QueryRowContext(ctx,`SELECT email,display_name FROM users WHERE id=?`,oldOwnerID.Int64).Scan(&oldEmail,&oldName)!=nil{continue};if s.db.QueryRowContext(ctx,`SELECT email,display_name FROM users WHERE id=?`,newOwnerID).Scan(&newEmail,&newName)!=nil{continue};if strings.TrimSpace(oldName)==""{oldName=oldEmail};if strings.TrimSpace(newName)==""{newName=newEmail};values:=map[string]string{"workspace_name":workspace,"old_owner":oldName,"new_owner":newName,"changed_at":changed.Local().Format("2006-01-02 15:04")};base:="workspace_owner_transferred:"+strconv.FormatInt(id,10);if _,err=s.QueueTemplateOnce(ctx,"workspace_owner_transferred",base+":old",oldEmail,values);err!=nil{return err};if !strings.EqualFold(oldEmail,newEmail){if _,err=s.QueueTemplateOnce(ctx,"workspace_owner_transferred",base+":new",newEmail,values);err!=nil{return err}}}
	return rows.Err()
}

func (s *Service) queueDomainVerificationFailed(ctx context.Context) error {
	rows,err:=s.db.QueryContext(ctx,`SELECT d.id,d.hostname,COALESCE(d.last_error,'验证未通过'),d.last_checked_at,w.id,u.email FROM custom_domains d JOIN workspaces w ON w.id=d.workspace_id JOIN workspace_members wm ON wm.workspace_id=w.id AND wm.role='owner' AND wm.status='active' JOIN users u ON u.id=wm.user_id WHERE (d.status='error' OR d.https_status='error') AND d.last_checked_at IS NOT NULL ORDER BY d.last_checked_at LIMIT 200`);if err!=nil{return err};defer rows.Close();baseURL:=publicBaseURL()
	for rows.Next(){var id,wid int64;var host,reason,email string;var checked time.Time;if err=rows.Scan(&id,&host,&reason,&checked,&wid,&email);err!=nil{return err};dedupe:="domain_verification_failed:"+strconv.FormatInt(id,10)+":"+checked.UTC().Format("20060102150405");if _,err=s.QueueTemplateOnce(ctx,"domain_verification_failed",dedupe,email,map[string]string{"domain_name":host,"reason":reason,"domains_url":baseURL+"/app/domains"});err!=nil{return err}}
	return rows.Err()
}
