export type Video = {
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

export type Task = {
  id: number;
  task_type: string;
  status: string;
  message: string | null;
};

export type TagInfo = {
  name: string;
  count: number;
};

export type AppSettings = {
  media_root: string;
  data_root: string;
  username: string;
  config_path: string;
  docker_note: string;
  auth_changed?: boolean;
};

export type VideoPage = {
  items: Video[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};
