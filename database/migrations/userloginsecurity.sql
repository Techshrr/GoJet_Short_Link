CREATE TABLE user_login_attempts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    outcome ENUM('success','failure') NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY user_login_attempts_ip_created_idx(ip_address,created_at),
    KEY user_login_attempts_email_created_idx(email,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
