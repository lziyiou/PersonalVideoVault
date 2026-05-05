from app.config import Settings
from app.security import create_session, verify_session


def test_session_roundtrip():
    settings = Settings()
    settings.username = "alice"
    settings.secret_key = "secret"

    token = create_session("alice", settings)

    assert verify_session(token, settings)
    assert not verify_session(token + "tampered", settings)

