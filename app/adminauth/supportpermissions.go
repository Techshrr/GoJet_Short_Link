package adminauth

func init() {
	permissionCatalog["tickets.manage"] = true
	for _, role := range []string{"operator", "support"} {
		items := roleTemplates[role]
		found := false
		for _, permission := range items {
			if permission == "tickets.manage" {
				found = true
				break
			}
		}
		if !found {
			roleTemplates[role] = append(items, "tickets.manage")
		}
	}
}
