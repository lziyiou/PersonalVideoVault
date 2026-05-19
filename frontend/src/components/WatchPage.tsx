import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, Save } from 'lucide-react';
import { api } from '../api';
import { API_BASE } from '../constants';
import { formatDuration, formatResolution, normalizeTags } from '../utils';
import type { Video, TagInfo } from '../types';
import { Player } from './Player';
import { TagEditor } from './TagEditor';

export function WatchPage({ onBack }: { onBack: () => void }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [tagCatalog, setTagCatalog] = useState<TagInfo[]>([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftTags, setDraftTags] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api<Video>(`/api/videos/${id}`)
      .then((data) => {
        setVideo(data);
        setDraftTitle(data.user_title || '');
        setDraftNotes(data.notes || '');
        setDraftTags(data.tags);
      })
      .catch(() => navigate('/', { replace: true }))
      .finally(() => setLoading(false));
    api<{ items: TagInfo[] }>('/api/tags')
      .then((data) => setTagCatalog(data.items))
      .catch(() => {});
  }, [id]);

  async function toggleFavorite() {
    if (!video) return;
    const result = await api<{ favorite: boolean }>(`/api/videos/${video.id}/favorite`, { method: 'POST', body: '{}' });
    setVideo({ ...video, favorite: result.favorite });
  }

  async function saveMetadata() {
    if (!video) return;
    const updated = await api<Video>(`/api/videos/${video.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        user_title: draftTitle,
        notes: draftNotes,
        tags: draftTags,
      }),
    });
    setVideo(updated);
  }

  if (loading) {
    return (
      <div className="loadingShell" style={{ minHeight: 'calc(100vh - 60px)' }}>
        <div className="loadingSpinner" />
        <p>加载视频...</p>
      </div>
    );
  }

  if (!video) return null;

  return (
    <div className="watchPage">
      <button className="watchBack" onClick={onBack}>
        <ArrowLeft size={18} />
        返回视频库
      </button>

      <div className="watchPlayerWrapper">
        <Player video={video} />
      </div>

      <div className="watchInfo">
        <div className="watchTitleRow">
          <div>
            <h1>{video.title}</h1>
            <div className="watchMeta" style={{ marginTop: 6 }}>
              {video.duration_seconds && (
                <>
                  <span>{formatDuration(video.duration_seconds)}</span>
                  <span className="watchMetaSeparator" />
                </>
              )}
              <span>{formatResolution(video)}</span>
              <span className="watchMetaSeparator" />
              <span className="watchMetaChip">{video.video_codec || 'unknown'} / {video.audio_codec || 'unknown'}</span>
              <span className="watchPath">{video.relative_path}</span>
            </div>
          </div>
          <div className="watchActions">
            <button className="watchFavBtn" onClick={toggleFavorite} title={video.favorite ? '取消收藏' : '收藏'}>
              <Heart size={18} fill={video.favorite ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        <div className="watchSection">
          <h3 className="watchSectionTitle">自定义名称</h3>
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="为视频设置自定义名称..."
          />
        </div>

        <div className="watchSection">
          <h3 className="watchSectionTitle">标签</h3>
          <TagEditor value={draftTags} catalog={tagCatalog} onChange={setDraftTags} />
        </div>

        <div className="watchSection">
          <h3 className="watchSectionTitle">备注</h3>
          <textarea
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            placeholder="添加备注..."
          />
        </div>

        <button className="primaryButton save" onClick={saveMetadata} style={{ marginTop: 4 }}>
          <Save size={17} />
          保存元数据
        </button>
      </div>
    </div>
  );
}
