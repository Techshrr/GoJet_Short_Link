package identity

import (
	"context"
	"golang.org/x/crypto/bcrypt"
	"testing"
)

func TestPasswordCost(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("long-password"), 12)
	if err != nil {
		t.Fatal(err)
	}
	cost, _ := bcrypt.Cost(hash)
	if cost != 12 {
		t.Fatalf("cost=%d", cost)
	}
}

func TestPasswordResetRejectsWeakPasswordBeforeDatabaseAccess(t *testing.T) {
	service := &Service{}
	if err := service.ResetPassword(context.Background(), "token", "short"); err == nil {
		t.Fatal("weak reset password accepted")
	}
}
func TestSessionTokensAreHashed(t *testing.T) {
	token, hash, err := newToken()
	if err != nil {
		t.Fatal(err)
	}
	if token == hash || len(token) != 64 || len(hash) != 64 {
		t.Fatal("invalid token material")
	}
}
