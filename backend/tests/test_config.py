import json
from pathlib import Path

from app.config import Settings


def test_reload_vault_config_if_changed(tmp_path: Path):
    settings = Settings()
    settings.data_root = tmp_path / ".video-vault"
    settings.media_root = tmp_path / "media-a"
    first_media = tmp_path / "media-b"
    second_media = tmp_path / "media-c"
    first_media.mkdir()
    second_media.mkdir()
    settings.config_path.parent.mkdir(parents=True)
    settings.config_path.write_text(
        json.dumps({"media_root": str(first_media), "username": "first"}),
        encoding="utf-8",
    )
    settings.load_vault_config()

    settings.config_path.write_text(
        json.dumps({"media_root": str(second_media), "username": "second"}),
        encoding="utf-8",
    )
    settings.reload_vault_config_if_changed()

    assert settings.media_root == second_media.resolve()
    assert settings.username == "second"
