from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import ensure_data_layout, get_settings
from .db import Base, SessionLocal, engine, get_db
from .file_lock import VaultLock
from .media import (
    DIRECT_PLAY_EXTENSIONS,
    mime_type,
    safe_media_path,
    scan_library,
    search_videos,
    serialize_video,
    set_video_tags,
    transcode_to_hls,
)
from .models import Favorite, PlaybackHistory, Tag, Task, Video, VideoTag
from .schemas import AppSettingsUpdate, LoginRequest, ProgressUpdate, RebindRequest, VideoUpdate
from .security import check_password, clear_session_cookie, require_auth, set_session_cookie


settings = get_settings()
vault_lock = VaultLock(settings.data_root)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_data_layout(settings)
    vault_lock.acquire()
    Base.metadata.create_all(bind=engine)
    try:
        yield
    finally:
        vault_lock.release()


app = FastAPI(title="Personal Video Vault", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "media_root": str(settings.media_root), "data_root": str(settings.data_root)}


@app.post("/api/auth/login")
def login(payload: LoginRequest, response: Response) -> dict:
    if not check_password(payload.username, payload.password, settings):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    set_session_cookie(response, payload.username, settings)
    return {"ok": True}


@app.post("/api/auth/logout")
def logout(response: Response) -> dict:
    clear_session_cookie(response)
    return {"ok": True}


@app.get("/api/auth/me", dependencies=[Depends(require_auth)])
def me() -> dict:
    return {"username": settings.username}


@app.post("/api/libraries/scan", dependencies=[Depends(require_auth)])
def scan(background_tasks: BackgroundTasks, db: Session = Depends(get_db)) -> dict:
    task = Task(task_type="scan", status="queued")
    db.add(task)
    db.commit()
    db.refresh(task)

    def run_scan() -> None:
        with SessionLocal() as worker_db:
            queued = worker_db.get(Task, task.id)
            if queued:
                scan_library(worker_db, settings, queued)

    background_tasks.add_task(run_scan)
    return {"task_id": task.id, "status": "queued"}


@app.post("/api/libraries/rebind", dependencies=[Depends(require_auth)])
def rebind(payload: RebindRequest) -> dict:
    if payload.media_root:
        return {"ok": True, "message": "Set MEDIA_ROOT and restart the Docker service to rebind this vault."}
    return {"ok": True, "media_root": str(settings.media_root)}


@app.get("/api/videos", dependencies=[Depends(require_auth)])
def videos(
    q: str | None = None,
    favorite: bool | None = Query(default=None),
    tag: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=48, ge=1, le=96),
    db: Session = Depends(get_db),
) -> dict:
    videos_page, total = search_videos(db, q, favorite, tag, page, page_size)
    items = [serialize_video(db, video) for video in videos_page]
    total_pages = max(1, (total + page_size - 1) // page_size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@app.get("/api/tags", dependencies=[Depends(require_auth)])
def tags(db: Session = Depends(get_db)) -> dict:
    rows = db.execute(
        select(Tag.name, func.count(VideoTag.video_id))
        .join(VideoTag, VideoTag.tag_id == Tag.id)
        .group_by(Tag.id)
        .order_by(Tag.name)
    ).all()
    return {"items": [{"name": name, "count": count} for name, count in rows]}


@app.get("/api/settings", dependencies=[Depends(require_auth)])
def app_settings() -> dict:
    return {
        "media_root": str(settings.media_root),
        "data_root": str(settings.data_root),
        "username": settings.username,
        "config_path": str(settings.config_path),
        "docker_note": "If Docker maps a host folder to /media, change the host path in compose or .env and restart the service.",
    }


@app.patch("/api/settings", dependencies=[Depends(require_auth)])
def update_settings(payload: AppSettingsUpdate) -> dict:
    if payload.media_root is not None:
        media_root = Path(payload.media_root).expanduser().resolve()
        if not media_root.exists() or not media_root.is_dir():
            raise HTTPException(status_code=400, detail="Media root must be an existing directory visible to the backend.")
        settings.media_root = media_root
    if payload.username is not None:
        username = payload.username.strip()
        if not username:
            raise HTTPException(status_code=400, detail="Username cannot be empty.")
        settings.username = username
    if payload.password is not None:
        if len(payload.password) < 4:
            raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")
        settings.set_password(payload.password)
    settings.save_vault_config()
    return app_settings()


@app.get("/api/videos/{video_id}", dependencies=[Depends(require_auth)])
def video_detail(video_id: int, db: Session = Depends(get_db)) -> dict:
    video = db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return serialize_video(db, video)


@app.patch("/api/videos/{video_id}", dependencies=[Depends(require_auth)])
def update_video(video_id: int, payload: VideoUpdate, db: Session = Depends(get_db)) -> dict:
    video = db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if payload.user_title is not None:
        video.user_title = payload.user_title.strip() or None
    if payload.notes is not None:
        video.notes = payload.notes
    if payload.tags is not None:
        set_video_tags(db, video, payload.tags)
    db.commit()
    db.refresh(video)
    return serialize_video(db, video)


@app.get("/api/videos/{video_id}/thumbnail", dependencies=[Depends(require_auth)])
def thumbnail(video_id: int, db: Session = Depends(get_db)) -> FileResponse:
    video = db.get(Video, video_id)
    if not video or not video.thumbnail_path:
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    path = (settings.data_root / video.thumbnail_path).resolve()
    if settings.data_root.resolve() not in path.parents:
        raise HTTPException(status_code=403, detail="Invalid thumbnail path")
    return FileResponse(path)


@app.get("/api/videos/{video_id}/stream", dependencies=[Depends(require_auth)])
def stream_video(video_id: int, db: Session = Depends(get_db)):
    video = db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    source = safe_media_path(settings, video.relative_path)
    if not source.exists():
        raise HTTPException(status_code=404, detail="Source file missing")
    if video.extension in DIRECT_PLAY_EXTENSIONS:
        return FileResponse(source, media_type=mime_type(source), filename=video.filename)
    playlist = transcode_to_hls(settings, video, source)
    rewritten = []
    for line in playlist.read_text(encoding="utf-8").splitlines():
        if line and not line.startswith("#"):
            rewritten.append(f"/api/transcodes/{video.id}/{Path(line).name}")
        else:
            rewritten.append(line)
    return Response("\n".join(rewritten), media_type="application/vnd.apple.mpegurl")


@app.get("/api/transcodes/{video_id}/{name}", dependencies=[Depends(require_auth)])
def transcode_segment(video_id: int, name: str) -> FileResponse:
    base = (settings.data_root / "transcodes" / str(video_id)).resolve()
    path = (base / name).resolve()
    if base != path.parent:
        raise HTTPException(status_code=403, detail="Invalid path")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Segment not found")
    media_type = "video/mp2t" if path.suffix == ".ts" else "application/vnd.apple.mpegurl"
    return FileResponse(path, media_type=media_type)


@app.post("/api/videos/{video_id}/progress", dependencies=[Depends(require_auth)])
def save_progress(video_id: int, payload: ProgressUpdate, db: Session = Depends(get_db)) -> dict:
    if not db.get(Video, video_id):
        raise HTTPException(status_code=404, detail="Video not found")
    history = db.scalar(select(PlaybackHistory).where(PlaybackHistory.video_id == video_id))
    if not history:
        history = PlaybackHistory(video_id=video_id)
        db.add(history)
    history.position_seconds = payload.position_seconds
    history.duration_seconds = payload.duration_seconds
    history.device = payload.device
    db.commit()
    return {"ok": True}


@app.post("/api/videos/{video_id}/favorite", dependencies=[Depends(require_auth)])
def favorite(video_id: int, db: Session = Depends(get_db)) -> dict:
    if not db.get(Video, video_id):
        raise HTTPException(status_code=404, detail="Video not found")
    existing = db.scalar(select(Favorite).where(Favorite.video_id == video_id))
    if existing:
        db.delete(existing)
        favorited = False
    else:
        db.add(Favorite(video_id=video_id))
        favorited = True
    db.commit()
    return {"favorite": favorited}


@app.get("/api/tasks", dependencies=[Depends(require_auth)])
def tasks(db: Session = Depends(get_db)) -> dict:
    items = db.scalars(select(Task).order_by(Task.created_at.desc()).limit(50)).all()
    return {
        "items": [
            {
                "id": task.id,
                "task_type": task.task_type,
                "status": task.status,
                "video_id": task.video_id,
                "message": task.message,
                "created_at": task.created_at.isoformat(),
                "updated_at": task.updated_at.isoformat(),
            }
            for task in items
        ]
    }
