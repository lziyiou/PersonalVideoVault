from functools import lru_cache
from pathlib import Path
import hashlib
import json
import os
import secrets


class Settings:
    def __init__(self) -> None:
        self.env_media_root = Path(os.getenv("MEDIA_ROOT", "/media")).resolve()
        self.data_root = Path(os.getenv("VAULT_DATA_DIR", "/data")).resolve()
        self.media_root = self.env_media_root
        self.username = os.getenv("VAULT_USERNAME", "admin")
        self.password = os.getenv("VAULT_PASSWORD", "admin")
        self.password_hash: str | None = None
        self._config_mtime_ns: int | None = None
        self.secret_key = os.getenv("SECRET_KEY", "change-me")
        self.cors_origins = [
            item.strip()
            for item in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
            if item.strip()
        ]
        self.cors_origin_regex = os.getenv(
            "CORS_ORIGIN_REGEX",
            r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$",
        )
        self.load_vault_config()

    @property
    def db_path(self) -> Path:
        return self.data_root / "db" / "app.sqlite"

    @property
    def config_path(self) -> Path:
        return self.data_root / "config" / "app.json"

    def load_vault_config(self) -> None:
        path = self.config_path
        if not path.exists():
            self._config_mtime_ns = None
            return
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        self._config_mtime_ns = path.stat().st_mtime_ns
        if data.get("media_root"):
            self.media_root = Path(data["media_root"]).resolve()
        if data.get("username"):
            self.username = str(data["username"])
        if data.get("password_hash"):
            self.password_hash = str(data["password_hash"])
        if data.get("password"):
            self.password = str(data["password"])

    def reload_vault_config_if_changed(self) -> None:
        path = self.config_path
        if not path.exists():
            return
        try:
            mtime_ns = path.stat().st_mtime_ns
        except OSError:
            return
        if mtime_ns != self._config_mtime_ns:
            self.load_vault_config()

    def set_password(self, password: str) -> None:
        salt = secrets.token_hex(16)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000).hex()
        self.password = ""
        self.password_hash = f"pbkdf2_sha256${salt}${digest}"

    def save_vault_config(self) -> None:
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "media_root": str(self.media_root),
            "username": self.username,
            "password_hash": self.password_hash,
        }
        self.config_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        self._config_mtime_ns = self.config_path.stat().st_mtime_ns


@lru_cache
def get_settings() -> Settings:
    return Settings()


def ensure_data_layout(settings: Settings) -> None:
    for relative in ("db", "thumbnails", "transcodes", "subtitles", "ai", "config"):
        (settings.data_root / relative).mkdir(parents=True, exist_ok=True)
