from functools import lru_cache
from pathlib import Path
import os


class Settings:
    media_root: Path = Path(os.getenv("MEDIA_ROOT", "/media")).resolve()
    data_root: Path = Path(os.getenv("VAULT_DATA_DIR", "/data")).resolve()
    username: str = os.getenv("VAULT_USERNAME", "admin")
    password: str = os.getenv("VAULT_PASSWORD", "admin")
    secret_key: str = os.getenv("SECRET_KEY", "change-me")
    cors_origins: list[str] = [
        item.strip()
        for item in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if item.strip()
    ]

    @property
    def db_path(self) -> Path:
        return self.data_root / "db" / "app.sqlite"


@lru_cache
def get_settings() -> Settings:
    return Settings()


def ensure_data_layout(settings: Settings) -> None:
    for relative in ("db", "thumbnails", "transcodes", "subtitles", "ai", "config"):
        (settings.data_root / relative).mkdir(parents=True, exist_ok=True)

