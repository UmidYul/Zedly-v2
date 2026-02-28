-- Wave bootstrap schema for docs-first implementation.
-- Covers auth, school structure, test engine, session flow, analytics snapshots.

CREATE TABLE IF NOT EXISTS schools (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subscription_plan VARCHAR(32) NOT NULL DEFAULT 'freemium',
  district_id VARCHAR(50) NULL
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

CREATE TABLE IF NOT EXISTS teacher_subjects (
  id VARCHAR(50) PRIMARY KEY,
  teacher_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id VARCHAR(50) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subject_code VARCHAR(50) NOT NULL,
  UNIQUE (teacher_id, school_id, subject_code)
);

CREATE TABLE IF NOT EXISTS teacher_class_assignments (
  id VARCHAR(50) PRIMARY KEY,
  teacher_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id VARCHAR(50) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id VARCHAR(50) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_code VARCHAR(50) NOT NULL,
  UNIQUE (teacher_id, class_id, subject_code)
);

CREATE TABLE IF NOT EXISTS student_class_enrollments (
  id VARCHAR(50) PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id VARCHAR(50) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id VARCHAR(50) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  enrollment_status VARCHAR(20) NOT NULL DEFAULT 'active',
  UNIQUE (student_id)
);

CREATE TABLE IF NOT EXISTS tests (
  id VARCHAR(50) PRIMARY KEY,
  school_id VARCHAR(50) NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  teacher_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(255) NOT NULL,
  subject VARCHAR(50) NOT NULL DEFAULT 'general',
  mode VARCHAR(32) NOT NULL DEFAULT 'standard',
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  show_answers VARCHAR(32) NOT NULL DEFAULT 'after_deadline',
  shuffle_questions BOOLEAN NOT NULL DEFAULT TRUE,
  shuffle_answers BOOLEAN NOT NULL DEFAULT TRUE,
  time_limit_minutes INTEGER NOT NULL DEFAULT 30,
  allow_retakes BOOLEAN NOT NULL DEFAULT FALSE,
  questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_tests_school_teacher ON tests(school_id, teacher_id, status);

CREATE TABLE IF NOT EXISTS test_assignments (
  id VARCHAR(50) PRIMARY KEY,
  test_id VARCHAR(50) NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  class_id VARCHAR(50) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  school_id VARCHAR(50) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deadline TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'assigned',
  UNIQUE (test_id, class_id)
);
CREATE INDEX IF NOT EXISTS idx_test_assignments_class ON test_assignments(class_id, deadline);

CREATE TABLE IF NOT EXISTS test_sessions (
  id VARCHAR(50) PRIMARY KEY,
  test_id VARCHAR(50) NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  assignment_id VARCHAR(50) NOT NULL REFERENCES test_assignments(id) ON DELETE CASCADE,
  student_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id VARCHAR(50) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  mode VARCHAR(32) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  question_order_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  answer_shuffles_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ NULL,
  score_percent NUMERIC(6,2) NULL,
  late_submission BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_test_sessions_student_test ON test_sessions(student_id, test_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_sessions_school_status ON test_sessions(school_id, status, expires_at);

CREATE TABLE IF NOT EXISTS session_answers (
  id VARCHAR(50) PRIMARY KEY,
  session_id VARCHAR(50) NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
  question_id VARCHAR(50) NOT NULL,
  answer_id VARCHAR(50) NULL,
  answered_at TIMESTAMPTZ NOT NULL,
  server_answered_at TIMESTAMPTZ NOT NULL,
  time_spent_seconds INTEGER NULL,
  is_late BOOLEAN NOT NULL DEFAULT FALSE,
  source VARCHAR(20) NOT NULL DEFAULT 'online',
  is_correct BOOLEAN NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  UNIQUE (session_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_session_answers_session ON session_answers(session_id);

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id VARCHAR(100) PRIMARY KEY,
  school_id VARCHAR(50) NULL REFERENCES schools(id) ON DELETE SET NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id VARCHAR(50) NOT NULL,
  metric_name VARCHAR(64) NOT NULL,
  period_type VARCHAR(20) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_school ON analytics_snapshots(school_id, entity_type, period_start DESC);

CREATE TABLE IF NOT EXISTS report_jobs (
  id VARCHAR(50) PRIMARY KEY,
  school_id VARCHAR(50) NULL REFERENCES schools(id) ON DELETE SET NULL,
  requested_by_user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope_level VARCHAR(20) NOT NULL,
  scope_id VARCHAR(50) NOT NULL,
  template_key VARCHAR(100) NOT NULL,
  format VARCHAR(10) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  params_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_url TEXT NULL,
  expires_at TIMESTAMPTZ NULL,
  error_code VARCHAR(50) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_report_jobs_status_created ON report_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_report_jobs_requested_by ON report_jobs(requested_by_user_id, created_at DESC);

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

INSERT INTO schools (id, name, subscription_plan, district_id) VALUES
  ('school_A', 'School A', 'freemium', 'district_X'),
  ('school_B', 'School B', 'standard', 'district_Y')
ON CONFLICT (id) DO NOTHING;

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

INSERT INTO student_class_enrollments (id, student_id, school_id, class_id, enrollment_status)
VALUES ('sce_A_1', 'usr_student_A', 'school_A', 'cls_A_7A', 'active')
ON CONFLICT (student_id) DO NOTHING;

INSERT INTO teacher_subjects (id, teacher_id, school_id, subject_code)
VALUES
  ('ts_A_phy', 'usr_teacher_A', 'school_A', 'physics'),
  ('ts_A_math', 'usr_teacher_A', 'school_A', 'mathematics'),
  ('ts_B_phy', 'usr_teacher_B', 'school_B', 'physics')
ON CONFLICT (teacher_id, school_id, subject_code) DO NOTHING;

INSERT INTO teacher_class_assignments (id, teacher_id, school_id, class_id, subject_code)
VALUES
  ('tca_A_phy', 'usr_teacher_A', 'school_A', 'cls_A_7A', 'physics'),
  ('tca_A_math', 'usr_teacher_A', 'school_A', 'cls_A_7A', 'mathematics'),
  ('tca_B_phy', 'usr_teacher_B', 'school_B', 'cls_B_8A', 'physics')
ON CONFLICT (teacher_id, class_id, subject_code) DO NOTHING;

INSERT INTO invite_codes (code, school_id, class_id, teacher_id, expires_at, usage_count)
VALUES ('ABC123', 'school_A', 'cls_A_7A', 'usr_teacher_A', NOW() + INTERVAL '72 hours', 0)
ON CONFLICT (code) DO NOTHING;

INSERT INTO tests (
  id, school_id, teacher_id, title, subject, mode, status, show_answers, shuffle_questions, shuffle_answers,
  time_limit_minutes, allow_retakes, questions_json, published_at
)
VALUES
(
  'tst_A_1',
  'school_A',
  'usr_teacher_A',
  'Physics School A',
  'physics',
  'standard',
  'published',
  'after_deadline',
  true,
  true,
  30,
  false,
  '[
    {
      "question_id":"q_A_1",
      "text":"Speed unit?",
      "topic":"kinematics",
      "points":1,
      "answers":[
        {"answer_id":"a_A_1","text":"m/s","is_correct":true},
        {"answer_id":"a_A_2","text":"kg","is_correct":false}
      ]
    },
    {
      "question_id":"q_A_2",
      "text":"Force formula?",
      "topic":"dynamics",
      "points":1,
      "answers":[
        {"answer_id":"a_A_3","text":"F=ma","is_correct":true},
        {"answer_id":"a_A_4","text":"E=mc2","is_correct":false}
      ]
    }
  ]'::jsonb,
  NOW()
),
(
  'tst_B_1',
  'school_B',
  'usr_teacher_B',
  'Physics School B',
  'physics',
  'standard',
  'draft',
  'after_deadline',
  true,
  true,
  30,
  false,
  '[]'::jsonb,
  NULL
)
ON CONFLICT (id) DO NOTHING;
