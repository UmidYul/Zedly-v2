from __future__ import annotations

import json
import sys
from pathlib import Path


def _load_openapi_routes(openapi_path: Path) -> set[tuple[str, str]]:
    try:
        payload = json.loads(openapi_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise RuntimeError(f"OpenAPI file not found: {openapi_path}") from None
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"OpenAPI file is not valid JSON/YAML-subset: {openapi_path} ({exc})") from exc

    paths = payload.get("paths")
    if not isinstance(paths, dict):
        raise RuntimeError("OpenAPI payload must contain 'paths' object")

    routes: set[tuple[str, str]] = set()
    for path, operations in paths.items():
        if not isinstance(path, str) or not path.startswith("/api/v1"):
            continue
        if not isinstance(operations, dict):
            continue
        for method, operation in operations.items():
            if method.lower() not in {"get", "post", "patch", "put", "delete"}:
                continue
            if not isinstance(operation, dict):
                continue
            routes.add((path, method.upper()))
    return routes


def _load_app_routes(repo_root: Path) -> set[tuple[str, str]]:
    backend_root = repo_root / "backend"
    if str(backend_root) not in sys.path:
        sys.path.insert(0, str(backend_root))

    from app.main import app  # noqa: WPS433

    routes: set[tuple[str, str]] = set()
    for route in app.routes:
        path = getattr(route, "path", None)
        methods = getattr(route, "methods", None)
        if not path or not methods:
            continue
        if not path.startswith("/api/v1"):
            continue
        for method in methods:
            if method in {"HEAD", "OPTIONS"}:
                continue
            routes.add((path, method.upper()))
    return routes


def main() -> int:
    script_path = Path(__file__).resolve()
    repo_root = script_path.parents[2]
    openapi_path = repo_root / "docs" / "07_api" / "openapi.yaml"

    spec_routes = _load_openapi_routes(openapi_path)
    app_routes = _load_app_routes(repo_root)

    missing_in_spec = sorted(app_routes - spec_routes)
    extra_in_spec = sorted(spec_routes - app_routes)

    if missing_in_spec:
        print("OpenAPI contract is missing live /api/v1 routes:")
        for path, method in missing_in_spec:
            print(f"  - {method} {path}")
    if extra_in_spec:
        print("OpenAPI contract contains unknown routes:")
        for path, method in extra_in_spec:
            print(f"  - {method} {path}")

    if missing_in_spec or extra_in_spec:
        return 1

    print(f"OpenAPI contract check passed: {len(app_routes)} /api/v1 operations matched.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
