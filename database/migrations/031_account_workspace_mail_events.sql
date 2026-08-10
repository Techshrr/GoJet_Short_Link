DROP TRIGGER IF EXISTS user_email_change_audit;
DELIMITER $$
CREATE TRIGGER user_email_change_audit
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    IF OLD.email <> NEW.email AND NEW.status <> 'deleted' THEN
        INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,metadata)
        VALUES(NULL,'user.email_changed','user',NEW.id,JSON_OBJECT('old_email',OLD.email,'new_email',NEW.email));
    END IF;
END$$
DELIMITER ;

UPDATE mail_templates
SET html_template='<h1>工作区权限已更新</h1><p>您在“{{workspace_name}}”中的角色已调整为“{{new_role}}”。</p><p class="muted">操作人：{{actor}}</p>'
WHERE template_key='workspace_role_changed';
