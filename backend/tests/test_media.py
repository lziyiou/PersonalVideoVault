from pathlib import Path

from app.config import Settings
from app.media import quick_fingerprint, relative_to_media_root, safe_media_path


def test_safe_media_path_blocks_escape(tmp_path: Path):
    settings = Settings()
    settings.media_root = tmp_path.resolve()
    settings.data_root = (tmp_path / ".video-vault").resolve()

    try:
        safe_media_path(settings, "../outside.mp4")
    except ValueError:
        return

    raise AssertionError("expected path traversal to be blocked")


def test_relative_path_uses_media_root(tmp_path: Path):
    settings = Settings()
    settings.media_root = tmp_path.resolve()
    video = tmp_path / "course" / "lesson.mp4"
    video.parent.mkdir()
    video.write_bytes(b"demo")

    assert relative_to_media_root(settings, video) == "course/lesson.mp4"


def test_quick_fingerprint_changes_with_file_identity():
    first = quick_fingerprint("a.mp4", 10, 123)
    second = quick_fingerprint("a.mp4", 11, 123)

    assert first != second

