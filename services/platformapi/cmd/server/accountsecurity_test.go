package main

import (
    "net/http"
    "net/http/httptest"
    "testing"
    "time"
)

func TestP15TOTPVerificationWindow(t *testing.T){secret:="JBSWY3DPEHPK3PXP";now:=time.Unix(1776502800,0).UTC();code,err:=totpCode(secret,now);if err!=nil{t.Fatal(err)};if !verifyTOTP(secret,code,now){t.Fatal("expected current TOTP to verify")};if verifyTOTP(secret,"000000",now)&&code!="000000"{t.Fatal("unexpected code accepted")}}
func TestP15SessionTokenPrefersBearerThenCookie(t *testing.T){r:=httptest.NewRequest("GET","/api/me",nil);r.AddCookie(&http.Cookie{Name:userSessionCookie,Value:"cookie-token"});r.Header.Set("Authorization","Bearer bearer-token");token,fromCookie:=sessionToken(r);if token!="bearer-token"||fromCookie{t.Fatalf("unexpected bearer selection: %q %v",token,fromCookie)}}
