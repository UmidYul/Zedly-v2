# OpenAPI Migration TODO (`/api/v1`)

## Goal
Converge API docs from markdown specs in `docs/07_api/*` into a single executable `openapi.yaml` for contract-first delivery.

## Phase 1 (P0): Baseline Spec Skeleton
1. [x] Create `docs/07_api/openapi.yaml`.
2. [x] Add global sections:
   - [x] `info`, `servers`
   - [x] `securitySchemes`, reusable error schema
3. [x] Add canonical response envelopes:
   - success: `{"ok": true, "data": ...}`
   - error: `{"ok": false, "error": {...}}`
4. [x] Add path stubs for implemented endpoints under `/api/v1/*`.

## Phase 2 (P1): Endpoint Completion
1. [x] Port auth endpoints from `auth_api.md`.
2. [x] Port users endpoints from `users_api.md`.
3. [x] Port tests endpoints from `tests_api.md`.
4. [x] Port analytics and reports endpoints from `analytics_api.md`.
5. [x] Add examples for core request/response payloads.

## Phase 3 (P1): Contract Gates
1. [x] Add OpenAPI linting in CI (spec validity + style checks).
2. [x] Add contract tests that compare running routes against OpenAPI paths/operations.
3. [ ] Define breaking-change policy:
   - breaking only via new version prefix.
   - additive changes allowed in v1 minors.

## Definition of Done
1. `openapi.yaml` covers all non-deprecated `/api/v1/*` routes.
2. CI fails on invalid spec or route/spec drift.
3. Release checklist includes OpenAPI contract review.
