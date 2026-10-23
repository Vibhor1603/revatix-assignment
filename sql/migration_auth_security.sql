-- Additive auth/security tables for existing deployments

CREATE TABLE IF NOT EXISTS login_locks (
  id CHAR(36) PRIMARY KEY,
  ip_address VARCHAR(64) NOT NULL,
  device_fingerprint VARCHAR(128) NOT NULL,
  email VARCHAR(190) NULL,
  fail_count INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_login_lock_ip_device (ip_address, device_fingerprint),
  KEY idx_login_locks_locked (locked_until)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  device_fingerprint VARCHAR(128) NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_refresh_token_hash (token_hash),
  KEY idx_refresh_user (user_id),
  KEY idx_refresh_expires (expires_at),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS registration_requests (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('manager', 'technician') NOT NULL,
  employee_code VARCHAR(64) NULL,
  phone VARCHAR(40) NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewed_by CHAR(36) NULL,
  review_note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_reg_status (status),
  KEY idx_reg_email (email),
  CONSTRAINT fk_reg_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users (id)
);
