package main

import (
	"net/http"
	"strings"
)

func (s *server) registerEmailCodeRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/public/account-policy", s.authPolicy)
	mux.HandleFunc("GET /api/public/auth/providers", noStoreHandler(s.publicSocialProviders))
	mux.HandleFunc("GET /api/public/auth/google/start", noStoreHandler(sanitizeSocialRedirect(s.googleAuthStart)))
	mux.HandleFunc("GET /api/public/auth/google/callback", noStoreHandler(s.socialCallbackRouter("google", s.googleAuthCallback)))
	mux.HandleFunc("GET /api/public/auth/facebook/start", noStoreHandler(sanitizeSocialRedirect(s.facebookAuthStart)))
	mux.HandleFunc("GET /api/public/auth/facebook/callback", noStoreHandler(s.socialCallbackRouter("facebook", s.facebookAuthCallback)))
	mux.HandleFunc("GET /api/public/auth/github/start", noStoreHandler(sanitizeSocialRedirect(s.githubAuthStart)))
	mux.HandleFunc("GET /api/public/auth/github/callback", noStoreHandler(s.socialCallbackRouter("github", s.githubAuthCallback)))
	mux.HandleFunc("GET /api/public/auth/qq/start", noStoreHandler(sanitizeSocialRedirect(s.qqAuthStart)))
	mux.HandleFunc("GET /api/public/auth/qq/callback", noStoreHandler(s.socialCallbackRouter("qq", s.qqAuthCallback)))
	mux.HandleFunc("GET /api/public/auth/wechat/start", noStoreHandler(sanitizeSocialRedirect(s.wechatAuthStart)))
	mux.HandleFunc("GET /api/public/auth/wechat/callback", noStoreHandler(s.socialCallbackRouter("wechat", s.wechatAuthCallback)))
	mux.HandleFunc("GET /api/public/auth/rainbow/start", noStoreHandler(sanitizeSocialRedirect(s.rainbowAuthStart)))
	mux.HandleFunc("GET /api/public/auth/rainbow/callback", noStoreHandler(s.rainbowCallbackPolicy(s.socialCallbackRouter("rainbow", s.rainbowAuthCallback))))
	mux.HandleFunc("GET /api/public/auth/rainbow/bind-launch", noStoreHandler(s.rainbowBindLaunch))
	mux.HandleFunc("POST /api/public/auth/handoff", noStoreHandler(s.socialAuthHandoff))
	mux.HandleFunc("GET /api/admin/auth/providers", noStoreHandler(s.admin("settings.manage", s.adminSocialProviders)))
	mux.HandleFunc("GET /api/me/social-identities", noStoreHandler(s.user(s.mySocialIdentities)))
	mux.HandleFunc("POST /api/me/social/{provider}/bind/start", noStoreHandler(s.user(s.socialBindStart)))
	mux.HandleFunc("DELETE /api/me/social/{provider}", noStoreHandler(s.user(s.socialUnbind)))
	mux.HandleFunc("POST /api/public/email-code", s.requestAuthCode)
	mux.HandleFunc("POST /api/public/register-email-code", s.registerByCode)
	mux.HandleFunc("POST /api/public/login-email-code", s.loginByCode)
}

func (s *server) githubAuthStart(w http.ResponseWriter, r *http.Request) {
	r.SetPathValue("provider", "github")
	s.socialAuthStart(w, r)
}

func (s *server) githubAuthCallback(w http.ResponseWriter, r *http.Request) {
	r.SetPathValue("provider", "github")
	s.socialAuthCallback(w, r)
}

func noStoreHandler(next http.HandlerFunc)http.HandlerFunc{return func(w http.ResponseWriter,r *http.Request){w.Header().Set("Cache-Control","no-store");w.Header().Set("Pragma","no-cache");next(w,r)}}
func sanitizeSocialRedirect(next http.HandlerFunc)http.HandlerFunc{return func(w http.ResponseWriter,r *http.Request){target:=r.URL.Query().Get("redirect");if target==""||!unsafeAuthRedirect(target){next(w,r);return};clone:=r.Clone(r.Context());clonedURL:=*r.URL;query:=clonedURL.Query();query.Del("redirect");clonedURL.RawQuery=query.Encode();clone.URL=&clonedURL;next(w,clone)}}
func unsafeAuthRedirect(target string)bool{if strings.Contains(target,`\`){return true};return strings.IndexFunc(target,func(r rune)bool{return r<0x20||r==0x7f})>=0}
