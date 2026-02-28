# Spec Changelog

## 2026-02-28
- Added `docs/implementation_readiness_review_2026-02-28.md` (readiness gap analysis and 90-day plan).
- Added `docs/08_data_model/migration_compatibility_policy.md` (SQL migration discipline and CI gate).
- Added `docs/07_api/openapi_todo.md` (phased OpenAPI v1 convergence plan).
- Added `docs/traceability_matrix.md` (initial endpoint-level traceability).
- Added executable `docs/07_api/openapi.yaml` baseline covering current `/api/v1/*` operations.
- Added `backend/scripts/verify_openapi_contract.py` for route/spec drift detection.
- Extended `docs/07_api/openapi.yaml` with reusable schema components for Auth/Users payloads.
- Added `.github/workflows/release-gate.yml` as unified CI gate (migrations + backend contract + frontend e2e).
- Added Playwright smoke for `logout-all` token revocation lifecycle.
- Wired `$ref` envelope responses for Auth/Users operations in `docs/07_api/openapi.yaml`.
- Closed envelope `$ref` coverage for Tests/Analytics/Reports in `docs/07_api/openapi.yaml` with reusable data/envelope schemas.
- Added reusable response examples for key Auth/Users/Tests/Reports envelopes in `docs/07_api/openapi.yaml`.
- Added Spectral-based OpenAPI lint gate (`.spectral.yaml`) to `backend-contract` and `release-gate` workflows.
- Added operation-level `tags` and `description` for all `/api/v1/*` operations in `docs/07_api/openapi.yaml`.
- Added global OpenAPI `tags` section to satisfy strict Spectral tag validation.
- Added `CONTRIBUTING.md` with required CI merge-gate matrix and local preflight commands.
- Added `example`/`examples` coverage for all current OpenAPI schema components in `docs/07_api/openapi.yaml`.
- Extended tests finish contract with `topic_breakdown` in backend schemas and `docs/07_api/openapi.yaml`.
- Added frontend `/tests-workbench` MVP with teacher create/assign, student finish/result, and class results summary.
