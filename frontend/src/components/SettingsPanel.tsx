import { useEffect, useState } from 'react';
import { FolderCog, Save } from 'lucide-react';
import { api } from '../api';
import type { AppSettings } from '../types';

export function SettingsPanel({ onSaved }: { onSaved: (authChanged: boolean) => void }) {
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
      setMessage(updated.auth_changed ? '账号设置已保存，请重新登录。' : '设置已保存。修改媒体目录后建议重新扫描。');
      onSaved(Boolean(updated.auth_changed));
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
          配置文件
          <input value={settings?.config_path || ''} readOnly />
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
