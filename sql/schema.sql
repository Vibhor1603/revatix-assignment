-- ISP Operations schema: connections, tickets, tasks, shifts, audit

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('manager', 'support', 'technician') NOT NULL,
  employee_code VARCHAR(64) NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_deleted (role, deleted_at)
);

CREATE TABLE IF NOT EXISTS service_plans (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  bandwidth_mbps INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_plans_deleted (deleted_at)
);

CREATE TABLE IF NOT EXISTS pops (
  id CHAR(36) PRIMARY KEY,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  location VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pops_code (code),
  KEY idx_pops_deleted (deleted_at)
);

CREATE TABLE IF NOT EXISTS sectors (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  geo_description VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_sectors_deleted (deleted_at)
);

CREATE TABLE IF NOT EXISTS connections (
  id CHAR(36) PRIMARY KEY,
  customer_name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(190) NULL,
  address VARCHAR(255) NULL,
  plan_id CHAR(36) NOT NULL,
  pop_id CHAR(36) NOT NULL,
  sector_id CHAR(36) NOT NULL,
  static_ip VARCHAR(64) NULL,
  status ENUM('Pending', 'Active', 'Suspended', 'Terminated') NOT NULL DEFAULT 'Pending',
  status_rank TINYINT NOT NULL DEFAULT 1,
  created_by CHAR(36) NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_connections_plan FOREIGN KEY (plan_id) REFERENCES service_plans (id),
  CONSTRAINT fk_connections_pop FOREIGN KEY (pop_id) REFERENCES pops (id),
  CONSTRAINT fk_connections_sector FOREIGN KEY (sector_id) REFERENCES sectors (id),
  CONSTRAINT fk_connections_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  KEY idx_connections_status (status),
  KEY idx_connections_plan (plan_id),
  KEY idx_connections_pop (pop_id),
  KEY idx_connections_sector (sector_id),
  KEY idx_connections_deleted (deleted_at)
);

CREATE TABLE IF NOT EXISTS tickets (
  id CHAR(36) PRIMARY KEY,
  connection_id CHAR(36) NOT NULL,
  created_by CHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  complaint_type VARCHAR(64) NOT NULL DEFAULT 'other',
  priority ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
  sla_due_at DATETIME NOT NULL,
  status ENUM('Open', 'In-Progress', 'Field Visit', 'Resolved', 'Closed') NOT NULL DEFAULT 'Open',
  status_rank TINYINT NOT NULL DEFAULT 1,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tickets_connection FOREIGN KEY (connection_id) REFERENCES connections (id),
  CONSTRAINT fk_tickets_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  KEY idx_tickets_connection (connection_id),
  KEY idx_tickets_status (status),
  KEY idx_tickets_deleted (deleted_at)
);

CREATE TABLE IF NOT EXISTS field_tasks (
  id CHAR(36) PRIMARY KEY,
  ticket_id CHAR(36) NOT NULL,
  task_type VARCHAR(120) NOT NULL,
  description TEXT NULL,
  technician_id CHAR(36) NULL,
  scheduled_start DATETIME NULL,
  scheduled_end DATETIME NULL,
  status ENUM('Open', 'In-Progress', 'Field Visit', 'Resolved', 'Closed', 'Cancelled') NOT NULL DEFAULT 'Open',
  status_rank TINYINT NOT NULL DEFAULT 1,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tasks_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id),
  CONSTRAINT fk_tasks_technician FOREIGN KEY (technician_id) REFERENCES users (id),
  KEY idx_tasks_ticket (ticket_id),
  KEY idx_tasks_tech_schedule (technician_id, scheduled_start, scheduled_end),
  KEY idx_tasks_status (status),
  KEY idx_tasks_deleted (deleted_at)
);

CREATE TABLE IF NOT EXISTS shifts (
  id CHAR(36) PRIMARY KEY,
  technician_id CHAR(36) NOT NULL,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shifts_technician FOREIGN KEY (technician_id) REFERENCES users (id),
  KEY idx_shifts_tech_date (technician_id, shift_date),
  KEY idx_shifts_deleted (deleted_at)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) PRIMARY KEY,
  actor_user_id CHAR(36) NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id CHAR(36) NOT NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users (id),
  KEY idx_audit_entity (entity_type, entity_id, created_at),
  KEY idx_audit_action (action),
  KEY idx_audit_actor (actor_user_id),
  KEY idx_audit_created (created_at)
);

-- Progressive login lockout keyed by IP + device fingerprint
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

-- Opaque refresh tokens (store hash only)
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

-- Public registration requests (manager or technician) awaiting manager approval
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
