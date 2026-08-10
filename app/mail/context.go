package mail

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"
)

func (s *Service) enrichTemplateValues(ctx context.Context, key, recipient string, values map[string]string) map[string]string {
	out:=map[string]string{}
	for k,v:=range values{out[k]=v}
	if _,ok:=out["site_name"];!ok {
		name:="GoJet"
		if value,exists,err:=s.settings.Get(ctx,"site.name");err==nil&&exists&&strings.Trim(strings.TrimSpace(value),`"`)!=""{name=strings.Trim(strings.TrimSpace(value),`"`)}
		out["site_name"]=name
	}
	if _,ok:=out["display_name"];!ok && strings.Contains(recipient,"@") {
		var display string
		if s.db.QueryRowContext(ctx,`SELECT display_name FROM users WHERE email=?`,strings.ToLower(strings.TrimSpace(recipient))).Scan(&display)==nil&&strings.TrimSpace(display)!=""{out["display_name"]=display}
	}
	switch key {
	case "password_reset":
		if _,ok:=out["expires_minutes"];!ok{out["expires_minutes"]="30"}
	case "workspace_invitation":
		s.enrichWorkspaceInvitation(ctx,out)
	}
	return out
}

func (s *Service) enrichWorkspaceInvitation(ctx context.Context, values map[string]string) {
	token:=strings.TrimSpace(values["token"]);if token==""{return}
	sum:=sha256.Sum256([]byte(token));digest:=hex.EncodeToString(sum[:])
	var workspace,role string;var expires time.Time
	if s.db.QueryRowContext(ctx,`SELECT w.name,i.role,i.expires_at FROM workspace_invitations i JOIN workspaces w ON w.id=i.workspace_id WHERE i.token_hash=? AND i.status='pending'`,digest).Scan(&workspace,&role,&expires)!=nil{return}
	values["workspace_name"]=workspace
	values["role_name"]=workspaceRoleName(role)
	values["expires_at"]=expires.Local().Format("2006-01-02 15:04")
	values["invitation_url"]=publicBaseURL()+"/app/team?invite="+token
}

func workspaceRoleName(role string) string {
	switch role{case "owner":return "所有者";case "admin":return "管理员";case "editor":return "编辑者";case "analyst":return "分析员";case "viewer":return "只读成员";default:return role}
}
