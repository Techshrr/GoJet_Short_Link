-- Registration-launched OAuth/QR flows must stop before account creation so
-- GoJet can collect a display name, verify an email code, set a password, and
-- atomically bind the already verified third-party identity.
ALTER TABLE social_auth_attempts
    MODIFY mode ENUM('login','bind','register') NOT NULL DEFAULT 'login';
