import { Link } from 'react-router-dom';
import { Clock, Heart, Play } from 'lucide-react';
import { API_BASE } from '../constants';
import { formatDuration } from '../utils';
import type { Video } from '../types';

export function VideoCard({ video }: { video: Video }) {
  return (
    <Link to={`/watch/${video.id}`} className="videoCard">
      <span className="poster">
        {video.thumbnail_url ? (
          <img src={`${API_BASE}${video.thumbnail_url}`} alt="" loading="lazy" />
        ) : (
          <span className="posterPlaceholder"><Play size={32} /></span>
        )}
        <span className="posterOverlay">
          <span className="playOverlayBtn">
            <Play size={22} fill="currentColor" />
          </span>
        </span>
        <span className="duration"><Clock size={11} />{formatDuration(video.duration_seconds)}</span>
        {video.favorite && <span className="favoriteBadge"><Heart size={12} fill="currentColor" /></span>}
        {video.is_missing && <span className="missingBadge">文件缺失</span>}
      </span>
      <span className="cardTitle">{video.title}</span>
    </Link>
  );
}
