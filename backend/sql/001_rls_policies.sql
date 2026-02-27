-- docs-driven RLS baseline for school-scoped entities.
-- Reference: docs/05_backend/school_isolation_model.md + docs/08_data_model/entities.md

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_school_isolation ON users
  USING (
    school_id::text = current_setting('app.current_school_id', true)
    OR current_setting('app.current_role', true) IN ('inspector', 'ministry', 'superadmin', 'service')
  );

CREATE POLICY tests_school_isolation ON tests
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

CREATE POLICY invite_codes_school_isolation ON invite_codes
  USING (
    school_id::text = current_setting('app.current_school_id', true)
    OR current_setting('app.current_role', true) IN ('inspector', 'ministry', 'superadmin', 'service')
  );

CREATE POLICY test_sessions_school_isolation ON test_sessions
  USING (
    school_id::text = current_setting('app.current_school_id', true)
    OR current_setting('app.current_role', true) IN ('inspector', 'ministry', 'superadmin', 'service')
  );

CREATE POLICY answers_school_isolation ON answers
  USING (
    school_id::text = current_setting('app.current_school_id', true)
    OR current_setting('app.current_role', true) IN ('inspector', 'ministry', 'superadmin', 'service')
  );

CREATE POLICY analytics_snapshots_school_isolation ON analytics_snapshots
  USING (
    school_id::text = current_setting('app.current_school_id', true)
    OR current_setting('app.current_role', true) IN ('inspector', 'ministry', 'superadmin', 'service')
  );
