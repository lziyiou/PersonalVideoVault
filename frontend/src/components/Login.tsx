import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { api } from '../api';

export function Login({ onDone }: { onDone: () => void }) {
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
        <div className="loginBrand">
          <span className="loginMark">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </span>
          <div>
            <span className="eyebrow">Personal Video Vault</span>
            <h1>登录视频资产库</h1>
          </div>
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
        <button className="primaryButton" type="submit">
          <LogIn size={17} />
          登录
        </button>
      </form>
    </main>
  );
}
