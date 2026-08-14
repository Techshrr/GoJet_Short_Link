package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestQQCodeAndProfileExchange(t *testing.T){
	mux:=http.NewServeMux()
	mux.HandleFunc("/token",func(w http.ResponseWriter,r *http.Request){q:=r.URL.Query();if r.Method!=http.MethodGet||q.Get("grant_type")!="authorization_code"||q.Get("client_id")!="qq-client"||q.Get("client_secret")!="qq-secret"||q.Get("code")!="qq-code"||q.Get("redirect_uri")!="https://gojet.test/callback"||q.Get("fmt")!="json"{t.Fatalf("unexpected QQ token request: %s %v",r.Method,q)};_ = json.NewEncoder(w).Encode(map[string]any{"access_token":"qq-token","expires_in":7776000})})
	mux.HandleFunc("/me",func(w http.ResponseWriter,r *http.Request){q:=r.URL.Query();if q.Get("access_token")!="qq-token"||q.Get("fmt")!="json"{t.Fatalf("unexpected QQ openid request: %v",q)};_ = json.NewEncoder(w).Encode(map[string]any{"client_id":"qq-client","openid":"OPENID-123"})})
	mux.HandleFunc("/userinfo",func(w http.ResponseWriter,r *http.Request){q:=r.URL.Query();if q.Get("access_token")!="qq-token"||q.Get("oauth_consumer_key")!="qq-client"||q.Get("openid")!="OPENID-123"||q.Get("fmt")!="json"{t.Fatalf("unexpected QQ userinfo request: %v",q)};_ = json.NewEncoder(w).Encode(map[string]any{"ret":0,"nickname":"QQ User","figureurl_qq_2":"https://img.test/avatar.png"})})
	ts:=httptest.NewServer(mux);defer ts.Close()
	oldToken,oldOpenID,oldInfo,oldClient:=qqOAuthTokenURL,qqOAuthOpenIDURL,qqUserInfoURL,socialOAuthHTTPClient
	qqOAuthTokenURL=ts.URL+"/token";qqOAuthOpenIDURL=ts.URL+"/me";qqUserInfoURL=ts.URL+"/userinfo";socialOAuthHTTPClient=ts.Client()
	defer func(){qqOAuthTokenURL=oldToken;qqOAuthOpenIDURL=oldOpenID;qqUserInfoURL=oldInfo;socialOAuthHTTPClient=oldClient}()
	config:=socialProviderConfig{ClientID:"qq-client",ClientSecret:"qq-secret"}
	token,err:=exchangeQQCode(t.Context(),config,"qq-code","https://gojet.test/callback");if err!=nil||token!="qq-token"{t.Fatalf("token=%q err=%v",token,err)}
	profile,err:=fetchQQSocialProfile(t.Context(),config,token);if err!=nil{t.Fatal(err)}
	if profile.Provider!="qq"||profile.Subject!="qq-client:OPENID-123"||profile.DisplayName!="QQ User"||profile.Email!=""||profile.EmailVerified{t.Fatalf("unexpected profile: %#v",profile)}
}

func TestQQAuthorizationRedirectUsesStateWithoutPretendingPKCE(t *testing.T){
	raw:=qqAuthorizationRedirect(socialProviderConfig{ClientID:"client"},"state-value","https://gojet.test/callback")
	u,err:=url.Parse(raw);if err!=nil{t.Fatal(err)}
	if u.Scheme!="https"||u.Host!="graph.qq.com"||u.Path!="/oauth2.0/authorize"{t.Fatalf("unexpected authorize url %s",raw)}
	q:=u.Query();if q.Get("response_type")!="code"||q.Get("state")!="state-value"||q.Get("scope")!="get_user_info"{t.Fatalf("unexpected query %v",q)}
	if strings.TrimSpace(q.Get("code_challenge"))!=""{t.Fatal("QQ adapter must not claim provider PKCE support")}
}
