package organization

import "testing"

func TestValidNameTrimsAndRejectsEmpty(t *testing.T) {
	value, err := validName("  夏季活动  ", 120)
	if err != nil || value != "夏季活动" {
		t.Fatalf("value=%q err=%v", value, err)
	}
	if _, err = validName("   ", 120); err == nil {
		t.Fatal("empty name must be rejected")
	}
}

func TestItoa(t *testing.T) {
	if value := itoa(90210); value != "90210" {
		t.Fatalf("unexpected value %q", value)
	}
}
