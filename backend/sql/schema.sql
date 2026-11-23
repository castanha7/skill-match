CREATE DATABASE IF NOT EXISTS skillmatch CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE skillmatch;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('candidate','company','admin') NOT NULL,
  status ENUM('active','blocked') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS candidate_profiles (
  user_id CHAR(36) PRIMARY KEY,
  city VARCHAR(120) NULL,
  state CHAR(2) NULL,
  education VARCHAR(160) NULL,
  interests JSON NULL,
  skills JSON NULL,
  courses JSON NULL,
  experience JSON NULL,
  availability VARCHAR(120) NULL,
  visibility BOOLEAN NOT NULL DEFAULT FALSE,
  visibility_consented_at DATETIME NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_candidate_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS companies (
  id CHAR(36) PRIMARY KEY,
  owner_user_id CHAR(36) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  cnpj VARCHAR(14) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  sector VARCHAR(120) NULL,
  description TEXT NULL,
  city VARCHAR(120) NULL,
  state CHAR(2) NULL,
  website VARCHAR(2048) NULL,
  verified_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_companies_cnpj (cnpj),
  CONSTRAINT fk_company_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS jobs (
  id CHAR(36) PRIMARY KEY,
  company_id CHAR(36) NULL,
  company_name VARCHAR(180) NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  city VARCHAR(120) NULL,
  state CHAR(2) NULL,
  education VARCHAR(180) NULL,
  employment_type VARCHAR(80) NULL,
  modality VARCHAR(40) NULL,
  requirements JSON NULL,
  source_name VARCHAR(180) NULL,
  source_url VARCHAR(2048) NULL,
  source_published_at DATETIME NULL,
  last_verified_at DATETIME NULL,
  status ENUM('confirmed','unverified','possibly_closed','closed','pending_review') NOT NULL DEFAULT 'unverified',
  dedupe_key CHAR(64) NOT NULL UNIQUE,
  external_id VARCHAR(255) NULL,
  active_until DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_job_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
  INDEX idx_public_jobs (status, active_until, created_at),
  INDEX idx_job_location (city, state),
  INDEX idx_job_source (source_url(255))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS applications (
  id CHAR(36) PRIMARY KEY,
  candidate_user_id CHAR(36) NOT NULL,
  job_id CHAR(36) NOT NULL,
  status ENUM('submitted','in_review','in_progress','finished') NOT NULL DEFAULT 'submitted',
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_candidate_job (candidate_user_id, job_id),
  CONSTRAINT fk_application_candidate FOREIGN KEY (candidate_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_application_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS candidate_favorites (
  candidate_user_id CHAR(36) NOT NULL,
  job_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (candidate_user_id, job_id),
  CONSTRAINT fk_favorite_candidate FOREIGN KEY (candidate_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_favorite_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS company_saved_talents (
  company_id CHAR(36) NOT NULL,
  candidate_user_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id, candidate_user_id),
  CONSTRAINT fk_saved_talent_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_talent_candidate FOREIGN KEY (candidate_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS connections (
  id CHAR(36) PRIMARY KEY,
  company_id CHAR(36) NOT NULL,
  candidate_user_id CHAR(36) NOT NULL,
  initiated_by ENUM('candidate','company') NOT NULL,
  status ENUM('pending','connected','declined','blocked') NOT NULL DEFAULT 'pending',
  invitation_message VARCHAR(1200) NULL,
  blocked_by_user_id CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_connection_pair (company_id, candidate_user_id),
  INDEX idx_connections_candidate (candidate_user_id, status, updated_at),
  CONSTRAINT fk_connection_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_connection_candidate FOREIGN KEY (candidate_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_connection_blocked_by FOREIGN KEY (blocked_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS connection_messages (
  id CHAR(36) PRIMARY KEY,
  connection_id CHAR(36) NOT NULL,
  sender_user_id CHAR(36) NOT NULL,
  recipient_user_id CHAR(36) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  INDEX idx_connection_messages_thread (connection_id, created_at),
  INDEX idx_connection_messages_unread (recipient_user_id, read_at),
  CONSTRAINT fk_connection_message_thread FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
  CONSTRAINT fk_connection_message_sender FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_connection_message_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(160) NOT NULL,
  body VARCHAR(500) NOT NULL,
  target_id CHAR(36) NULL,
  read_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user (user_id, read_at, created_at),
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS interview_sessions (
  id CHAR(36) PRIMARY KEY,
  candidate_user_id CHAR(36) NOT NULL,
  job_type VARCHAR(80) NOT NULL,
  experience_level VARCHAR(80) NOT NULL,
  target_role VARCHAR(120) NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  feedback JSON NOT NULL,
  provider VARCHAR(40) NOT NULL,
  ai_consent_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_interview_candidate (candidate_user_id, created_at),
  CONSTRAINT fk_interview_candidate FOREIGN KEY (candidate_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Nunca conceda acesso ao banco pela internet. Use uma conta SQL com privilégios
-- mínimos e migrações revisadas antes de disponibilizar os endpoints.
