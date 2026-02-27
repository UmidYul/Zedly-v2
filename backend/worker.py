from __future__ import annotations

import os
import time

from app.repositories.runtime import get_session_store
from app.services.analytics_service import service as analytics_service
from app.services.assessment_service import service as test_service


def run() -> None:
    stream = os.getenv("ZEDLY_TEST_EVENTS_STREAM", "test_events")
    poll_seconds = int(os.getenv("ZEDLY_WORKER_POLL_SECONDS", "5"))
    stream_cursor = "0-0"
    while True:
        try:
            finalized = test_service.finalize_expired_sessions()
            if finalized:
                print(f"finalized_expired_sessions={finalized}")

            events = get_session_store().read_events(stream, stream_cursor, count=100, block_ms=1000)
            for event_id, payload in events:
                stream_cursor = event_id
                if payload.get("type") == "session_finalized":
                    session_id = payload.get("session_id")
                    if session_id:
                        analytics_service.recalculate_for_session(str(session_id))
        except Exception as exc:  # pragma: no cover - runtime safety for worker loop
            print(f"worker_error={exc.__class__.__name__}: {exc}")
        time.sleep(poll_seconds)


if __name__ == "__main__":
    run()
