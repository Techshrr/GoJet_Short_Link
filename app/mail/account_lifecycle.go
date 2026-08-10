package mail

import (
	"context"
	"strconv"
	"strings"
	"time"
)

func (s *Service) QueueAccountLifecycleNotifications(ctx context.Context) error {
	requireVerification:=false
	if value,exists,err:=s.settings.Get(ctx,"registration.require_email_verification");err==nil&&exists{requireVerification=strings.EqualFold(strings.Trim(strings.TrimSpace(value),`"`),"true")||strings.TrimSpace(value)=="1"}
	condition:="u.status='active'"
	if requireVerification{condition+=" AND u.email_verified_at IS NOT NULL"}
	rows,err:=s.db.QueryContext(ctx,`SELECT u.id,u.email,u.display_name FROM users u WHERE `+condition+` AND NOT EXISTS(SELECT 1 FROM mail_messages m WHERE m.dedupe_key=CONCAT('account_welcome:',u.id)) ORDER BY u.id LIMIT 100`)
	if err!=nil{return err};defer rows.Close();base:=publicBaseURL()
	for rows.Next(){var id int64;var email,name string;if err=rows.Scan(&id,&email,&name);err!=nil{return err};if _,err=s.QueueTemplateOnce(ctx,"account_welcome","account_welcome:"+strconv.FormatInt(id,10),email,map[string]string{"display_name":name,"console_url":base+"/app/dashboard"});err!=nil{return err}}
	if err=rows.Err();err!=nil{return err}
	resets,err:=s.db.QueryContext(ctx,`SELECT t.id,u.email,t.used_at FROM password_reset_tokens t JOIN users u ON u.id=t.user_id WHERE t.used_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM mail_messages m WHERE m.dedupe_key=CONCAT('password_changed:reset:',t.id)) ORDER BY t.id LIMIT 100`)
	if err!=nil{return err};defer resets.Close()
	for resets.Next(){var id int64;var email string;var changed time.Time;if err=resets.Scan(&id,&email,&changed);err!=nil{return err};if _,err=s.QueueTemplateOnce(ctx,"password_changed","password_changed:reset:"+strconv.FormatInt(id,10),email,map[string]string{"changed_at":changed.Local().Format("2006-01-02 15:04")});err!=nil{return err}}
	return resets.Err()
}
