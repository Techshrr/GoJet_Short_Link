package main

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

var platformAPIStartedAt = time.Now().UTC()
var p17Services = []string{"platformapi", "redirectengine", "analyticsworker", "analyticsreconciler", "fileworker", "mailworker", "operationsmonitor", "logreceiver"}

func (s *server) registerP17AdminRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/admin/memberships", s.admin("workspaces.manage", s.adminMemberships))
	mux.HandleFunc("GET /api/admin/storage", s.admin("settings.manage", s.adminStorageConfiguration))
	mux.HandleFunc("GET /api/admin/services", s.admin("operations.manage", s.adminServiceStatus))
	mux.HandleFunc("PATCH /api/admin/governance/users/{id}/status", s.admin("users.manage", s.adminGovernedUserStatus))
	mux.HandleFunc("GET /api/admin/integrations/api-keys", s.admin("settings.manage", s.adminAPIKeys))
	mux.HandleFunc("POST /api/admin/integrations/api-keys", s.admin("settings.manage", s.adminCreateAPIKey))
	mux.HandleFunc("DELETE /api/admin/integrations/api-keys/{id}", s.admin("settings.manage", s.adminRevokeAPIKey))
	mux.HandleFunc("GET /api/admin/integrations/webhooks", s.admin("settings.manage", s.adminWebhooks))
	mux.HandleFunc("POST /api/admin/integrations/webhooks", s.admin("settings.manage", s.adminCreateWebhook))
	mux.HandleFunc("PATCH /api/admin/integrations/webhooks/{id}", s.admin("settings.manage", s.adminUpdateWebhook))
	mux.HandleFunc("DELETE /api/admin/integrations/webhooks/{id}", s.admin("settings.manage", s.adminDeleteWebhook))
	mux.HandleFunc("POST /api/admin/integrations/webhooks/{id}/test", s.admin("settings.manage", s.adminTestWebhook))
	mux.HandleFunc("GET /api/v1/integration/ping", s.apiKey(s.integrationPing))
}

func (s *server) adminMemberships(w http.ResponseWriter, r *http.Request) {
	limit, offset := page(r)
	rows, err := s.db.QueryContext(r.Context(), `SELECT m.workspace_id,w.name,m.user_id,u.email,m.role,m.status,m.joined_at FROM workspace_members m JOIN workspaces w ON w.id=m.workspace_id JOIN users u ON u.id=m.user_id ORDER BY m.joined_at DESC LIMIT ? OFFSET ?`, limit, offset)
	if err != nil { jsonResponse(w, 503, map[string]string{"error":"成员关系暂时不可用"}); return }
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var wid, uid int64; var workspace, email, role, status string; var joined time.Time
		if rows.Scan(&wid,&workspace,&uid,&email,&role,&status,&joined)==nil { items=append(items,map[string]any{"workspace_id":wid,"workspace":workspace,"user_id":uid,"email":email,"role":role,"status":status,"joined_at":joined}) }
	}
	jsonResponse(w,200,map[string]any{"data":items})
}

func (s *server) adminStorageConfiguration(w http.ResponseWriter, r *http.Request) {
	driver := strings.ToLower(strings.TrimSpace(getenv("FILE_STORAGE_DRIVER", "filesystem")))
	data := map[string]any{
		"backend": driver,
		"health": "startup-validated",
		"public_base_url": getenv("PUBLIC_BASE_URL", ""),
		"upload_path": getenv("UPLOAD_STORAGE_PATH", "storage/uploads"),
		"scan_temp_path": getenv("FILE_SCAN_TEMP_PATH", "storage/scan-temp"),
		"namespaces": map[string]string{"files":"files/", "generated_qr":"generated/qr/", "quarantine":"quarantine/", "temporary":"temporary/"},
	}
	if driver == "s3" {
		data["endpoint"] = getenv("S3_ENDPOINT", "")
		data["bucket"] = getenv("S3_BUCKET", "")
		data["region"] = getenv("S3_REGION", "")
		data["secure"] = strings.ToLower(getenv("S3_SECURE", "true")) != "false"
		data["access_key_configured"] = strings.TrimSpace(getenv("S3_ACCESS_KEY", "")) != ""
		data["secret_key_configured"] = strings.TrimSpace(getenv("S3_SECRET_KEY", "")) != ""
		data["scan_temp_path"] = getenv("S3_SCAN_TEMP_PATH", "storage/scan-temp")
	} else {
		data["root"] = getenv("FILE_STORAGE_PATH", "storage/files")
	}
	jsonResponse(w,200,data)
}

func (s *server) adminServiceStatus(w http.ResponseWriter, r *http.Request) {
	items := make([]map[string]any,0,len(p17Services))
	for _, name := range p17Services {
		item := map[string]any{"service":name,"status":"unknown","health":"no heartbeat signal","version":"unknown","last_seen_at":nil}
		if name == "platformapi" { item["status"]="healthy"; item["health"]="serving this Admin request"; item["last_seen_at"]=time.Now().UTC(); item["uptime_seconds"]=int64(time.Since(platformAPIStartedAt).Seconds()) }
		items=append(items,item)
	}
	jsonResponse(w,200,map[string]any{"data":items,"expected_services":len(p17Services)})
}

func (s *server) adminGovernedUserStatus(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r,"id")
	var in struct { Status string `json:"status"`; Reason string `json:"reason"` }
	if decode(w,r,&in)!=nil { return }
	in.Reason=strings.TrimSpace(in.Reason)
	if err!=nil || (in.Status!="active" && in.Status!="suspended") || len(in.Reason)<3 || len(in.Reason)>500 { jsonResponse(w,422,map[string]string{"error":"用户状态和 3–500 字符的治理原因必填"}); return }
	tx,err:=s.db.BeginTx(r.Context(),nil); if err!=nil { jsonResponse(w,503,map[string]string{"error":"用户状态更新失败"}); return }; defer tx.Rollback()
	res,err:=tx.ExecContext(r.Context(),`UPDATE users SET status=? WHERE id=? AND status<>'deleted'`,in.Status,id)
	if err!=nil { jsonResponse(w,503,map[string]string{"error":"用户状态更新失败"}); return }
	if n,_:=res.RowsAffected(); n!=1 { jsonResponse(w,404,map[string]string{"error":"用户不存在或已经删除"}); return }
	if in.Status=="suspended" { if _,err=tx.ExecContext(r.Context(),`DELETE FROM user_sessions WHERE user_id=?`,id); err!=nil { jsonResponse(w,503,map[string]string{"error":"用户会话撤销失败"}); return } }
	_,err=tx.ExecContext(r.Context(),`INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.user_status_governed','user',?,JSON_OBJECT('status',?,'reason',?,'administrator_id',?))`,id,in.Status,in.Reason,currentAdmin(r).ID)
	if err!=nil || tx.Commit()!=nil { jsonResponse(w,503,map[string]string{"error":"用户状态更新失败"}); return }
	jsonResponse(w,200,map[string]any{"updated":true,"status":in.Status})
}

func generateIntegrationSecret(prefix string) (string, []byte, error) {
	raw:=make([]byte,32); if _,err:=io.ReadFull(rand.Reader,raw); err!=nil { return "",nil,err }
	token:=prefix+hex.EncodeToString(raw); sum:=sha256.Sum256([]byte(token)); return token,sum[:],nil
}
func normalizedScopes(scopes []string) []string {
	allowed:=map[string]bool{"read":true,"write":true,"admin.read":true}
	seen:=map[string]bool{}; out:=[]string{}
	for _,scope:=range scopes { scope=strings.TrimSpace(scope); if allowed[scope]&&!seen[scope] { seen[scope]=true; out=append(out,scope) } }
	if len(out)==0 { out=[]string{"read"} }; return out
}

func (s *server) adminAPIKeys(w http.ResponseWriter, r *http.Request) {
	rows,err:=s.db.QueryContext(r.Context(),`SELECT id,name,token_prefix,scopes,status,expires_at,last_used_at,revoked_at,created_at FROM platform_api_keys ORDER BY created_at DESC LIMIT 200`)
	if err!=nil { jsonResponse(w,503,map[string]string{"error":"API Key 列表暂时不可用"}); return }; defer rows.Close()
	items:=[]map[string]any{}
	for rows.Next(){ var id int64; var name,prefix,status string; var scopes []byte; var expires,lastUsed,revoked sql.NullTime; var created time.Time
		if rows.Scan(&id,&name,&prefix,&scopes,&status,&expires,&lastUsed,&revoked,&created)==nil { var scopeList []string; _=json.Unmarshal(scopes,&scopeList); items=append(items,map[string]any{"id":id,"name":name,"prefix":prefix,"scopes":scopeList,"status":status,"expires_at":nullableTime(expires),"last_used_at":nullableTime(lastUsed),"revoked_at":nullableTime(revoked),"created_at":created}) }
	}
	jsonResponse(w,200,map[string]any{"data":items})
}
func (s *server) adminCreateAPIKey(w http.ResponseWriter,r *http.Request){
	var in struct { Name string `json:"name"`; Scopes []string `json:"scopes"`; ExpiresAt string `json:"expires_at"`; Reason string `json:"reason"` }
	if decode(w,r,&in)!=nil{return}; in.Name=strings.TrimSpace(in.Name); in.Reason=strings.TrimSpace(in.Reason)
	if len(in.Name)<2||len(in.Name)>120||len(in.Reason)<3 { jsonResponse(w,422,map[string]string{"error":"名称和至少 3 个字符的创建原因必填"}); return }
	var expires any=nil; if strings.TrimSpace(in.ExpiresAt)!="" { parsed,err:=time.Parse(time.RFC3339,in.ExpiresAt); if err!=nil||!parsed.After(time.Now()){jsonResponse(w,422,map[string]string{"error":"过期时间无效"});return}; expires=parsed.UTC() }
	token,hash,err:=generateIntegrationSecret("gjk_"); if err!=nil { jsonResponse(w,503,map[string]string{"error":"API Key 生成失败"}); return }
	scopes:=normalizedScopes(in.Scopes); encoded,_:=json.Marshal(scopes); prefix:=token[:12]
	res,err:=s.db.ExecContext(r.Context(),`INSERT INTO platform_api_keys(name,token_prefix,token_hash,scopes,created_by,expires_at) VALUES(?,?,?,?,?,?)`,in.Name,prefix,hash,encoded,currentAdmin(r).ID,expires)
	if err!=nil { jsonResponse(w,503,map[string]string{"error":"API Key 保存失败"}); return }; id,_:=res.LastInsertId()
	_,_=s.db.ExecContext(r.Context(),`INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.api_key_created','api_key',?,JSON_OBJECT('administrator_id',?,'name',?,'reason',?))`,id,currentAdmin(r).ID,in.Name,in.Reason)
	jsonResponse(w,201,map[string]any{"id":id,"name":in.Name,"token":token,"prefix":prefix,"scopes":scopes,"shown_once":true})
}
func (s *server) adminRevokeAPIKey(w http.ResponseWriter,r *http.Request){
	id,err:=pathID(r,"id"); var in struct{Reason string `json:"reason"`}; if decode(w,r,&in)!=nil{return}; in.Reason=strings.TrimSpace(in.Reason)
	if err!=nil||len(in.Reason)<3 {jsonResponse(w,422,map[string]string{"error":"API Key 编号和至少 3 个字符的撤销原因必填"});return}
	res,err:=s.db.ExecContext(r.Context(),`UPDATE platform_api_keys SET status='revoked',revoked_at=NOW() WHERE id=? AND status='active'`,id); if err!=nil{jsonResponse(w,503,map[string]string{"error":"API Key 撤销失败"});return}; if n,_:=res.RowsAffected();n!=1{jsonResponse(w,409,map[string]string{"error":"API Key 不存在或已经撤销"});return}
	_,_=s.db.ExecContext(r.Context(),`INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.api_key_revoked','api_key',?,JSON_OBJECT('administrator_id',?,'reason',?))`,id,currentAdmin(r).ID,in.Reason); jsonResponse(w,200,map[string]bool{"revoked":true})
}

func (s *server) apiKey(next http.HandlerFunc) http.HandlerFunc { return func(w http.ResponseWriter,r *http.Request){ token:=strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"),"Bearer ")); if !strings.HasPrefix(token,"gjk_") {jsonResponse(w,401,map[string]string{"error":"API key required"});return}; sum:=sha256.Sum256([]byte(token)); var id int64; var name,status string; var scopes []byte; var expires sql.NullTime; err:=s.db.QueryRowContext(r.Context(),`SELECT id,name,status,scopes,expires_at FROM platform_api_keys WHERE token_hash=?`,sum[:]).Scan(&id,&name,&status,&scopes,&expires); if err!=nil||status!="active"||(expires.Valid&&!expires.Time.After(time.Now())){jsonResponse(w,401,map[string]string{"error":"API key invalid or expired"});return}; _,_=s.db.ExecContext(r.Context(),`UPDATE platform_api_keys SET last_used_at=NOW() WHERE id=?`,id); ctx:=context.WithValue(r.Context(),p17APIKeyContext{},map[string]any{"id":id,"name":name,"scopes":json.RawMessage(scopes)}); next(w,r.WithContext(ctx)) } }
type p17APIKeyContext struct{}
func (s *server) integrationPing(w http.ResponseWriter,r *http.Request){ jsonResponse(w,200,map[string]any{"status":"ok","credential":r.Context().Value(p17APIKeyContext{})}) }

func validateWebhookURL(ctx context.Context, raw string) (*url.URL,error){
	u,err:=url.Parse(strings.TrimSpace(raw)); if err!=nil||u.Hostname()==""||(u.Scheme!="https"&&u.Scheme!="http")||u.User!=nil{return nil,errors.New("webhook URL must be an absolute HTTP(S) URL without userinfo")}
	ips,err:=net.DefaultResolver.LookupIPAddr(ctx,u.Hostname()); if err!=nil||len(ips)==0{return nil,errors.New("webhook hostname cannot be resolved")}
	for _,candidate:=range ips{ip:=candidate.IP;if ip.IsLoopback()||ip.IsPrivate()||ip.IsLinkLocalUnicast()||ip.IsLinkLocalMulticast()||ip.IsUnspecified()||ip.IsMulticast(){return nil,errors.New("webhook target may not resolve to a private or special-use address")}}
	return u,nil
}
func safeWebhookClient() *http.Client { d:=&net.Dialer{Timeout:4*time.Second}; transport:=&http.Transport{Proxy:http.ProxyFromEnvironment,ForceAttemptHTTP2:true,DialContext:func(ctx context.Context,network,address string)(net.Conn,error){host,port,err:=net.SplitHostPort(address);if err!=nil{return nil,err};ips,err:=net.DefaultResolver.LookupIPAddr(ctx,host);if err!=nil||len(ips)==0{return nil,errors.New("webhook hostname cannot be resolved")};for _,candidate:=range ips{ip:=candidate.IP;if ip.IsLoopback()||ip.IsPrivate()||ip.IsLinkLocalUnicast()||ip.IsLinkLocalMulticast()||ip.IsUnspecified()||ip.IsMulticast(){return nil,errors.New("webhook target blocked by SSRF policy")}};return d.DialContext(ctx,network,net.JoinHostPort(ips[0].IP.String(),port))}}; return &http.Client{Transport:transport,Timeout:6*time.Second,CheckRedirect:func(req *http.Request,via []*http.Request)error{if len(via)>=3{return errors.New("too many webhook redirects")};_,err:=validateWebhookURL(req.Context(),req.URL.String());return err}} }
func webhookEvents(events []string) []string {allowed:=map[string]bool{"link.created":true,"link.updated":true,"risk.changed":true,"file.ready":true,"billing.paid":true,"ticket.updated":true};seen:=map[string]bool{};out:=[]string{};for _,event:=range events{event=strings.TrimSpace(event);if allowed[event]&&!seen[event]{seen[event]=true;out=append(out,event)}};if len(out)==0{out=[]string{"link.updated"}};return out}

func (s *server) adminWebhooks(w http.ResponseWriter,r *http.Request){rows,err:=s.db.QueryContext(r.Context(),`SELECT id,name,endpoint_url,events,status,last_delivery_status,last_delivery_at,created_at,updated_at FROM platform_webhooks ORDER BY created_at DESC LIMIT 200`);if err!=nil{jsonResponse(w,503,map[string]string{"error":"Webhook 列表暂时不可用"});return};defer rows.Close();items:=[]map[string]any{};for rows.Next(){var id int64;var name,endpoint,status string;var events []byte;var delivery sql.NullInt64;var last sql.NullTime;var created,updated time.Time;if rows.Scan(&id,&name,&endpoint,&events,&status,&delivery,&last,&created,&updated)==nil{var eventList []string;_=json.Unmarshal(events,&eventList);items=append(items,map[string]any{"id":id,"name":name,"url":endpoint,"events":eventList,"status":status,"secret_configured":true,"last_delivery_status":func()any{if delivery.Valid{return delivery.Int64};return nil}(),"last_delivery_at":nullableTime(last),"created_at":created,"updated_at":updated})}};jsonResponse(w,200,map[string]any{"data":items})}
func (s *server) adminCreateWebhook(w http.ResponseWriter,r *http.Request){var in struct{Name string `json:"name"`;URL string `json:"url"`;Events []string `json:"events"`;Reason string `json:"reason"`};if decode(w,r,&in)!=nil{return};in.Name=strings.TrimSpace(in.Name);in.Reason=strings.TrimSpace(in.Reason);u,err:=validateWebhookURL(r.Context(),in.URL);if err!=nil||len(in.Name)<2||len(in.Name)>120||len(in.Reason)<3{msg:="名称、公开 HTTP(S) URL 和至少 3 个字符的创建原因必填";if err!=nil{msg=err.Error()};jsonResponse(w,422,map[string]string{"error":msg});return};events:=webhookEvents(in.Events);encoded,_:=json.Marshal(events);res,err:=s.db.ExecContext(r.Context(),`INSERT INTO platform_webhooks(name,endpoint_url,events,status,secret_setting_key,created_by) VALUES(?,?,?,'active','pending',?)`,in.Name,u.String(),encoded,currentAdmin(r).ID);if err!=nil{jsonResponse(w,503,map[string]string{"error":"Webhook 保存失败"});return};id,_:=res.LastInsertId();secret,_,err:=generateIntegrationSecret("gwh_");if err!=nil{jsonResponse(w,503,map[string]string{"error":"Webhook secret 生成失败"});return};key:=fmt.Sprintf("integrations.webhook.%d.secret",id);if err=s.settings.Set(r.Context(),key,secret,true);err!=nil{jsonResponse(w,503,map[string]string{"error":"Webhook secret 保存失败"});return};_,_=s.db.ExecContext(r.Context(),`UPDATE platform_webhooks SET secret_setting_key=? WHERE id=?`,key,id);_,_=s.db.ExecContext(r.Context(),`INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.webhook_created','webhook',?,JSON_OBJECT('administrator_id',?,'reason',?))`,id,currentAdmin(r).ID,in.Reason);jsonResponse(w,201,map[string]any{"id":id,"name":in.Name,"url":u.String(),"events":events,"secret":secret,"shown_once":true})}
func (s *server) adminUpdateWebhook(w http.ResponseWriter,r *http.Request){id,err:=pathID(r,"id");var in struct{Name string `json:"name"`;URL string `json:"url"`;Events []string `json:"events"`;Status string `json:"status"`;Reason string `json:"reason"`};if decode(w,r,&in)!=nil{return};in.Name=strings.TrimSpace(in.Name);in.Reason=strings.TrimSpace(in.Reason);u,e2:=validateWebhookURL(r.Context(),in.URL);if err!=nil||e2!=nil||len(in.Name)<2||len(in.Reason)<3||(in.Status!="active"&&in.Status!="disabled"){jsonResponse(w,422,map[string]string{"error":"Webhook 更新字段或治理原因无效"});return};events:=webhookEvents(in.Events);encoded,_:=json.Marshal(events);res,err:=s.db.ExecContext(r.Context(),`UPDATE platform_webhooks SET name=?,endpoint_url=?,events=?,status=? WHERE id=?`,in.Name,u.String(),encoded,in.Status,id);if err!=nil{jsonResponse(w,503,map[string]string{"error":"Webhook 更新失败"});return};if n,_:=res.RowsAffected();n!=1{jsonResponse(w,404,map[string]string{"error":"Webhook 不存在"});return};_,_=s.db.ExecContext(r.Context(),`INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.webhook_updated','webhook',?,JSON_OBJECT('administrator_id',?,'status',?,'reason',?))`,id,currentAdmin(r).ID,in.Status,in.Reason);jsonResponse(w,200,map[string]bool{"updated":true})}
func (s *server) adminDeleteWebhook(w http.ResponseWriter,r *http.Request){id,err:=pathID(r,"id");var in struct{Reason string `json:"reason"`};if decode(w,r,&in)!=nil{return};in.Reason=strings.TrimSpace(in.Reason);if err!=nil||len(in.Reason)<3{jsonResponse(w,422,map[string]string{"error":"Webhook 编号和至少 3 个字符的删除原因必填"});return};var key string;if s.db.QueryRowContext(r.Context(),`SELECT secret_setting_key FROM platform_webhooks WHERE id=?`,id).Scan(&key)!=nil{jsonResponse(w,404,map[string]string{"error":"Webhook 不存在"});return};if _,err=s.db.ExecContext(r.Context(),`DELETE FROM platform_webhooks WHERE id=?`,id);err!=nil{jsonResponse(w,503,map[string]string{"error":"Webhook 删除失败"});return};_ = s.settings.Set(r.Context(),key,"revoked",true);_,_=s.db.ExecContext(r.Context(),`INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.webhook_deleted','webhook',?,JSON_OBJECT('administrator_id',?,'reason',?))`,id,currentAdmin(r).ID,in.Reason);w.WriteHeader(204)}
func (s *server) adminTestWebhook(w http.ResponseWriter,r *http.Request){id,err:=pathID(r,"id");var in struct{Reason string `json:"reason"`};if decode(w,r,&in)!=nil{return};in.Reason=strings.TrimSpace(in.Reason);if err!=nil||len(in.Reason)<3{jsonResponse(w,422,map[string]string{"error":"Webhook 编号和至少 3 个字符的测试原因必填"});return};var endpoint,key,status string;if s.db.QueryRowContext(r.Context(),`SELECT endpoint_url,secret_setting_key,status FROM platform_webhooks WHERE id=?`,id).Scan(&endpoint,&key,&status)!=nil{jsonResponse(w,404,map[string]string{"error":"Webhook 不存在"});return};if status!="active"{jsonResponse(w,409,map[string]string{"error":"Webhook 已禁用"});return};if _,err=validateWebhookURL(r.Context(),endpoint);err!=nil{jsonResponse(w,422,map[string]string{"error":err.Error()});return};secret,exists,err:=s.settings.Get(r.Context(),key);if err!=nil||!exists||secret==""{jsonResponse(w,503,map[string]string{"error":"Webhook secret 不可用"});return};payload,_:=json.Marshal(map[string]any{"event":"gojet.test","webhook_id":id,"sent_at":time.Now().UTC()});mac:=hmac.New(sha256.New,[]byte(secret));_,_=mac.Write(payload);signature:=hex.EncodeToString(mac.Sum(nil));req,err:=http.NewRequestWithContext(r.Context(),http.MethodPost,endpoint,strings.NewReader(string(payload)));if err!=nil{jsonResponse(w,422,map[string]string{"error":"Webhook 请求创建失败"});return};req.Header.Set("Content-Type","application/json");req.Header.Set("X-GoJet-Event","gojet.test");req.Header.Set("X-GoJet-Signature-SHA256",signature);resp,err:=safeWebhookClient().Do(req);if err!=nil{_,_=s.db.ExecContext(r.Context(),`UPDATE platform_webhooks SET last_delivery_status=0,last_delivery_at=NOW() WHERE id=?`,id);jsonResponse(w,502,map[string]string{"error":"Webhook 测试请求失败"});return};defer resp.Body.Close();_,_=io.Copy(io.Discard,io.LimitReader(resp.Body,4096));_,_=s.db.ExecContext(r.Context(),`UPDATE platform_webhooks SET last_delivery_status=?,last_delivery_at=NOW() WHERE id=?`,resp.StatusCode,id);_,_=s.db.ExecContext(r.Context(),`INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.webhook_tested','webhook',?,JSON_OBJECT('administrator_id',?,'status',?,'reason',?))`,id,currentAdmin(r).ID,resp.StatusCode,in.Reason);jsonResponse(w,200,map[string]any{"delivered":resp.StatusCode>=200&&resp.StatusCode<300,"status_code":resp.StatusCode})}

func parseP17ID(value string)(int64,error){id,err:=strconv.ParseInt(value,10,64);if err!=nil||id<1{return 0,errors.New("invalid id")};return id,nil}
