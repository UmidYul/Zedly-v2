-- Minimal Wave 1 bootstrap schema for PostgreSQL runtime mode.
-- Source of truth: docs/05_backend/auth_spec.md + docs/05_backend/school_isolation_model.md + docs/08_data_model/entities.md

CREATE TABLE IF NOT EXISTS schools (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subscription_plan VARCHAR(32) NOT NULL DEFAULT 'freemium'
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(50) PRIMARY KEY,
  school_id VARCHAR(50) NULL REFERENCES schools(id) ON DELETE RESTRICT,
  district_id VARCHAR(50) NULL,
  role VARCHAR(32) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  email VARCHAR(255) NULL,
  phone VARCHAR(64) NULL,
  telegram_id BIGINT NULL UNIQUE,
  password_hash TEXT NULL,
  language VARCHAR(10) NOT NULL DEFAULT 'uz',
  avatar_url TEXT NULL,
  subscription_tier VARCHAR(32) NOT NULL DEFAULT 'free',
  subscription_expires_at TIMESTAMPTZ NULL,
  last_active_at TIMESTAMPTZ NULL,
  session_invalidated_at BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_users_school_role ON users(school_id, role);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(lower(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS classes (
  id VARCHAR(50) PRIMARY KEY,
  school_id VARCHAR(50) NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  teacher_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name VARCHAR(50) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id, school_id);

CREATE TABLE IF NOT EXISTS class_students (
  id VARCHAR(50) PRIMARY KEY,
  class_id VARCHAR(50) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id VARCHAR(50) NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  UNIQUE (class_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_class_students_class ON class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_class_students_student ON class_students(student_id);

CREATE TABLE IF NOT EXISTS tests (
  id VARCHAR(50) PRIMARY KEY,
  school_id VARCHAR(50) NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  teacher_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(255) NOT NULL,
  mode VARCHAR(32) NOT NULL DEFAULT 'standard',
  status VARCHAR(32) NOT NULL DEFAULT 'draft'
);
CREATE INDEX IF NOT EXISTS idx_tests_school_teacher ON tests(school_id, teacher_id, status);

CREATE TABLE IF NOT EXISTS invite_codes (
  code VARCHAR(50) PRIMARY KEY,
  school_id VARCHAR(50) NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  class_id VARCHAR(50) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at TIMESTAMPTZ NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(50) PRIMARY KEY,
  school_id VARCHAR(50) NULL REFERENCES schools(id) ON DELETE RESTRICT,
  user_id VARCHAR(50) NULL REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL DEFAULT 'api',
  entity_id VARCHAR(100) NULL,
  old_value JSONB NULL DEFAULT '{}'::jsonb,
  new_value JSONB NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(64) NULL,
  user_agent TEXT NULL,
  result VARCHAR(20) NOT NULL DEFAULT 'success',
  error_code VARCHAR(20) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_school_time ON audit_logs(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_time ON audit_logs(event_type, created_at DESC);

INSERT INTO schools (id, name, subscription_plan) VALUES
  ('school_A', 'School A', 'freemium'),
  ('school_B', 'School B', 'standard')
ON CONFLICT (id) DO NOTHING;

-- Seed users reuse in-memory ids for parity with tests.
INSERT INTO users (id, school_id, role, full_name, status, email, password_hash, telegram_id)
VALUES
  ('usr_teacher_A', 'school_A', 'teacher', 'Teacher A', 'active', 'teachera@school.uz', '$2b$12$th8JYcilWPsfssI0Ja8HqO9vPmeo2XXm0YREYT.s1ecVZNxYuvy9W', 1110001),
  ('usr_director_A', 'school_A', 'director', 'Director A', 'active', 'directora@school.uz', '$2b$12$JYp8ih04MFc9wribHlcpAONfgTma/6.2I7BA7Mjaw2lIRdtGemaf2', 1110002),
  ('usr_student_A', 'school_A', 'student', 'Student A', 'active', 'studenta@school.uz', '$2b$12$8Kkz4TPZrSrkiUoMoGKEfuHTOdmOzkZM093/rQWu73Dikr6dEEk9W', 1110003),
  ('usr_teacher_B', 'school_B', 'teacher', 'Teacher B', 'active', 'teacherb@school.uz', '$2b$12$th8JYcilWPsfssI0Ja8HqO9vPmeo2XXm0YREYT.s1ecVZNxYuvy9W', 2220001)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, school_id, district_id, role, full_name, status, email, password_hash)
VALUES ('usr_inspector_X', NULL, 'district_X', 'inspector', 'Inspector X', 'active', 'inspector@district.uz', '$2b$12$8R9F2ZHFJRV.kz4RInZHUu0nzZ7Qsrk5uxT5LL3Di8RWxTaNPnzsS')
ON CONFLICT (id) DO NOTHING;

INSERT INTO classes (id, school_id, teacher_id, name)
VALUES
  ('cls_A_7A', 'school_A', 'usr_teacher_A', '7A'),
  ('cls_B_8A', 'school_B', 'usr_teacher_B', '8A')
ON CONFLICT (id) DO NOTHING;

INSERT INTO class_students (id, class_id, student_id, school_id)
VALUES ('clsmap_A_1', 'cls_A_7A', 'usr_student_A', 'school_A')
ON CONFLICT (class_id, student_id) DO NOTHING;

INSERT INTO invite_codes (code, school_id, class_id, teacher_id, expires_at, usage_count)
VALUES ('ABC123', 'school_A', 'cls_A_7A', 'usr_teacher_A', NOW() + INTERVAL '72 hours', 0)
ON CONFLICT (code) DO NOTHING;

INSERT INTO tests (id, school_id, teacher_id, title, mode, status)
VALUES
  ('tst_A_1', 'school_A', 'usr_teacher_A', 'Physics School A', 'standard', 'draft'),
  ('tst_B_1', 'school_B', 'usr_teacher_B', 'Physics School B', 'standard', 'draft')
ON CONFLICT (id) DO NOTHING;
