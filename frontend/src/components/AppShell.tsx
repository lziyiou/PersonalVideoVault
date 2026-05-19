import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  LogOut,
  Moon,
  Play,
  RefreshCw,
  Search,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { api } from '../api';
import { PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '../constants';
import type { Video, Task, TagInfo, VideoPage } from '../types';
import { useTheme } from '../useTheme';
import { VideoCard } from './VideoCard';
import { Sidebar } from './Sidebar';
import { WatchPage } from './WatchPage';
import { SettingsPanel } from './SettingsPanel';

export function AppShell({ onLogout, onSessionExpired }: { onLogout: () => void; onSessionExpired: () => void }) {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Video[]>([]);
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
  const { isDark, toggle: toggleTheme } = useTheme();

  const libraryTitle = (() => {
    if (selectedTag) return `标签：${selectedTag}`;
    return onlyFav ? '收藏视频' : '全部视频';
  })();

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

  async function scan() {
    await api('/api/libraries/scan', { method: 'POST', body: '{}' });
    await loadTasks();
    await load(1);
    await loadTags();
  }

  function handleSelectTag(tag: string | null) {
    setSelectedTag(tag);
    setShowManagement(false);
  }

  function handleToggleFav() {
    setOnlyFav(!onlyFav);
    setShowManagement(false);
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark">
            <Play size={17} fill="currentColor" />
          </span>
          <h1>Video Vault</h1>
        </div>

        <div className="topCenter">
          <div className="searchBox">
            <Search size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索标题、标签、备注..." />
            {q && <button type="button" className="searchClear" onClick={() => setQ('')}><X size={15} /></button>}
          </div>
        </div>

        <div className="topActions">
          <button onClick={() => load(page)} title="刷新"><RefreshCw size={15} /></button>
          <button onClick={scan} title="扫描媒体库"><Search size={15} />扫描</button>
          <button className={showManagement ? 'active' : ''} onClick={() => {
            setShowManagement(!showManagement);
            if (!showManagement) navigate('/');
          }} title="管理">
            <Settings size={15} />
          </button>
          <button onClick={toggleTheme} title={isDark ? '切换日间模式' : '切换夜间模式'}>
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button onClick={onLogout} title="退出登录"><LogOut size={15} /></button>
        </div>
      </header>

      <Sidebar
        tagCatalog={tagCatalog}
        selectedTag={selectedTag}
        onlyFav={onlyFav}
        onSelectTag={handleSelectTag}
        onToggleFav={handleToggleFav}
        totalVideos={total}
      />

      <div className="mainContent">
        <Routes>
          <Route path="/" element={
            showManagement ? (
              <SettingsPanel onSaved={(authChanged) => {
                if (authChanged) {
                  onSessionExpired();
                  return;
                }
                load(1).catch(() => {});
                loadTags().catch(() => {});
              }} />
            ) : (
              <>
                <div className="libraryHeader">
                  <div className="libraryTitle">
                    <span className="eyebrow">{libraryTitle}</span>
                    <h2>{total} 个视频</h2>
                  </div>
                  <div className="libraryControls">
                    <button className={`favToggle ${onlyFav ? 'active' : ''}`} onClick={() => setOnlyFav(!onlyFav)}>
                      <Heart size={15} fill={onlyFav ? 'currentColor' : 'none'} />仅收藏
                    </button>
                  </div>
                </div>

                <div className="videoGrid" aria-busy={loadingVideos}>
                  {videos.map((video) => (
                    <VideoCard key={video.id} video={video} />
                  ))}
                </div>

                {!loadingVideos && videos.length === 0 && (
                  <div className="emptyState">
                    <div className="emptyIcon"><Play size={36} /></div>
                    <h2>还没有可展示的视频</h2>
                    <p>扫描媒体库后，这里会以封面网格展示你的视频。</p>
                    <button className="primaryButton" onClick={scan}><RefreshCw size={17} />扫描媒体库</button>
                  </div>
                )}

                {totalPages > 1 && (
                  <div className="pagination">
                    <button disabled={page <= 1} onClick={() => load(page - 1)}><ChevronLeft size={17} />上一页</button>
                    <span>第 {page} / {totalPages} 页</span>
                    <button disabled={page >= totalPages} onClick={() => load(page + 1)}>下一页<ChevronRight size={17} /></button>
                  </div>
                )}

                <section className="tasksSection" style={{ marginTop: 24 }}>
                  <h2>后台任务</h2>
                  {tasks.length === 0 && <p className="muted">暂无任务</p>}
                  <div className="tasksList">
                    {tasks.map((task) => (
                      <div key={task.id} className="task">
                        <div className="taskHeader">
                          <strong>{task.task_type}</strong>
                          <span className={`taskStatus ${task.status}`}>{task.status}</span>
                        </div>
                        {task.message && <p>{task.message}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )
          } />
          <Route path="/watch/:id" element={<WatchPage onBack={() => navigate('/')} />} />
        </Routes>
      </div>
    </main>
  );
}
