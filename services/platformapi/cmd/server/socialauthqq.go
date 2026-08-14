package main

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/Techshrr/GoJet_Short_Link/app/identity"
)

var (
	qqOAuthAuthorizeURL = "https://graph.qq.com/oauth2.0/authorize"
	qqOAuthTokenURL     = "https://graph.qq.com/oauth2.0/token"
	qqOAuthOpenIDURL    = "https://graph.qq.com/oauth2.0/me"
	qqUserInfoURL       = "https://graph.qq.com/user/get_user_info"
)

func (s *server) qqAuthStart(w http.ResponseWriter, r *http.Request) {
	const provider = "qq"
	config, configured, err := s.socialProviderConfiguration(r.Context(), provider)
	if err != nil { jsonResponse(w,http.StatusServiceUnavailable,map[string]string{"error":"第三方登录配置暂时不可用"}); return }
	if !configured { jsonResponse(w,http.StatusNotFound,map[string]string{"error":"该第三方登录方式当前不可用"}); return }
	base, secure, err := socialPublicBase()
	if err != nil { jsonResponse(w,http.StatusServiceUnavailable,map[string]string{"error":"第三方登录回调地址配置无效"}); return }
	state, err := randomURLToken(32); if err != nil { jsonResponse(w,http.StatusServiceUnavailable,map[string]string{"error":"暂时无法创建登录请求"}); return }
	nonce, err := randomURLToken(32); if err != nil { jsonResponse(w,http.StatusServiceUnavailable,map[string]string{"error":"暂时无法创建登录请求"}); return }
	browserSecret, err := randomURLToken(32); if err != nil { jsonResponse(w,http.StatusServiceUnavailable,map[string]string{"error":"暂时无法创建登录请求"}); return }
	returnTo := safeSocialReturn(r.URL.Query().Get("redirect")); ip:=clientIP(r); if ip=="" { ip="0.0.0.0" }
	if _,err=s.db.ExecContext(r.Context(),`INSERT INTO social_auth_attempts(state_hash,nonce_hash,pkce_verifier_hash,provider,return_to,ip_address,user_agent,expires_at) VALUES(?,?,?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE))`,hashText(state),hashText(nonce),hashText(browserSecret),provider,returnTo,ip,limitText(r.UserAgent(),512));err!=nil { jsonResponse(w,http.StatusServiceUnavailable,map[string]string{"error":"暂时无法保存登录请求"}); return }
	setSocialCookie(w,socialStateCookie,state,secure); setSocialCookie(w,socialNonceCookie,nonce,secure); setSocialCookie(w,socialPKCECookie,browserSecret,secure)
	callback:=base+"/api/public/auth/qq/callback"
	http.Redirect(w,r,qqAuthorizationRedirect(config,state,callback),http.StatusFound)
}

func qqAuthorizationRedirect(config socialProviderConfig,state,callback string) string {
	values:=url.Values{}
	values.Set("response_type","code"); values.Set("client_id",config.ClientID); values.Set("redirect_uri",callback); values.Set("scope","get_user_info"); values.Set("state",state)
	return qqOAuthAuthorizeURL+"?"+values.Encode()
}

func (s *server) qqAuthCallback(w http.ResponseWriter,r *http.Request) {
	const provider="qq"
	config,configured,err:=s.socialProviderConfiguration(r.Context(),provider)
	if err!=nil { jsonResponse(w,http.StatusServiceUnavailable,map[string]string{"error":"第三方登录配置暂时不可用"}); return }
	if !configured { jsonResponse(w,http.StatusForbidden,map[string]string{"error":"该第三方登录方式已经停用"}); return }
	if r.URL.Query().Get("error")!="" { redirectSocialError(w,r,"cancelled"); return }
	code:=strings.TrimSpace(r.URL.Query().Get("code")); state:=strings.TrimSpace(r.URL.Query().Get("state"))
	if code==""||state=="" { jsonResponse(w,http.StatusBadRequest,map[string]string{"error":"第三方登录回调缺少必要参数"}); return }
	stateCookie,stateErr:=r.Cookie(socialStateCookie); nonceCookie,nonceErr:=r.Cookie(socialNonceCookie); secretCookie,secretErr:=r.Cookie(socialPKCECookie)
	if stateErr!=nil||nonceErr!=nil||secretErr!=nil||subtle.ConstantTimeCompare([]byte(state),[]byte(stateCookie.Value))!=1 { jsonResponse(w,http.StatusBadRequest,map[string]string{"error":"第三方登录状态验证失败"}); return }
	returnTo,err:=s.consumeSocialAttempt(r.Context(),provider,state,nonceCookie.Value,secretCookie.Value)
	if err!=nil { jsonResponse(w,http.StatusBadRequest,map[string]string{"error":"第三方登录请求无效、已过期或已经使用"}); return }
	clearSocialCookies(w)
	base,_,err:=socialPublicBase(); if err!=nil { redirectSocialError(w,r,"provider_failed"); return }
	callback:=base+"/api/public/auth/qq/callback"
	token,err:=exchangeQQCode(r.Context(),config,code,callback); if err!=nil { redirectSocialError(w,r,"provider_failed"); return }
	profile,err:=fetchQQSocialProfile(r.Context(),config,token); token=""
	if err!=nil { redirectSocialError(w,r,"provider_profile"); return }
	allowRegister:=s.registrationBool(r.Context(),"registration.enabled",true); emailAllowed:=!s.blockedRegistrationEmail(r.Context(),profile.Email)
	user,_,err:=s.identity.ResolveOrRegisterSocial(r.Context(),profile,allowRegister,emailAllowed)
	if err!=nil {
		switch {
		case profile.Email=="" || !profile.EmailVerified: redirectSocialError(w,r,"binding_required")
		case errors.Is(err,identity.ErrSocialEmailCollision): redirectSocialError(w,r,"email_exists")
		case errors.Is(err,identity.ErrSocialRegistrationClosed): redirectSocialError(w,r,"registration_closed")
		case errors.Is(err,identity.ErrSocialEmailBlocked): redirectSocialError(w,r,"email_blocked")
		default: redirectSocialError(w,r,"provider_failed")
		}; return
	}
	if err=s.completeSocialLogin(r.Context(),w,r,user,provider,returnTo);err!=nil { redirectSocialError(w,r,"provider_failed") }
}

func exchangeQQCode(ctx context.Context,config socialProviderConfig,code,redirectURI string)(string,error){
	values:=url.Values{}
	values.Set("grant_type","authorization_code"); values.Set("client_id",config.ClientID); values.Set("client_secret",config.ClientSecret); values.Set("code",code); values.Set("redirect_uri",redirectURI); values.Set("fmt","json")
	req,err:=http.NewRequestWithContext(ctx,http.MethodGet,qqOAuthTokenURL+"?"+values.Encode(),nil); if err!=nil{return "",err}
	req.Header.Set("Accept","application/json"); req.Header.Set("User-Agent","GoJet")
	resp,err:=socialOAuthHTTPClient.Do(req); if err!=nil{return "",err}; defer resp.Body.Close()
	if resp.StatusCode<200||resp.StatusCode>=300{return "",fmt.Errorf("qq token exchange returned %d",resp.StatusCode)}
	var out struct{AccessToken string `json:"access_token"`; Error int `json:"error"`; ErrorDescription string `json:"error_description"`}
	if err=json.NewDecoder(io.LimitReader(resp.Body,1<<20)).Decode(&out);err!=nil{return "",err}
	if out.Error!=0||strings.TrimSpace(out.AccessToken)==""{return "",errors.New("qq token exchange did not return an access token")}
	return strings.TrimSpace(out.AccessToken),nil
}

func fetchQQSocialProfile(ctx context.Context,config socialProviderConfig,accessToken string)(identity.SocialProfile,error){
	openValues:=url.Values{}; openValues.Set("access_token",accessToken); openValues.Set("fmt","json")
	var open struct{ClientID string `json:"client_id"`; OpenID string `json:"openid"`; Error int `json:"error"`; ErrorDescription string `json:"error_description"`}
	if err:=qqGetJSON(ctx,qqOAuthOpenIDURL+"?"+openValues.Encode(),&open);err!=nil{return identity.SocialProfile{},err}
	open.OpenID=strings.TrimSpace(open.OpenID); if open.Error!=0||open.OpenID==""{return identity.SocialProfile{},errors.New("qq openid is missing")}
	infoValues:=url.Values{}; infoValues.Set("access_token",accessToken); infoValues.Set("oauth_consumer_key",config.ClientID); infoValues.Set("openid",open.OpenID); infoValues.Set("fmt","json")
	var info struct{Ret int `json:"ret"`; Msg string `json:"msg"`; Nickname string `json:"nickname"`; FigureQQ2 string `json:"figureurl_qq_2"`; Figure2 string `json:"figureurl_2"`}
	if err:=qqGetJSON(ctx,qqUserInfoURL+"?"+infoValues.Encode(),&info);err!=nil{return identity.SocialProfile{},err}
	if info.Ret!=0{return identity.SocialProfile{},fmt.Errorf("qq userinfo returned ret=%d",info.Ret)}
	avatar:=strings.TrimSpace(info.FigureQQ2); if avatar==""{avatar=strings.TrimSpace(info.Figure2)}
	subject:=strings.TrimSpace(config.ClientID)+":"+open.OpenID; if len(subject)>255{return identity.SocialProfile{},errors.New("qq subject is too long")}
	return identity.SocialProfile{Provider:"qq",Subject:subject,DisplayName:strings.TrimSpace(info.Nickname),AvatarURL:avatar},nil
}

func qqGetJSON(ctx context.Context,endpoint string,out any)error{
	req,err:=http.NewRequestWithContext(ctx,http.MethodGet,endpoint,nil); if err!=nil{return err}; req.Header.Set("Accept","application/json"); req.Header.Set("User-Agent","GoJet")
	resp,err:=socialOAuthHTTPClient.Do(req); if err!=nil{return err}; defer resp.Body.Close(); if resp.StatusCode<200||resp.StatusCode>=300{return fmt.Errorf("qq api returned %d",resp.StatusCode)}
	return json.NewDecoder(io.LimitReader(resp.Body,1<<20)).Decode(out)
}
