package workspace

import "testing"

func TestRolePermissions(t *testing.T) {
	cases := []struct {
		role, permission string
		want             bool
	}{{"owner", "manage", true}, {"admin", "manage", true}, {"editor", "manage", false}, {"editor", "edit", true}, {"analyst", "analytics", true}, {"analyst", "edit", false}, {"viewer", "view", true}, {"viewer", "analytics", false}}
	for _, c := range cases {
		if got := Allowed(c.role, c.permission); got != c.want {
			t.Errorf("%s/%s=%v", c.role, c.permission, got)
		}
	}
}
