import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Hls from 'hls.js';
import { Heart, LogOut, Play, RefreshCw, Save, Search, Tags } from 'lucide-react';
import './styles.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

type Video = {
  id: number;
  relative_path: string;
  filename: string;
  title: string;
  user_title: string | null;
  notes: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  video_codec: string | null;
  audio_codec: string | null;
  thumbnail_url: string | null;
  favorite: boolean;
  tags: string[];
  is_missing: boolean;
};

type Task = {
  id: number;
  task_type: string;
  status: string;
  message: string | null;
};

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function formatDuration(value: number | null) {
  if (!value) return '--:--';
  const total = Math.floor(value);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function Login({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      onDone();
    } catch {
      setError('登录失败');
    }
  }

  return (
    <main className="loginShell">
      <form className="loginPanel" onSubmit={submit}>
        <h1>Personal Video Vault</h1>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" type="password" />
        {error && <p className="error">{error}</p>}
        <button type="submit">登录</button>
      </form>
    </main>
  );
}

function Player({ video }: { video: Video }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.crossOrigin = 'use-credentials';
    const src = `${API_BASE}/api/videos/${video.id}/stream`;
    let hls: Hls | null = null;
    if (video.filename.toLowerCase().endsWith('.mkv') || video.filename.toLowerCase().endsWith('.avi')) {
      if (Hls.isSupported()) {
        hls = new Hls({ xhrSetup: (xhr) => { xhr.withCredentials = true; } });
        hls.loadSource(src);
        hls.attachMedia(element);
      } else {
        element.src = src;
      }
    } else {
      element.src = src;
    }
    return () => hls?.destroy();
  }, [video.id, video.filename]);

  function saveProgress() {
    const element = ref.current;
    if (!element) return;
    api(`/api/videos/${video.id}/progress`, {
      method: 'POST',
      body: JSON.stringify({
        position_seconds: element.currentTime,
        duration_seconds: Number.isFinite(element.duration) ? element.duration : null,
        device: navigator.userAgent,
      }),
    }).catch(() => {});
  }

  return <video ref={ref} className="player" controls onPause={saveProgress} onTimeUpdate={() => {}} />;
}

function AppShell({ onLogout }: { onLogout: () => void }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selected, setSelected] = useState<Video | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [q, setQ] = useState('');
  const [onlyFav, setOnlyFav] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftTags, setDraftTags] = useState('');

  const filteredTitle = useMemo(() => (onlyFav ? '收藏' : '全部视频'), [onlyFav]);

  async function load() {
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    if (onlyFav) query.set('favorite', 'true');
    const data = await api<{ items: Video[] }>(`/api/videos?${query.toString()}`);
    setVideos(data.items);
    if (selected) {
      const next = data.items.find((item) => item.id === selected.id) || null;
      setSelected(next);
    }
  }

  async function loadTasks() {
    const data = await api<{ items: Task[] }>('/api/tasks');
    setTasks(data.items);
  }

  useEffect(() => {
    load().catch(() => {});
  }, [onlyFav]);

  useEffect(() => {
    const timer = setInterval(() => loadTasks().catch(() => {}), 4000);
    loadTasks().catch(() => {});
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selected) return;
    setDraftTitle(selected.user_title || '');
    setDraftNotes(selected.notes || '');
    setDraftTags(selected.tags.join(', '));
  }, [selected?.id]);

  async function scan() {
    await api('/api/libraries/scan', { method: 'POST', body: '{}' });
    await loadTasks();
  }

  async function toggleFavorite(video: Video) {
    await api(`/api/videos/${video.id}/favorite`, { method: 'POST', body: '{}' });
    await load();
  }

  async function saveSelected() {
    if (!selected) return;
    const updated = await api<Video>(`/api/videos/${selected.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        user_title: draftTitle,
        notes: draftNotes,
        tags: draftTags.split(',').map((item) => item.trim()).filter(Boolean),
      }),
    });
    setSelected(updated);
    await load();
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="brand">
          <h1>Video Vault</h1>
          <button title="退出" onClick={onLogout}><LogOut size={18} /></button>
        </div>
        <div className="search">
          <Search size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="搜索标题、文件名、备注" />
        </div>
        <div className="toolbar">
          <button onClick={load}><RefreshCw size={17} />刷新</button>
          <button onClick={scan}><RefreshCw size={17} />扫描</button>
          <button className={onlyFav ? 'active' : ''} onClick={() => setOnlyFav(!onlyFav)}><Heart size={17} />收藏</button>
        </div>
        <h2>{filteredTitle}</h2>
        <div className="videoList">
          {videos.map((video) => (
            <button key={video.id} className={`videoRow ${selected?.id === video.id ? 'selected' : ''}`} onClick={() => setSelected(video)}>
              <div className="thumb">
                {video.thumbnail_url ? <img src={`${API_BASE}${video.thumbnail_url}`} /> : <Play size={24} />}
              </div>
              <div>
                <strong>{video.title}</strong>
                <span>{formatDuration(video.duration_seconds)} · {video.width && video.height ? `${video.width}x${video.height}` : video.extension}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="content">
        {selected ? (
          <>
            <Player video={selected} />
            <div className="details">
              <div className="titleLine">
                <h2>{selected.title}</h2>
                <button onClick={() => toggleFavorite(selected)} title="收藏">
                  <Heart size={19} fill={selected.favorite ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="meta">
                <span>{selected.relative_path}</span>
                <span>{selected.video_codec || 'unknown video'} / {selected.audio_codec || 'unknown audio'}</span>
              </div>
              <label>自定义名称<input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} /></label>
              <label>标签<Tags size={15} /><input value={draftTags} onChange={(e) => setDraftTags(e.target.value)} placeholder="用逗号分隔" /></label>
              <label>备注<textarea value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} /></label>
              <button className="save" onClick={saveSelected}><Save size={18} />保存元数据</button>
            </div>
          </>
        ) : (
          <div className="emptyState">
            <h2>开始扫描你的移动硬盘视频</h2>
            <button onClick={scan}><RefreshCw size={18} />扫描媒体库</button>
          </div>
        )}
      </section>

      <aside className="tasks">
        <h2>后台任务</h2>
        {tasks.map((task) => (
          <div key={task.id} className="task">
            <strong>{task.task_type}</strong>
            <span>{task.status}</span>
            {task.message && <p>{task.message}</p>}
          </div>
        ))}
      </aside>
    </main>
  );
}

function Root() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    api('/api/auth/me').then(() => setAuthed(true)).catch(() => setAuthed(false));
  }, []);

  async function logout() {
    await api('/api/auth/logout', { method: 'POST', body: '{}' });
    setAuthed(false);
  }

  if (authed === null) return <div className="loading">Loading...</div>;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  return <AppShell onLogout={logout} />;
}

createRoot(document.getElementById('root')!).render(<Root />);
