# Contributing

## Merge Gate (CI Matrix)
Every pull request must pass all required checks before merge.

| Check | Workflow | What it validates |
|---|---|---|
| SQL migrations | `backend-migrations` | Sequential apply on clean PostgreSQL + `--check` (no pending SQL migrations) |
| OpenAPI + backend contract | `backend-contract` | Spectral lint for `docs/07_api/openapi.yaml`, route/spec parity, API contract tests |
| Frontend smoke | `frontend-e2e` | Playwright smoke scenarios for web auth/users lifecycle |
| Unified gate | `release-gate / gate` | Aggregated pass/fail over migrations + backend-contract + frontend-e2e |

## Local Preflight (recommended)
Run this before pushing:

```bash
python backend/scripts/run_sql_migrations.py --check
python backend/scripts/verify_openapi_contract.py
npx -y @stoplight/spectral-cli lint --fail-severity=warn docs/07_api/openapi.yaml
python -m pytest backend/tests/test_v1_contracts.py -q
cd frontend && npm run e2e
```

## Contract Change Rule
- If backend routes or response payloads change, update `docs/07_api/openapi.yaml` in the same PR.
- Do not merge contract-affecting changes when any CI gate is red.
