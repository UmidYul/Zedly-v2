from __future__ import annotations

import hashlib
import hmac
import time


def verify_telegram_auth(auth_data: dict[str, str], bot_token: str, max_age_seconds: int = 86400) -> bool:
    payload = {k: str(v) for k, v in auth_data.items()}
    incoming_hash = payload.pop("hash", "")
    auth_date_raw = payload.get("auth_date")
    if not incoming_hash or not auth_date_raw:
        return False

    try:
        auth_date = int(auth_date_raw)
    except ValueError:
        return False

    if time.time() - auth_date > max_age_seconds:
        return False

    data_check_string = "\n".join(f"{key}={payload[key]}" for key in sorted(payload))
    secret = hashlib.sha256(bot_token.encode("utf-8")).digest()
    computed_hash = hmac.new(secret, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed_hash, incoming_hash)
