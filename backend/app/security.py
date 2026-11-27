
import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from jose import JWTError, jwt


load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "").strip()

if len(SECRET_KEY.encode("utf-8")) < 32:
    raise RuntimeError(
        "SECRET_KEY must contain at least 32 bytes. "
        "Configure a strong random secret in your environment."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


def create_access_token(data: dict) -> str:
    if not isinstance(data, dict):
        raise ValueError("Token data must be a dictionary.")

    user_id = data.get("user_id")
    email = data.get("email")

    if (
        not isinstance(user_id, int)
        or isinstance(user_id, bool)
        or user_id <= 0
    ):
        raise ValueError("A valid user_id is required.")

    if not isinstance(email, str) or not email.strip():
        raise ValueError("A valid email is required.")

    now = datetime.now(timezone.utc)

    payload = data.copy()
    payload.pop("exp", None)
    payload.pop("iat", None)

    payload.update({
        "user_id": user_id,
        "email": email.strip().lower(),
        "iat": now,
        "exp": now + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        ),
    })

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def verify_access_token(token: str):
    if not isinstance(token, str) or not token.strip():
        return None

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"require_exp": True}
        )

        user_id = payload.get("user_id")
        email = payload.get("email")

        if (
            not isinstance(user_id, int)
            or isinstance(user_id, bool)
            or user_id <= 0
        ):
            return None

        if not isinstance(email, str) or not email.strip():
            return None

        return {
            "user_id": user_id,
            "email": email.strip().lower()
        }

    except JWTError:
        return None
