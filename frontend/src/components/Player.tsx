import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { API_BASE } from '../constants';
import { api } from '../api';
import type { Video } from '../types';

export function Player({ video }: { video: Video }) {
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
