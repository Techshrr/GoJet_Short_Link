package adminauth

import (
	"reflect"
	"testing"
)

func TestCustomAdministratorReceivesOnlyShellBaselineAutomatically(t *testing.T) {
	a := WithBaselinePermissions(Administrator{Role: "custom", Permissions: []string{"admins.manage"}})
	want := []string{"admins.manage", "platform.read"}
	if !reflect.DeepEqual(a.Permissions, want) {
		t.Fatalf("effective permissions = %#v, want %#v", a.Permissions, want)
	}
	for _, forbidden := range []string{"users.manage", "settings.manage", "billing.manage", "operations.manage"} {
		if AllowedAdministrator(a, forbidden) {
			t.Fatalf("baseline policy granted forbidden permission %q", forbidden)
		}
	}
}

func TestAdministratorBaselineIsIdempotent(t *testing.T) {
	a := Administrator{Role: "custom", Permissions: []string{"platform.read", "admins.manage", "platform.read"}}
	a = WithBaselinePermissions(WithBaselinePermissions(a))
	want := []string{"admins.manage", "platform.read"}
	if !reflect.DeepEqual(a.Permissions, want) {
		t.Fatalf("idempotent effective permissions = %#v, want %#v", a.Permissions, want)
	}
}

func TestEffectiveCustomTemplateContainsOnlyBaseline(t *testing.T) {
	got := EffectiveTemplatePermissions("custom")
	want := []string{"platform.read"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("custom template = %#v, want %#v", got, want)
	}
}
