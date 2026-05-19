import type { Video } from './types';

export function formatDuration(value: number | null) {
  if (!value) return '--:--';
  const total = Math.floor(value);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function formatResolution(video: Video) {
  return video.width && video.height ? `${video.width}x${video.height}` : video.extension.replace('.', '').toUpperCase();
}

export function normalizeTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

export function tagCategory(name: string) {
  const match = name.match(/^([^/:：#]+)[/:：#](.+)$/);
  return match?.[1]?.trim() || '未分类';
}
