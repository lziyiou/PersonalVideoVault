import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Hls from 'hls.js';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  FolderCog,
  Heart,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Tags,
  X,
} from 'lucide-react';
import './styles.css';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const PAGE_SIZE = 48;
const SEARCH_DEBOUNCE_MS = 280;

type Video = {
  id: number;
  relative_path: string;
  filename: string;
  extension: string;
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

type TagInfo = {
  name: string;
  count: number;
};

type AppSettings = {
  media_root: string;
  data_root: string;
  username: string;
  config_path: string;
  docker_note: string;
};

type VideoPage = {
  items: Video[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
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

function formatResolution(video: Video) {
  return video.width && video.height ? `${video.width}x${video.height}` : video.extension.replace('.', '').toUpperCase();
}

function normalizeTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

function tagCategory(name: string) {
  const match = name.match(/^([^/:：#]+)[/:：#](.+)$/);
  return match?.[1]?.trim() || '未分类';
}

function TagChip({
  tag,
  active,
  count,
  onClick,
  onRemove,
}: {
  tag: string;
  active?: boolean;
  count?: number;
  onClick?: () => void;
  onRemove?: () => void;
}) {
  return (
    <span className={`tagChip ${active ? 'active' : ''}`}>
      <button type="button" onClick={onClick} title={onClick ? `筛选 ${tag}` : tag}>
        <Tags size={13} />
        <span>{tag}</span>
        {typeof count === 'number' && <em>{count}</em>}
      </button>
      {onRemove && (
        <button className="tagRemove" type="button" onClick={onRemove} title={`移除 ${tag}`}>
          <X size={13} />
        </button>
      )}
    </span>
  );
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
      setError('登录失败，请检查用户名和密码。');
    }
  }

  return (
    <main className="loginShell">
      <form className="loginPanel" onSubmit={submit}>
        <div>
          <span className="eyebrow">Personal Video Vault</span>
          <h1>登录视频资产库</h1>
        </div>
        <label>
          用户名
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>
        <label>
          密码
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primaryButton" type="submit">登录</button>
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

  return <video ref={ref} className="player" controls onPause={saveProgress} />;
}

function VideoCard({ video, selected, onSelect }: { video: Video; selected: boolean; onSelect: (video: Video) => void }) {
  return (
    <button className={`videoCard ${selected ? 'selected' : ''}`} onClick={() => onSelect(video)}>
      <span className="poster">
        {video.thumbnail_url ? <img src={`${API_BASE}${video.thumbnail_url}`} alt="" loading="lazy" /> : <Play size={30} />}
        <span className="duration"><Clock size={13} />{formatDuration(video.duration_seconds)}</span>
        {video.favorite && <span className="favoriteBadge"><Heart size={14} fill="currentColor" /></span>}
      </span>
      <span className="cardTitle">{video.title}</span>
      <span className="cardMeta">{formatResolution(video)}{video.is_missing ? ' · 文件缺失' : ''}</span>
      {video.tags.length > 0 && (
        <span className="cardTags">
          {video.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
        </span>
      )}
    </button>
  );
}

function TagEditor({
  value,
  catalog,
  onChange,
}: {
  value: string[];
  catalog: TagInfo[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const available = catalog.filter((tag) => !value.includes(tag.name)).slice(0, 16);

  function addTag(tag: string) {
    const clean = tag.trim();
    if (!clean) return;
    onChange(normalizeTags([...value, clean]));
    setDraft('');
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(draft);
    }
    if (event.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="tagEditor">
      <div className="tagInputBox">
        {value.map((tag) => (
          <TagChip key={tag} tag={tag} onRemove={() => onChange(value.filter((item) => item !== tag))} />
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={value.length ? '继续添加标签' : '输入标签后按回车'}
        />
        <button type="button" onClick={() => addTag(draft)} title="添加标签"><Plus size={16} /></button>
      </div>
      {available.length > 0 && (
        <div className="tagSuggestions">
          {available.map((tag) => (
            <button key={tag.name} type="button" onClick={() => addTag(tag.name)}>
              {tag.name}<span>{tag.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsPanel({ onSaved }: { onSaved: () => void }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [mediaRoot, setMediaRoot] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api<AppSettings>('/api/settings').then((data) => {
      setSettings(data);
      setMediaRoot(data.media_root);
      setUsername(data.username);
    }).catch(() => setMessage('设置读取失败。'));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      const payload: { media_root?: string; username?: string; password?: string } = {
        media_root: mediaRoot,
        username,
      };
      if (password) payload.password = password;
      const updated = await api<AppSettings>('/api/settings', { method: 'PATCH', body: JSON.stringify(payload) });
      setSettings(updated);
      setPassword('');
      setMessage('设置已保存。修改媒体目录后建议重新扫描。');
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '设置保存失败。');
    }
  }

  return (
    <section className="managementPanel">
      <div className="sectionTitle">
        <FolderCog size={18} />
        <h2>管理</h2>
      </div>
      <form onSubmit={save} className="settingsForm">
        <label>
          媒体目录
          <input value={mediaRoot} onChange={(e) => setMediaRoot(e.target.value)} placeholder="/media" />
        </label>
        <label>
          数据目录
          <input value={settings?.data_root || ''} readOnly />
        </label>
        <label>
          用户名
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>
        <label>
          新密码
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" placeholder="留空则不修改" />
        </label>
        {settings?.docker_note && <p className="hint">{settings.docker_note}</p>}
        {message && <p className="hint">{message}</p>}
        <button className="primaryButton save" type="submit"><Save size={18} />保存设置</button>
      </form>
    </section>
  );
}

function AppShell({ onLogout }: { onLogout: () => void }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selected, setSelected] = useState<Video | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tagCatalog, setTagCatalog] = useState<TagInfo[]>([]);
  const [q, setQ] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [onlyFav, setOnlyFav] = useState(false);
  const [showManagement, setShowManagement] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftTags, setDraftTags] = useState<string[]>([]);

  const libraryTitle = useMemo(() => {
    if (selectedTag) return `标签：${selectedTag}`;
    return onlyFav ? '收藏视频' : '全部视频';
  }, [onlyFav, selectedTag]);

  const tagGroups = useMemo(() => {
    return tagCatalog.reduce<Record<string, TagInfo[]>>((groups, tag) => {
      const category = tagCategory(tag.name);
      groups[category] = groups[category] || [];
      groups[category].push(tag);
      return groups;
    }, {});
  }, [tagCatalog]);

  async function load(targetPage = page) {
    setLoadingVideos(true);
    try {
      const query = new URLSearchParams();
      query.set('page', String(targetPage));
      query.set('page_size', String(PAGE_SIZE));
      if (q.trim()) query.set('q', q.trim());
      if (onlyFav) query.set('favorite', 'true');
      if (selectedTag) query.set('tag', selectedTag);
      const data = await api<VideoPage>(`/api/videos?${query.toString()}`);
      setVideos(data.items);
      setPage(data.page);
      setTotal(data.total);
      setTotalPages(data.total_pages);
      setSelected((current) => {
        if (!current) return data.items[0] || null;
        return data.items.find((item) => item.id === current.id) || data.items[0] || null;
      });
    } finally {
      setLoadingVideos(false);
    }
  }

  async function loadTasks() {
    const data = await api<{ items: Task[] }>('/api/tasks');
    setTasks(data.items);
  }

  async function loadTags() {
    const data = await api<{ items: TagInfo[] }>('/api/tags');
    setTagCatalog(data.items);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load(1).catch(() => {});
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [q, onlyFav, selectedTag]);

  useEffect(() => {
    const timer = setInterval(() => loadTasks().catch(() => {}), 4000);
    loadTasks().catch(() => {});
    loadTags().catch(() => {});
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selected) return;
    setDraftTitle(selected.user_title || '');
    setDraftNotes(selected.notes || '');
    setDraftTags(selected.tags);
  }, [selected?.id]);

  async function scan() {
    await api('/api/libraries/scan', { method: 'POST', body: '{}' });
    await loadTasks();
    await load(1);
    await loadTags();
  }

  async function toggleFavorite(video: Video) {
    const result = await api<{ favorite: boolean }>(`/api/videos/${video.id}/favorite`, { method: 'POST', body: '{}' });
    const updated = { ...video, favorite: result.favorite };
    setSelected((current) => (current?.id === video.id ? updated : current));
    await load(page);
  }

  async function saveSelected() {
    if (!selected) return;
    const updated = await api<Video>(`/api/videos/${selected.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        user_title: draftTitle,
        notes: draftNotes,
        tags: draftTags,
      }),
    });
    setSelected(updated);
    await loadTags();
    await load(page);
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark"><Play size={17} fill="currentColor" /></span>
          <div>
            <h1>Video Vault</h1>
            <p>个人视频资产库</p>
          </div>
        </div>
        <div className="topActions">
          <button onClick={() => load(page)} title="刷新"><RefreshCw size={17} />刷新</button>
          <button onClick={scan} title="扫描媒体"><RefreshCw size={17} />扫描</button>
          <button className={showManagement ? 'active' : ''} onClick={() => setShowManagement(!showManagement)} title="管理">
            <Settings size={17} />管理
          </button>
          <button onClick={onLogout} title="退出登录"><LogOut size={17} />退出</button>
        </div>
      </header>

      <section className="library">
        <div className="libraryHeader">
          <div>
            <span className="eyebrow">{libraryTitle}</span>
            <h2>{total} 个视频</h2>
          </div>
          <div className="search">
            <Search size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索标题、文件名、备注" />
            {q && <button type="button" onClick={() => setQ('')} title="清空搜索"><X size={16} /></button>}
          </div>
          <button className={onlyFav ? 'active' : ''} onClick={() => setOnlyFav(!onlyFav)}>
            <Heart size={17} fill={onlyFav ? 'currentColor' : 'none'} />收藏
          </button>
        </div>

        {tagCatalog.length > 0 && (
          <section className="tagBrowser">
            <div className="tagBrowserHeader">
              <span>按标签分类</span>
              {selectedTag && <button type="button" onClick={() => setSelectedTag(null)}>清除筛选</button>}
            </div>
            {Object.entries(tagGroups).map(([category, tags]) => (
              <div className="tagGroup" key={category}>
                <strong>{category}</strong>
                <div className="tagRail">
                  {tags.map((tag) => (
                    <TagChip
                      key={tag.name}
                      tag={tag.name}
                      count={tag.count}
                      active={selectedTag === tag.name}
                      onClick={() => setSelectedTag(selectedTag === tag.name ? null : tag.name)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        <div className="videoGrid" aria-busy={loadingVideos}>
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} selected={selected?.id === video.id} onSelect={setSelected} />
          ))}
        </div>

        {!loadingVideos && videos.length === 0 && (
          <div className="emptyState">
            <h2>还没有可展示的视频</h2>
            <p>扫描媒体库后，这里会以封面网格展示你的视频。</p>
            <button className="primaryButton" onClick={scan}><RefreshCw size={18} />扫描媒体库</button>
          </div>
        )}

        <div className="pagination">
          <button disabled={page <= 1} onClick={() => load(page - 1)}><ChevronLeft size={17} />上一页</button>
          <span>第 {page} / {totalPages} 页</span>
          <button disabled={page >= totalPages} onClick={() => load(page + 1)}>下一页<ChevronRight size={17} /></button>
        </div>
      </section>

      <aside className="detailsPanel">
        {showManagement ? (
          <SettingsPanel onSaved={() => { load(1).catch(() => {}); loadTags().catch(() => {}); }} />
        ) : selected ? (
          <>
            <Player video={selected} />
            <div className="details">
              <div className="titleLine">
                <div>
                  <h2>{selected.title}</h2>
                  <p>{selected.relative_path}</p>
                </div>
                <button onClick={() => toggleFavorite(selected)} title="收藏">
                  <Heart size={19} fill={selected.favorite ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="meta">
                <span>{formatDuration(selected.duration_seconds)}</span>
                <span>{formatResolution(selected)}</span>
                <span>{selected.video_codec || 'unknown video'} / {selected.audio_codec || 'unknown audio'}</span>
              </div>
              <label>自定义名称<input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} /></label>
              <label>
                标签
                <TagEditor value={draftTags} catalog={tagCatalog} onChange={setDraftTags} />
              </label>
              <label>备注<textarea value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} /></label>
              <button className="primaryButton save" onClick={saveSelected}><Save size={18} />保存元数据</button>
            </div>
          </>
        ) : (
          <div className="emptyState compact">
            <h2>选择一个封面开始播放</h2>
            <p>名称只是辅助，主要从封面判断内容。</p>
          </div>
        )}

        <section className="tasks">
          <h2>后台任务</h2>
          {tasks.length === 0 && <p className="muted">暂无任务</p>}
          {tasks.map((task) => (
            <div key={task.id} className="task">
              <strong>{task.task_type}</strong>
              <span>{task.status}</span>
              {task.message && <p>{task.message}</p>}
            </div>
          ))}
        </section>
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

  if (authed === null) return <div className="loading">加载中...</div>;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  return <AppShell onLogout={logout} />;
}

createRoot(document.getElementById('root')!).render(<Root />);
