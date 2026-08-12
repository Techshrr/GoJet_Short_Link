CREATE TABLE support_departments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(80) NOT NULL,
    description VARCHAR(255) NULL,
    notification_email VARCHAR(320) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY support_departments_slug_unique(slug),
    KEY support_departments_active_sort_idx(is_active,sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE support_tickets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ticket_number VARCHAR(32) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    workspace_id BIGINT UNSIGNED NULL,
    department_id BIGINT UNSIGNED NOT NULL,
    subject VARCHAR(220) NOT NULL,
    priority ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
    status ENUM('open','customer_reply','staff_reply','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
    last_reply_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_reply_by ENUM('customer','staff') NOT NULL DEFAULT 'customer',
    closed_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY support_tickets_number_unique(ticket_number),
    KEY support_tickets_user_status_idx(user_id,status,last_reply_at),
    KEY support_tickets_queue_idx(department_id,status,priority,last_reply_at),
    KEY support_tickets_workspace_idx(workspace_id,created_at),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
    FOREIGN KEY(department_id) REFERENCES support_departments(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE support_ticket_messages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ticket_id BIGINT UNSIGNED NOT NULL,
    author_type ENUM('customer','administrator') NOT NULL,
    author_user_id BIGINT UNSIGNED NULL,
    author_administrator_id BIGINT UNSIGNED NULL,
    body MEDIUMTEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY support_ticket_messages_ticket_idx(ticket_id,created_at),
    FOREIGN KEY(ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY(author_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(author_administrator_id) REFERENCES administrators(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE support_ticket_attachments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ticket_id BIGINT UNSIGNED NOT NULL,
    message_id BIGINT UNSIGNED NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(160) NOT NULL,
    size_bytes BIGINT UNSIGNED NOT NULL,
    scan_status ENUM('pending','clean','infected','failed') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY support_ticket_attachments_ticket_idx(ticket_id,created_at),
    FOREIGN KEY(ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY(message_id) REFERENCES support_ticket_messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO support_departments(name,slug,description,sort_order) VALUES
('技术支持','technical','网站功能、短链接、域名、API 与文件服务问题',10),
('账户与账单','billing','账户、套餐、账单与支付相关问题',20),
('安全与滥用','security','安全事件、滥用、恶意链接与隐私相关问题',30);

INSERT INTO mail_templates(template_key,name,subject_template,html_template) VALUES
('support_ticket_created','工单已创建','[{{site_name}} #{{ticket_number}}] 我们已收到您的工单','<h1>工单已创建</h1><p>您的工单 <strong>#{{ticket_number}}</strong> 已提交成功。</p><p>主题：{{subject}}</p><p>我们的支持团队回复后会通过邮件通知您。</p>'),
('support_ticket_reply','工单有新回复','[{{site_name}} #{{ticket_number}}] 工单有新回复','<h1>工单有新回复</h1><p>您的工单 <strong>#{{ticket_number}}</strong> 收到新的支持回复。</p><p>主题：{{subject}}</p><p>请登录 {{site_name}} 控制台查看完整回复。</p>')
ON DUPLICATE KEY UPDATE name=VALUES(name),subject_template=VALUES(subject_template),html_template=VALUES(html_template);

INSERT INTO system_settings(setting_key,setting_value,is_encrypted) VALUES
('turnstile.enabled','false',FALSE),
('turnstile.fail_open','false',FALSE),
('turnstile.allowed_hostnames','[]',FALSE),
('turnstile.registration','true',FALSE),
('turnstile.login','true',FALSE),
('turnstile.forgot_password','true',FALSE),
('turnstile.reset_password','true',FALSE),
('turnstile.ticket_create','true',FALSE),
('turnstile.ticket_reply','true',FALSE),
('turnstile.abuse_report','true',FALSE)
ON DUPLICATE KEY UPDATE setting_value=setting_value;
