import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { api } from './api';
import { Login } from './components/Login';
import { AppShell } from './components/AppShell';
import './styles.css';

function Root() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    api('/api/auth/me').then(() => setAuthed(true)).catch(() => setAuthed(false));
  }, []);

  async function logout() {
    await api('/api/auth/logout', { method: 'POST', body: '{}' });
    setAuthed(false);
  }

  if (authed === null) {
    return (
      <div className="loadingShell">
        <div className="loadingSpinner" />
        <p>加载中...</p>
      </div>
    );
  }
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  return (
    <BrowserRouter>
      <AppShell onLogout={logout} onSessionExpired={() => setAuthed(false)} />
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
