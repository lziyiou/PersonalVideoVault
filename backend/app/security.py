import hashlib
import hmac
import time

from fastapi import Cookie, Depends, HTTPException, Response, status

from .config import Settings, get_settings


COOKIE_NAME = "vault_session"


def _sign(value: str, secret: str) -> str:
    return hmac.new(secret.encode(), value.encode(), hashlib.sha256).hexdigest()


def create_session(username: str, settings: Settings) -> str:
    payload = f"{username}:{int(time.time())}"
    return f"{payload}:{_sign(payload, settings.secret_key)}"


def verify_session(token: str | None, settings: Settings) -> bool:
    if not token:
        return False
    parts = token.split(":")
    if len(parts) != 3:
        return False
    payload = ":".join(parts[:2])
    expected = _sign(payload, settings.secret_key)
    return hmac.compare_digest(parts[2], expected) and parts[0] == settings.username


def require_auth(
    vault_session: str | None = Cookie(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    if not verify_session(vault_session, settings):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")


def set_session_cookie(response: Response, username: str, settings: Settings) -> None:
    response.set_cookie(
        COOKIE_NAME,
        create_session(username, settings),
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 30,
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME)


def check_password(username: str, password: str, settings: Settings) -> bool:
    return (
        hmac.compare_digest(username, settings.username)
        and hmac.compare_digest(password, settings.password)
    )

