# Personal Video Vault

一个面向个人使用的、可随移动硬盘迁移的本地视频资产管理系统。它用于统一管理硬盘里的非结构化视频资源，例如自拍视频、录屏、课程录像、网络下载内容、直播切片、素材文件等。

系统会把数据库、缩略图、转码缓存、字幕和未来 AI 产物保存到 `.video-vault` 数据目录中。只要这个目录跟随移动硬盘一起保存，换电脑或重装系统后就可以快速恢复已有的标题、标签、封面、播放记录和处理结果。

## 当前功能

- 扫描 `mp4`、`mkv`、`mov`、`avi`、`webm`、`m3u8` 视频文件。
- 使用 `ffprobe` 提取时长、分辨率、编码、音轨等元数据。
- 使用 `ffmpeg` 生成缩略图。
- 使用 SQLite 保存可迁移数据库。
- 使用相对路径、文件大小、修改时间和文件指纹识别视频。
- 单用户登录。
- 视频列表、搜索、详情编辑、手动标签、收藏、播放进度。
- 浏览器兼容格式优先直接播放。
- 不兼容格式按需转码为 HLS。
- 预留 OCR、语音转字幕、翻译、语义搜索、自动标签和自动分类的数据结构。

## 目录结构

```text
.
  backend/              FastAPI 后端
  frontend/             React 前端
  docker-compose.yml    Docker 编排文件
  .env.example          环境变量示例
```

移动硬盘上的数据目录建议如下：

```text
.video-vault/
  db/app.sqlite         主数据库
  thumbnails/           封面和缩略图
  transcodes/           HLS 转码缓存
  subtitles/            字幕和翻译结果
  ai/                   OCR、ASR、Embedding、分类等 AI 产物
  config/               配置和路径绑定信息
  run.lock              运行锁，避免多电脑同时写入
```

源视频目录会以只读方式挂载。系统不会移动、重命名或删除原始视频文件。

## 启动前准备

你需要先安装：

- Docker Desktop
- Git 可选，但当前项目不强制需要

然后准备两个路径：

- `MEDIA_ROOT`：视频所在目录，例如移动硬盘里的 `Videos` 文件夹。
- `VAULT_DATA_DIR`：系统数据目录，例如同一块移动硬盘里的 `.video-vault` 文件夹。

推荐让这两个目录都放在移动硬盘上：

```text
移动硬盘/
  Videos/
    example.mp4
    course.mkv
  .video-vault/
```

## 启动方式

1. 复制环境变量文件：

```powershell
Copy-Item .env.example .env
```

2. 编辑 `.env`，把路径改成你的真实路径。例如：

```env
MEDIA_ROOT=E:/Videos
VAULT_DATA_DIR=E:/.video-vault
VAULT_USERNAME=admin
VAULT_PASSWORD=请改成你自己的密码
SECRET_KEY=请改成一串随机字符
```

3. 启动项目：

```powershell
docker compose up --build
```

4. 打开浏览器访问：

```text
http://localhost:5173
```

默认登录信息来自 `.env`：

- 用户名：`VAULT_USERNAME`
- 密码：`VAULT_PASSWORD`

登录后点击“扫描”，系统会索引 `MEDIA_ROOT` 里的视频。

## 局域网设备访问

如果要让 iPhone、iPad、Android 或另一台电脑访问，需要让它们和服务电脑在同一个 Wi-Fi/局域网内。

在服务电脑上查看局域网 IP，例如 `192.168.1.23`，然后在其他设备浏览器打开：

```text
http://192.168.1.23:5173
```

如果无法访问，通常需要检查：

- Windows 防火墙是否允许 Docker 或 5173/8000 端口。
- 手机和平板是否与电脑处于同一局域网。
- Docker Desktop 是否正在运行。

## 换电脑或重装系统后恢复

1. 安装 Docker Desktop。
2. 把移动硬盘接到电脑上。
3. 保留原来的 `.video-vault` 目录。
4. 在 `.env` 中重新设置新的 `MEDIA_ROOT` 和 `VAULT_DATA_DIR`。
5. 运行 `docker compose up --build`。

只要 `.video-vault` 没丢，数据库、标签、标题、缩略图、字幕和 AI 产物就能继续使用。

## 注意事项

- 第一版默认只有一个用户。
- 第一版只支持局域网访问，不建议直接暴露到公网。
- 同一块移动硬盘不要在两台电脑上同时运行服务写入。
- 如果检测到 `.video-vault/run.lock`，说明可能已有实例在使用这个数据目录。
- SQLite 适合当前个人单机使用；后续需要多用户、多机并发或更强搜索能力时，可以迁移到 PostgreSQL。

