package integration

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/identity"
	_ "github.com/go-sql-driver/mysql"
)

func TestSocialIdentityBindingLifecycle(t *testing.T) {
	dsn := os.Getenv("GOJET_IDENTITY_BINDING_DSN")
	if dsn == "" {
		t.Skip("GOJET_IDENTITY_BINDING_DSN is not set")
	}
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ctx := context.Background()
	if err = db.PingContext(ctx); err != nil {
		t.Fatal(err)
	}
	service := identity.New(db)
	stamp := time.Now().UnixNano()

	passwordEmail := fmt.Sprintf("bind-password-%d@example.test", stamp)
	passwordUser, _, err := service.Register(ctx, passwordEmail, "PasswordCredential!2026", "Password Binding")
	if err != nil {
		t.Fatal(err)
	}
	github := identity.SocialProfile{Provider: "github", Subject: fmt.Sprintf("github-%d", stamp), Email: "provider@example.test", EmailVerified: true, DisplayName: "GitHub Binding"}
	if err = service.BindSocialIdentity(ctx, passwordUser.ID, github); err != nil {
		t.Fatalf("bind GitHub: %v", err)
	}
	if linked, err := service.SocialProviderLinked(ctx, passwordUser.ID, "github"); err != nil || !linked {
		t.Fatalf("expected GitHub linked, linked=%v err=%v", linked, err)
	}
	identities, err := service.ListSocialIdentities(ctx, passwordUser.ID)
	if err != nil || len(identities) != 1 || identities[0].Provider != "github" {
		t.Fatalf("unexpected identity list: %#v err=%v", identities, err)
	}

	otherEmail := fmt.Sprintf("bind-other-%d@example.test", stamp)
	otherUser, _, err := service.Register(ctx, otherEmail, "OtherCredential!2026", "Other Binding")
	if err != nil {
		t.Fatal(err)
	}
	if err = service.BindSocialIdentity(ctx, otherUser.ID, github); !errors.Is(err, identity.ErrSocialIdentityInUse) {
		t.Fatalf("expected identity ownership collision, got %v", err)
	}
	otherGitHub := github
	otherGitHub.Subject = fmt.Sprintf("github-other-%d", stamp)
	if err = service.BindSocialIdentity(ctx, passwordUser.ID, otherGitHub); !errors.Is(err, identity.ErrSocialProviderAlreadyLinked) {
		t.Fatalf("expected provider already linked, got %v", err)
	}
	if err = service.UnbindSocialIdentity(ctx, passwordUser.ID, "github"); err != nil {
		t.Fatalf("password account should unbind sole social identity: %v", err)
	}

	socialEmail := fmt.Sprintf("bind-social-%d@example.test", stamp)
	socialProfile := identity.SocialProfile{Provider: "github", Subject: fmt.Sprintf("social-only-%d", stamp), Email: socialEmail, EmailVerified: true, DisplayName: "Social Only"}
	socialUser, created, err := service.ResolveOrRegisterSocial(ctx, socialProfile, true, true)
	if err != nil || !created {
		t.Fatalf("create social-only user: created=%v err=%v", created, err)
	}
	passwordEnabled, err := service.PasswordLoginEnabled(ctx, socialUser.ID)
	if err != nil || passwordEnabled {
		t.Fatalf("social-only account unexpectedly has password credential: enabled=%v err=%v", passwordEnabled, err)
	}
	if err = service.UnbindSocialIdentity(ctx, socialUser.ID, "github"); !errors.Is(err, identity.ErrLastLoginCredential) {
		t.Fatalf("expected last credential protection, got %v", err)
	}
	google := identity.SocialProfile{Provider: "google", Subject: fmt.Sprintf("google-%d", stamp), Email: socialEmail, EmailVerified: true, DisplayName: "Google Binding"}
	if err = service.BindSocialIdentity(ctx, socialUser.ID, google); err != nil {
		t.Fatalf("bind second provider: %v", err)
	}
	if err = service.UnbindSocialIdentity(ctx, socialUser.ID, "github"); err != nil {
		t.Fatalf("second social identity should permit unbind: %v", err)
	}
	if err = service.UnbindSocialIdentity(ctx, socialUser.ID, "google"); !errors.Is(err, identity.ErrLastLoginCredential) {
		t.Fatalf("last social identity should still be protected: %v", err)
	}
	resetToken, err := service.CreatePasswordReset(ctx, socialUser.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err = service.ResetPassword(ctx, resetToken, "RecoveredPassword!2026"); err != nil {
		t.Fatal(err)
	}
	passwordEnabled, err = service.PasswordLoginEnabled(ctx, socialUser.ID)
	if err != nil || !passwordEnabled {
		t.Fatalf("password reset did not enable password credential: enabled=%v err=%v", passwordEnabled, err)
	}
	if err = service.UnbindSocialIdentity(ctx, socialUser.ID, "google"); err != nil {
		t.Fatalf("password recovery should permit final social unbind: %v", err)
	}
}
