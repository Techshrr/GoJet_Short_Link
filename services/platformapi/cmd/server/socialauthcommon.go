package main

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/Techshrr/GoJet_Short_Link/app/identity"
)

func (s *server) completeSocialLogin(ctx context.Context,w http.ResponseWriter,r *http.Request,user identity.User,provider,returnTo string) error {
	handoff,err:=randomURLToken(32); if err!=nil{return err}
	payload,_:=json.Marshal(socialHandoffPayload{UserID:user.ID,Provider:provider,ReturnTo:safeSocialReturn(returnTo)})
	if err=s.redis.Set(ctx,socialHandoffKey(handoff),string(payload),socialHandoffTTL).Err();err!=nil{return err}
	http.Redirect(w,r,"/login#social_handoff="+handoff,http.StatusFound)
	return nil
}
