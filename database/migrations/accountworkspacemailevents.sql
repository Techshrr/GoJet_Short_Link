-- User/account mutations and their audit trail belong to the Go application
-- trust boundary. Do not install a MySQL trigger here: CREATE TRIGGER requires
-- SUPER (or log_bin_trust_function_creators=1) on common MySQL 8 deployments
-- with binary logging enabled, which breaks fresh installs that correctly use a
-- least-privilege application database user. If an email-change flow is added
-- or changed, the Go handler/service must write the audit row in the same
-- authoritative application transaction instead of relying on a DB trigger.

UPDATE mail_templates
SET html_template='<h1>工作区权限已更新</h1><p>您在“{{workspace_name}}”中的角色已调整为“{{new_role}}”。</p><p class="muted">操作人：{{actor}}</p>'
WHERE template_key='workspace_role_changed';
