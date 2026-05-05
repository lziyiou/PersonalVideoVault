from __future__ import annotations

from pathlib import Path
import hashlib
import json
import mimetypes
import os
import subprocess

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from .config import Settings
from .models import Asset, Favorite, MediaStream, Tag, Task, Video, VideoTag


VIDEO_EXTENSIONS = {".mp4", ".mkv", ".mov", ".avi", ".webm", ".m3u8"}
DIRECT_PLAY_EXTENSIONS = {".mp4", ".mov", ".webm", ".m3u8"}


def safe_media_path(settings: Settings, relative_path: str) -> Path:
    root = settings.media_root.resolve()
    candidate = (root / relative_path).resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError("Path escapes media root")
    return candidate


def relative_to_media_root(settings: Settings, path: Path) -> str:
    return path.resolve().relative_to(settings.media_root.resolve()).as_posix()


def quick_fingerprint(relative_path: str, size: int, mtime: float) -> str:
    raw = f"{relative_path}|{size}|{int(mtime)}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def partial_hash(path: Path, sample_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        digest.update(handle.read(sample_size))
        if path.stat().st_size > sample_size:
            handle.seek(max(0, path.stat().st_size - sample_size))
            digest.update(handle.read(sample_size))
    return digest.hexdigest()


def run_ffprobe(path: Path) -> dict | None:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "quiet",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
                str(path),
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=45,
        )
        return json.loads(result.stdout)
    except Exception:
        return None


def apply_probe_metadata(db: Session, video: Video, probe: dict | None) -> None:
    if not probe:
        return
    fmt = probe.get("format") or {}
    video.format_name = fmt.get("format_name")
    if fmt.get("duration"):
        try:
            video.duration_seconds = float(fmt["duration"])
        except ValueError:
            pass

    db.execute(delete(MediaStream).where(MediaStream.video_id == video.id))
    for stream in probe.get("streams", []):
        stream_type = stream.get("codec_type") or "unknown"
        if stream_type == "video" and not video.video_codec:
            video.video_codec = stream.get("codec_name")
            video.width = stream.get("width")
            video.height = stream.get("height")
        if stream_type == "audio" and not video.audio_codec:
            video.audio_codec = stream.get("codec_name")
        db.add(
            MediaStream(
                video_id=video.id,
                stream_index=stream.get("index", 0),
                stream_type=stream_type,
                codec_name=stream.get("codec_name"),
                language=(stream.get("tags") or {}).get("language"),
                width=stream.get("width"),
                height=stream.get("height"),
            )
        )


def generate_thumbnail(settings: Settings, video: Video, source: Path) -> str | None:
    target = settings.data_root / "thumbnails" / f"{video.id}.jpg"
    if target.exists():
        return str(target.relative_to(settings.data_root).as_posix())
    seek = "00:00:03"
    if video.duration_seconds and video.duration_seconds > 60:
        seek = "00:00:10"
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-ss",
                seek,
                "-i",
                str(source),
                "-frames:v",
                "1",
                "-vf",
                "scale=480:-1",
                str(target),
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=60,
        )
        return str(target.relative_to(settings.data_root).as_posix())
    except Exception:
        return None


def scan_library(db: Session, settings: Settings, task: Task | None = None) -> Task:
    if not task:
        task = Task(task_type="scan", status="running")
        db.add(task)
        db.commit()
        db.refresh(task)
    else:
        task.status = "running"
        db.commit()
    seen: set[str] = set()
    count = 0
    try:
        for root, _, files in os.walk(settings.media_root):
            for name in files:
                path = Path(root) / name
                if path.suffix.lower() not in VIDEO_EXTENSIONS:
                    continue
                stat = path.stat()
                relative_path = relative_to_media_root(settings, path)
                seen.add(relative_path)
                fingerprint = quick_fingerprint(relative_path, stat.st_size, stat.st_mtime)
                video = db.scalar(select(Video).where(Video.relative_path == relative_path))
                if not video:
                    video = Video(
                        relative_path=relative_path,
                        filename=path.name,
                        extension=path.suffix.lower(),
                        size_bytes=stat.st_size,
                        mtime=stat.st_mtime,
                        quick_fingerprint=fingerprint,
                    )
                    db.add(video)
                    db.flush()
                elif video.size_bytes != stat.st_size or video.mtime != stat.st_mtime:
                    video.filename = path.name
                    video.extension = path.suffix.lower()
                    video.size_bytes = stat.st_size
                    video.mtime = stat.st_mtime
                    video.quick_fingerprint = fingerprint
                    video.strong_hash = None
                video.is_missing = False
                if not video.strong_hash:
                    video.strong_hash = partial_hash(path)
                if not video.duration_seconds:
                    apply_probe_metadata(db, video, run_ffprobe(path))
                if not video.thumbnail_path:
                    video.thumbnail_path = generate_thumbnail(settings, video, path)
                    if video.thumbnail_path:
                        db.add(Asset(video_id=video.id, asset_type="thumbnail", path=video.thumbnail_path))
                count += 1
                db.commit()
        db.query(Video).filter(Video.relative_path.not_in(seen)).update({"is_missing": True}, synchronize_session=False)
        task.status = "completed"
        task.message = f"Scanned {count} videos"
    except Exception as exc:
        task.status = "failed"
        task.message = str(exc)
    db.commit()
    db.refresh(task)
    return task


def serialize_video(db: Session, video: Video) -> dict:
    favorite = db.scalar(select(Favorite).where(Favorite.video_id == video.id)) is not None
    tags = [
        vt.tag.name
        for vt in db.scalars(select(VideoTag).where(VideoTag.video_id == video.id)).all()
        if vt.tag
    ]
    return {
        "id": video.id,
        "relative_path": video.relative_path,
        "filename": video.filename,
        "extension": video.extension,
        "title": video.user_title or video.filename,
        "user_title": video.user_title,
        "notes": video.notes,
        "size_bytes": video.size_bytes,
        "duration_seconds": video.duration_seconds,
        "width": video.width,
        "height": video.height,
        "video_codec": video.video_codec,
        "audio_codec": video.audio_codec,
        "thumbnail_url": f"/api/videos/{video.id}/thumbnail" if video.thumbnail_path else None,
        "is_missing": video.is_missing,
        "favorite": favorite,
        "tags": tags,
    }


def set_video_tags(db: Session, video: Video, names: list[str]) -> None:
    clean_names = sorted({name.strip() for name in names if name.strip()})
    db.execute(delete(VideoTag).where(VideoTag.video_id == video.id, VideoTag.source == "manual"))
    for name in clean_names:
        tag = db.scalar(select(Tag).where(Tag.name == name))
        if not tag:
            tag = Tag(name=name, source="manual")
            db.add(tag)
            db.flush()
        db.add(VideoTag(video_id=video.id, tag_id=tag.id, source="manual"))


def search_videos(db: Session, q: str | None, favorite: bool | None) -> list[Video]:
    stmt = select(Video)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(or_(Video.filename.ilike(pattern), Video.user_title.ilike(pattern), Video.notes.ilike(pattern)))
    if favorite:
        stmt = stmt.join(Favorite, Favorite.video_id == Video.id)
    stmt = stmt.order_by(Video.updated_at.desc())
    return list(db.scalars(stmt).all())


def mime_type(path: Path) -> str:
    return mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def transcode_to_hls(settings: Settings, video: Video, source: Path) -> Path:
    target_dir = settings.data_root / "transcodes" / str(video.id)
    playlist = target_dir / "index.m3u8"
    if playlist.exists():
        return playlist
    target_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(source),
            "-map",
            "0:v:0",
            "-map",
            "0:a:0?",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-c:a",
            "aac",
            "-f",
            "hls",
            "-hls_time",
            "6",
            "-hls_playlist_type",
            "vod",
            str(playlist),
        ],
        check=True,
        capture_output=True,
        text=True,
        timeout=60 * 60,
    )
    return playlist
