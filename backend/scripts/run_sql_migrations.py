from __future__ import annotations

import os
from pathlib import Path

import psycopg


def main() -> None:
    database_url = os.getenv("ZEDLY_DATABASE_URL")
    if not database_url:
        raise RuntimeError("ZEDLY_DATABASE_URL is required")

    root = Path(__file__).resolve().parents[1]
    sql_dir = root / "sql"
    migration_files = sorted(sql_dir.glob("*.sql"))
    if not migration_files:
        print("No SQL files found")
        return

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            for sql_file in migration_files:
                sql = sql_file.read_text(encoding="utf-8")
                print(f"Applying {sql_file.name}")
                cur.execute(sql)
        conn.commit()
    print("Migrations applied successfully")


if __name__ == "__main__":
    main()
