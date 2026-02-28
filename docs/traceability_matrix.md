# Traceability Matrix (Initial)

## Scope
Top implemented backend endpoints mapped across feature, domain entities, acceptance criteria, KPI and minimal automated test level.

| REQ ID | Feature | User flow | API endpoint (`/api/v1`) | Core entities | Acceptance link | KPI link | Test level |
|---|---|---|---|---|---|---|---|
| REQ-AUTH-001 | Auth | Teacher login | `POST /auth/login` | `users`, `schema_migrations`* | AC-17 | auth login success rate | integration |
| REQ-AUTH-002 | Auth | Telegram sign-in | `POST /auth/telegram` | `users` | AC-17 | telegram auth conversion | integration |
| REQ-AUTH-003 | Auth | Token rotation | `POST /auth/refresh` | session store / refresh family | AC-17 | token reuse incidents | integration |
| REQ-AUTH-004 | Auth | Session terminate | `POST /auth/logout` | session store blacklist | AC-17 | active sessions per user | integration |
| REQ-AUTH-005 | Auth | Global logout | `POST /auth/logout-all` | session store / `users` | AC-17 | forced logout propagation | integration |
| REQ-AUTH-006 | Onboarding | Student invite accept | `POST /auth/invite/accept` | `invite_codes`, `users`, `class_students` | AC-18 | invite conversion rate | integration |
| REQ-USER-001 | User profile | View profile | `GET /users/me` | `users` | AC-18 | profile read latency | integration |
| REQ-USER-002 | User profile | Edit profile | `PATCH /users/me` | `users` | AC-18 | profile update success rate | integration |
| REQ-USER-003 | School admin | List school users | `GET /schools/{school_id}/users` | `users` | AC-19 | unauthorized cross-school attempts | integration |
| REQ-USER-004 | School admin | Activate teacher | `PATCH /schools/{school_id}/users/{user_id}` | `users` | AC-19 | pending approval lead time | integration |
| REQ-USER-005 | Class management | Generate invite | `POST /classes/{class_id}/invite` | `invite_codes`, `classes` | AC-18 | invite issuance latency | integration |
| REQ-TEST-001 | Test engine | Create test | `POST /tests` | `tests` | AC-1 | test creation success rate | integration |
| REQ-TEST-002 | Test engine | View test | `GET /tests/{test_id}` | `tests` | AC-1 | test read p95 latency | integration |
| REQ-TEST-003 | Test engine | Assign test | `POST /tests/{test_id}/assign` | `test_assignments` | AC-2 | assignment throughput | integration |
| REQ-TEST-004 | Test engine | Start session | `POST /tests/{test_id}/sessions` | `test_sessions` | AC-2 | session start success rate | integration |
| REQ-TEST-005 | Test engine | Submit answers | `POST /sessions/{session_id}/answers` | `session_answers` | AC-2 | answer submit p95 | integration |
| REQ-TEST-006 | Test engine | Finish session | `POST /sessions/{session_id}/finish` | `test_sessions`, `session_answers` | AC-2 | completion ratio | integration |
| REQ-TEST-007 | Offline | Download offline bundle | `GET /tests/{test_id}/offline-bundle` | `tests`, `test_assignments` | AC-5 | offline bundle success rate | integration |
| REQ-TEST-008 | Offline | Sync offline answers | `POST /sessions/{session_id}/sync` | `session_answers` | AC-5 | sync conflict rate | integration |
| REQ-ANA-001 | Analytics | Teacher dashboard | `GET /analytics/teacher/dashboard` | `analytics_snapshots` | AC-6 | dashboard p95 latency | integration |
| REQ-ANA-002 | Analytics | Director dashboard | `GET /analytics/director/dashboard` | `analytics_snapshots` | AC-9 | active_teachers_rate freshness | integration |
| REQ-ANA-003 | Analytics | Inspector dashboard | `GET /analytics/inspector/dashboard` | `analytics_snapshots`, district scope | AC-10 | district dashboard freshness | integration |
| REQ-REP-001 | Reports | Generate report | `POST /reports/generate` | `report_jobs` | AC-21 | report queue wait time | integration |
| REQ-REP-002 | Reports | Report status | `GET /reports/{report_id}/status` | `report_jobs` | AC-21 | report completion time | integration |
| REQ-REP-003 | Reports | Download report | `GET /reports/{report_id}/download` | `report_jobs` | AC-21 | protected download success rate | integration |

\* `schema_migrations` is listed here only as platform dependency for deployment reliability, not as a business entity.
