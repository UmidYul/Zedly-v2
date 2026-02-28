# Migration Compatibility Policy

## Purpose
Define strict rules for SQL migration authoring and rollout in order to keep schema evolution predictable for `backend/sql/*`.

## Migration Chain Rules
1. Migrations live in `backend/sql/`.
2. Filename format is mandatory: `NNN_description.sql`.
3. Numeric version `NNN` must be continuous with step `+1`.
4. Version sequence must start from `000`.
5. Already applied migration files are immutable.

## Runtime Guarantees
1. `backend/scripts/run_sql_migrations.py` validates filename format and sequence continuity.
2. Applied migrations are recorded in `schema_migrations`.
3. Every applied file is tracked with SHA-256 checksum.
4. Script fails on checksum drift, missing historical file, or version mismatch.
5. `--check` mode fails if any pending migrations remain.

## Backward Compatibility Rules
1. Prefer additive schema changes first: new nullable columns, new tables, new indexes.
2. Destructive changes (drop/rename/type narrowing) require two-step rollout:
   - Step A: add new structure and dual-write/read compatibility.
   - Step B: cleanup in later migration after application rollout.
3. Every migration must be idempotent where feasible (`IF EXISTS` / `IF NOT EXISTS`).
4. Seed or bootstrap inserts must use conflict-safe semantics.

## Release and CI Gate
1. Each migration PR must pass the workflow `.github/workflows/backend-migrations.yml`.
2. CI gate runs:
   - Apply all migrations on a clean PostgreSQL instance.
   - Verify final state with `run_sql_migrations.py --check`.
3. A release candidate is blocked if migration workflow is red.
