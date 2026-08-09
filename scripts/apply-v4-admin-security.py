#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'services/platform-api/cmd/server/admin_identity.go'; text=p.read_text()

# Revoke sessions is a privileged administrator-management mutation.
needle='''func (s *server) adminRevokeSessions(w http.ResponseWriter, r *http.Request) {\n\tid, err := strconv.ParseInt(r.PathValue("id"), 10, 64)'''
replace='''func (s *server) adminRevokeSessions(w http.ResponseWriter, r *http.Request) {\n\tif currentAdmin(r).Role != "super_admin" {\n\t\tjsonResponse(w, http.StatusForbidden, map[string]string{"error": "只有超级管理员可以强制退出其他管理员"})\n\t\treturn\n\t}\n\tid, err := strconv.ParseInt(r.PathValue("id"), 10, 64)'''
if needle in text: text=text.replace(needle,replace,1)
elif '只有超级管理员可以强制退出其他管理员' not in text: raise SystemExit('revoke-session handler pattern missing')

old='''\tactor := currentAdmin(r)\n\tif input.Role == "super_admin" && actor.Role != "super_admin" {\n\t\tjsonResponse(w, http.StatusForbidden, map[string]string{"error": "只有超级管理员可以创建新的超级管理员"})\n\t\treturn\n\t}\n\tid, err := s.adminAuth.Create'''
new='''\tactor := currentAdmin(r)\n\tif actor.Role != "super_admin" {\n\t\tjsonResponse(w, http.StatusForbidden, map[string]string{"error": "只有超级管理员可以创建管理员账户"})\n\t\treturn\n\t}\n\tid, err := s.adminAuth.Create'''
if old in text: text=text.replace(old,new,1)
elif '只有超级管理员可以创建管理员账户' not in text: raise SystemExit('create-admin handler pattern missing')

old='''\tactor := currentAdmin(r)\n\tif input.Role == "super_admin" && actor.Role != "super_admin" {\n\t\tjsonResponse(w, http.StatusForbidden, map[string]string{"error": "只有超级管理员可以授予超级管理员权限"})\n\t\treturn\n\t}\n\tif err = s.adminAuth.Update'''
new='''\tactor := currentAdmin(r)\n\tif actor.Role != "super_admin" {\n\t\tjsonResponse(w, http.StatusForbidden, map[string]string{"error": "只有超级管理员可以修改管理员权限或状态"})\n\t\treturn\n\t}\n\tif err = s.adminAuth.Update'''
if old in text: text=text.replace(old,new,1)
elif '只有超级管理员可以修改管理员权限或状态' not in text: raise SystemExit('update-admin handler pattern missing')
p.write_text(text)
print('super-admin mutation boundary enforced')
