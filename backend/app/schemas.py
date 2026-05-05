from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class VideoUpdate(BaseModel):
    user_title: str | None = None
    notes: str | None = None
    tags: list[str] | None = None


class ProgressUpdate(BaseModel):
    position_seconds: float
    duration_seconds: float | None = None
    device: str | None = None


class RebindRequest(BaseModel):
    media_root: str | None = None

