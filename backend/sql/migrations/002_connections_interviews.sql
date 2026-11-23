-- Execute uma única vez; se o banco ainda não tiver CNPJ, execute 001_company_cnpj.sql antes.
-- A versão anterior aplicava visibilidade padrão sem opt-in; revogue-a para exigir consentimento explícito.
ALTER TABLE candidate_profiles
  MODIFY visibility BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN visibility_consented_at DATETIME NULL AFTER visibility;
UPDATE candidate_profiles SET visibility=FALSE,visibility_consented_at=NULL;

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
