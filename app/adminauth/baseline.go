package adminauth

import "sort"

const BaselinePermission = "platform.read"

// WithBaselinePermissions returns the effective administrator identity used by
// the admin shell. Every active administrator needs the read-only shell
// baseline, while all management permissions remain explicitly granted.
func WithBaselinePermissions(a Administrator) Administrator {
	if a.Role == "super_admin" {
		a.Permissions = []string{"*"}
		return a
	}
	seen := make(map[string]bool, len(a.Permissions)+1)
	items := make([]string, 0, len(a.Permissions)+1)
	for _, permission := range a.Permissions {
		if permission == "" || seen[permission] {
			continue
		}
		seen[permission] = true
		items = append(items, permission)
	}
	if !seen[BaselinePermission] {
		items = append(items, BaselinePermission)
	}
	sort.Strings(items)
	a.Permissions = items
	return a
}

// EffectiveTemplatePermissions exposes the same baseline in the administrator
// editor so the UI, login response and authorization middleware agree.
func EffectiveTemplatePermissions(role string) []string {
	if role == "super_admin" {
		return []string{"*"}
	}
	return WithBaselinePermissions(Administrator{Role: role, Permissions: TemplatePermissions(role)}).Permissions
}
