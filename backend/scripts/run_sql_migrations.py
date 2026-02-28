from __future__ import annotations

import argparse
import hashlib
import os
import re
from dataclasses import dataclass
from pathlib import Path

import psycopg


MIGRATION_NAME_RE = re.compile(r"^(?P<version>\d{3})_(?P<slug>[a-z0-9_]+)\.sql$")
MIGRATION_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    checksum_sha256 TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""


@dataclass(frozen=True, slots=True)
class MigrationFile:
    version: int
    name: str
    path: Path
    checksum_sha256: str


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def _load_migration_files(sql_dir: Path) -> list[MigrationFile]:
    sql_files = sorted(sql_dir.glob("*.sql"))
    if not sql_files:
        raise RuntimeError(f"No SQL migrations found in {sql_dir}")

    migrations: list[MigrationFile] = []
    for sql_file in sql_files:
        match = MIGRATION_NAME_RE.match(sql_file.name)
        if not match:
            raise RuntimeError(
                "Invalid migration name: "
                f"{sql_file.name}. Expected format NNN_description.sql (example: 002_add_indexes.sql)."
            )

        migrations.append(
            MigrationFile(
                version=int(match.group("version")),
                name=sql_file.name,
                path=sql_file,
                checksum_sha256=_sha256(sql_file),
            )
        )

    if migrations[0].version != 0:
        raise RuntimeError(
            f"Migration chain must start from 000_*.sql. Found first version {migrations[0].version:03d}."
        )

    for index, migration in enumerate(migrations):
        if migration.version != index:
            raise RuntimeError(
                "Migration versions must be continuous with step=1. "
                f"Expected {index:03d}, found {migration.version:03d} ({migration.name})."
            )

    return migrations


def _ensure_migration_table(cur) -> None:
    cur.execute(MIGRATION_TABLE_SQL)


def _load_applied_migrations(cur) -> dict[int, tuple[str, str]]:
    cur.execute("SELECT version, name, checksum_sha256 FROM schema_migrations ORDER BY version")
    return {int(version): (str(name), str(checksum)) for version, name, checksum in cur.fetchall()}


def _validate_applied_history(migrations: list[MigrationFile], applied: dict[int, tuple[str, str]]) -> list[MigrationFile]:
    by_version = {item.version: item for item in migrations}
    unknown_versions = sorted(version for version in applied if version not in by_version)
    if unknown_versions:
        joined = ", ".join(f"{item:03d}" for item in unknown_versions)
        raise RuntimeError(f"Applied migration history references missing files: {joined}")

    for version, (name, checksum) in applied.items():
        expected = by_version[version]
        if expected.name != name:
            raise RuntimeError(
                f"Applied migration mismatch for version {version:03d}: "
                f"db={name}, file={expected.name}."
            )
        if expected.checksum_sha256 != checksum:
            raise RuntimeError(
                f"Applied migration checksum mismatch for version {version:03d} ({name}). "
                "Migration files are immutable after apply."
            )

    return [item for item in migrations if item.version not in applied]


def _apply_pending(conn, cur, pending: list[MigrationFile]) -> int:
    applied_count = 0
    for migration in pending:
        sql = migration.path.read_text(encoding="utf-8")
        print(f"Applying {migration.name}")
        with conn.transaction():
            cur.execute(sql)
            cur.execute(
                """
                INSERT INTO schema_migrations (version, name, checksum_sha256)
                VALUES (%s, %s, %s)
                """,
                (migration.version, migration.name, migration.checksum_sha256),
            )
        applied_count += 1
    return applied_count


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Apply SQL migrations in strict sequential order.")
    parser.add_argument(
        "--database-url",
        default=os.getenv("ZEDLY_DATABASE_URL"),
        help="PostgreSQL connection URL. Defaults to ZEDLY_DATABASE_URL environment variable.",
    )
    parser.add_argument(
        "--sql-dir",
        default=str(Path(__file__).resolve().parents[1] / "sql"),
        help="Directory with SQL migration files.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify migration history and fail if there are pending migrations (does not apply).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.database_url:
        raise RuntimeError("Database URL is required. Set ZEDLY_DATABASE_URL or pass --database-url.")

    sql_dir = Path(args.sql_dir).resolve()
    migrations = _load_migration_files(sql_dir)
    print(f"Discovered {len(migrations)} migration file(s) in {sql_dir}")

    with psycopg.connect(args.database_url) as conn:
        with conn.cursor() as cur:
            _ensure_migration_table(cur)
            applied = _load_applied_migrations(cur)
            pending = _validate_applied_history(migrations, applied)

            if args.check:
                if pending:
                    joined = ", ".join(item.name for item in pending)
                    raise RuntimeError(f"Pending migrations detected: {joined}")
                print("Migration check passed: database is fully up-to-date.")
                return

            if not pending:
                print("No pending migrations.")
                return

            applied_count = _apply_pending(conn, cur, pending)
            print(f"Migrations applied successfully. Applied {applied_count} file(s).")


if __name__ == "__main__":
    main()
