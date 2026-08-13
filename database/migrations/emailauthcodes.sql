CREATE TABLE email_auth_codes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    purpose ENUM('register','login') NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    requested_ip VARCHAR(64) NULL,
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY email_auth_codes_lookup_idx(email,purpose,created_at),
    KEY email_auth_codes_expiry_idx(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO mail_templates(template_key,name,subject_template,html_template,status) VALUES
('auth_email_code','邮箱验证码','{{site_name}} 验证码：{{code}}','<h1>{{action}}</h1><p>你的验证码是：</p><p><strong>{{code}}</strong></p><p>验证码在 {{expires_minutes}} 分钟内有效，请勿转发给其他人。</p><p class="muted">如果这不是你的操作，可以忽略此邮件。</p>','active')
ON DUPLICATE KEY UPDATE name=VALUES(name),subject_template=VALUES(subject_template),html_template=VALUES(html_template),status=VALUES(status);
