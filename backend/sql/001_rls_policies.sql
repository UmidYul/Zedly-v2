-- RLS baseline for school-scoped entities.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_class_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_school_isolation ON users;
DROP POLICY IF EXISTS classes_school_isolation ON classes;
DROP POLICY IF EXISTS class_students_school_isolation ON class_students;
DROP POLICY IF EXISTS teacher_subjects_school_isolation ON teacher_subjects;
DROP POLICY IF EXISTS teacher_class_assignments_school_isolation ON teacher_class_assignments;
DROP POLICY IF EXISTS student_class_enrollments_school_isolation ON student_class_enrollments;
DROP POLICY IF EXISTS tests_school_isolation ON tests;
DROP POLICY IF EXISTS test_assignments_school_isolation ON test_assignments;
DROP POLICY IF EXISTS test_sessions_school_isolation ON test_sessions;
DROP POLICY IF EXISTS session_answers_school_isolation ON session_answers;
DROP POLICY IF EXISTS invite_codes_school_isolation ON invite_codes;
DROP POLICY IF EXISTS analytics_snapshots_school_isolation ON analytics_snapshots;
DROP POLICY IF EXISTS report_jobs_school_isolation ON report_jobs;

CREATE POLICY users_school_isolation ON users
  USING (
    school_id::text = current_setting('app.current_school_id', true)
    OR current_setting('app.current_role', true) IN ('inspector', 'ministry', 'superadmin', 'service')
  );

CREATE POLICY classes_school_isolation ON classes
  USING (
    school_id::text = current_setting('app.current_school_id', true)
    OR current_setting('app.current_role', true) IN ('inspector', 'ministry', 'superadmin', 'service')
  );

CREATE POLICY class_students_school_isolation ON class_students
  USING (
    school_id::text = current_setting('app.current_school_id', true)
    OR current_setting('app.current_role', true) IN ('inspector', 'ministry', 'superadmin', 'service')
  );

CREATE POLICY teacher_subjects_school_isolation ON teacher_subjects
  USING (
    school_id::text = current_setting('app.current_school_id', true)
    OR current_setting('app.current_role', true) IN ('inspector', 'ministry', 'superadmin', 'service')
  );

CREATE POLICY teacher_class_assignments_school_isolation ON teacher_class_assignments
  USING (
    school_id::text = current_setting('app.current_school_id', true)
    OR current_setting('app.current_role', true) IN ('inspector', 'ministry', 'superadmin', 'service')
  );

CREATE POLICY student_class_enrollments_school_isolation ON student_class_enrollments
  USING (
    school_id::text = current_setting('app.current_school_id', true)
    OR current_setting('app.current_role', true) IN ('inspector', 'ministry', 'superadmin', 'service')
  );

CREATE POLICY tests_school_isolation ON tests
  USING (
    school_id::text = current_setting('app.current_school_id', true)
    OR current_setting('app.current_role', true) IN ('inspector', 'ministry', 'superadmin', 'service')
  );

CREATE POLICY test_assignments_school_isolation ON test_assignments
  USING (
    school_id::text = current_setting('app.current_school_id', true)
    OR current_setting('app.current_role', true) IN ('inspector', 'ministry', 'superadmin', 'service')
  );

CREATE POLICY test_sessions_school_isolation ON test_sessions
  USING (
    school_id::text = current_setting('app.current_school_id', true)
    OR current_setting('app.current_role', true) IN ('inspector', 'ministry', 'superadmin', 'service')
  );

CREATE POLICY session_answers_school_isolation ON session_answers
  USING (
    EXISTS (
      SELECT 1
      FROM test_sessions ts
      WHERE ts.id = session_answers.session_id
        AND (
          ts.school_id::text = current_setting('app.current_school_id', true)
          OR current_setting('app.current_role', true) IN ('inspector', 'ministry', 'superadmin', 'service')
        )
    )
  );

CREATE POLICY invite_codes_school_isolation ON invite_codes
  USING (
    school_id::text = current_setting('app.current_school_id', true)
    OR current_setting('app.current_role', true) IN ('inspector', 'ministry', 'superadmin', 'service')
  );

CREATE POLICY analytics_snapshots_school_isolation ON analytics_snapshots
  USING (
    school_id::text = current_setting('app.current_school_id', true)
    OR school_id IS NULL
    OR current_setting('app.current_role', true) IN ('inspector', 'ministry', 'superadmin', 'service')
  );

CREATE POLICY report_jobs_school_isolation ON report_jobs
  USING (
    school_id::text = current_setting('app.current_school_id', true)
    OR school_id IS NULL
    OR current_setting('app.current_role', true) IN ('inspector', 'ministry', 'superadmin', 'service')
  );
