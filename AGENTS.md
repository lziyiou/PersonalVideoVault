# 项目知识：Personal Video Vault

## 项目目标

这是一个个人跨设备视频资产管理平台，用于管理移动硬盘中的大量非结构化视频资源。系统重点不是影视媒体库，而是“个人视频资产库”：自拍视频、录屏、课程、下载视频、直播切片、素材文件等都应能统一扫描、索引、播放、打标签和搜索。

核心设计要求：

- 本机 Docker 运行。
- 电脑作为局域网视频服务中心。
- 手机、平板、其他电脑通过网页访问。
- 数据跟随移动硬盘迁移。
- 原始视频只读，不移动、不重命名、不删除。
- MVP 先实现索引、播放、标签、收藏、历史、缩略图。
- AI 能力先预留架构，后续逐步接入。

## 当前技术栈

- 后端：Python + FastAPI。
- 数据库：SQLite，路径在 `.video-vault/db/app.sqlite`。
- ORM：SQLAlchemy。
- 前端：React + Vite + TypeScript。
- 播放：浏览器原生 video，HLS 使用 `hls.js`。
- 视频处理：FFmpeg / ffprobe。
- 部署：Docker Compose。

## 国内镜像源

Docker 构建已配置国内镜像源，降低依赖下载中断概率：

- 后端 `backend/Dockerfile` 使用清华 Debian apt 镜像安装 FFmpeg。
- 后端 pip 使用清华 PyPI 镜像：`https://pypi.tuna.tsinghua.edu.cn/simple`。
- 前端 npm 使用 npmmirror：`https://registry.npmmirror.com`。

如果后续仍遇到基础镜像拉取慢，可以在 Docker Desktop 中配置 Docker Hub 镜像加速器。

## 数据目录策略

系统数据默认放在移动硬盘上的 `.video-vault/` 目录：

```text
.video-vault/
  db/app.sqlite
  thumbnails/
  transcodes/
  subtitles/
  ai/
  config/
  run.lock
```

`MEDIA_ROOT` 是视频目录，只读挂载。

`VAULT_DATA_DIR` 是 `.video-vault` 数据目录，可读写挂载。

换电脑或重装系统时，保留 `.video-vault`，重新配置 `.env` 里的路径即可恢复数据。

## 多电脑使用约定

默认假设同一块移动硬盘不会被两台电脑同时写入。

后端启动时会创建 `run.lock`，用于降低同一数据目录被多个实例同时写入的风险。如果未来要支持真正的多机并发，需要重新设计为 PostgreSQL 或中心化同步服务。

## 视频身份识别

不要依赖绝对路径识别视频，因为移动硬盘在不同电脑上的盘符可能变化。

当前策略：

- 存储相对 `MEDIA_ROOT` 的路径。
- 记录文件大小。
- 记录修改时间。
- 生成 quick fingerprint。
- 异步/扫描时生成 partial strong hash。

后续如果要支持文件改名或跨目录移动后的自动匹配，应增强强 hash 和重绑定逻辑。

## 后端关键文件

- `backend/app/main.py`：FastAPI 应用、API 路由、鉴权依赖、播放接口。
- `backend/app/models.py`：数据库模型。
- `backend/app/media.py`：扫描、ffprobe、缩略图、路径安全、转码、序列化。
- `backend/app/security.py`：单用户 cookie 登录。
- `backend/app/file_lock.py`：移动硬盘数据目录运行锁。
- `backend/app/config.py`：环境变量和数据目录配置。

## 前端关键文件

- `frontend/src/main.tsx`：单页应用主逻辑。
- `frontend/src/styles.css`：界面样式。
- `frontend/package.json`：前端依赖和脚本。

当前前端不是营销页，首屏就是视频资产库工作台，包括：

- 登录。
- 扫描。
- 搜索。
- 视频列表。
- 播放器。
- 标题、备注、标签编辑。
- 收藏。
- 后台任务状态。

## API 约定

已实现的主要接口：

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/libraries/scan`
- `POST /api/libraries/rebind`
- `GET /api/videos`
- `GET /api/videos/{id}`
- `PATCH /api/videos/{id}`
- `GET /api/videos/{id}/thumbnail`
- `GET /api/videos/{id}/stream`
- `POST /api/videos/{id}/progress`
- `POST /api/videos/{id}/favorite`
- `GET /api/tasks`

## AI 扩展预留

当前只预留数据结构和任务类型，不实现实际 AI 推理。

后续方向：

- OCR：抽帧识别画面文字。
- ASR：语音转字幕，优先考虑本地 Whisper。
- 翻译：非中文字幕翻译成中文，保留原文轨道。
- 自动标签：基于标题、字幕、OCR、视觉信息生成标签。
- 自动分类：课程、素材、录屏、直播切片、自拍视频等。
- 语义搜索：基于 OCR、字幕、摘要生成 embedding。

AI 产物需要记录：

- 来源模型。
- 生成时间。
- 置信度。
- 用户是否手动覆盖。

## 重要开发约束

- 不要让任何 API 通过路径参数访问 `MEDIA_ROOT` 或 `VAULT_DATA_DIR` 之外的文件。
- 不要对源视频目录执行写操作。
- 不要把绝对盘符路径写死进数据库作为唯一身份。
- SQLite 当前够用，但数据库访问层要保留未来迁移 PostgreSQL 的可能。
- 前端应保持工具型应用体验，避免做成 landing page。
- 移动端浏览器体验重要，界面必须响应式。

## 当前验证状态

已做过：

- `python -m compileall backend\app` 通过。

未完成：

- 本机没有 `pytest`，所以未运行后端测试。
- 本机没有 `docker` 命令，所以未验证 Docker Compose 启动。
- 尚未做真实视频文件扫描和移动端浏览器测试。
