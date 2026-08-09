CREATE TABLE mail_templates(
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    template_key VARCHAR(80) NOT NULL,
    name VARCHAR(120) NOT NULL,
    subject_template VARCHAR(255) NOT NULL,
    html_template MEDIUMTEXT NOT NULL,
    status ENUM('active','disabled') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY mail_templates_key_unique(template_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO mail_templates(template_key,name,subject_template,html_template) VALUES
('verification','邮箱验证','验证您的 {{site_name}} 邮箱','<h1>验证邮箱</h1><p>请使用以下令牌完成邮箱验证：</p><p><strong>{{token}}</strong></p>'),
('workspace_invitation','工作区邀请','邀请您加入 {{site_name}} 工作区','<h1>工作区邀请</h1><p>{{inviter}} 邀请您加入工作区。</p><p>邀请令牌：<strong>{{token}}</strong></p>'),
('password_reset','密码重置','重置 {{site_name}} 登录密码','<h1>重置密码</h1><p>管理员要求重置您的登录密码。此链接 30 分钟内有效：</p><p><a href="{{reset_url}}">重置密码</a></p>');
