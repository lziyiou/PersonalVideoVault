import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'video-vault-theme';

function getStored(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'dark';
  } catch {
    return 'dark';
  }
}

function emitChange() {
  // empty - used as a notification handle
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

function applyTheme(theme: string) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch { /* ignore */ }
  listeners.forEach((cb) => cb());
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot);

  const toggle = useCallback(() => {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme]);

  const setTheme = useCallback((t: string) => {
    applyTheme(t);
  }, []);

  return { theme, toggle, setTheme, isDark: theme === 'dark' };
}

// Call once on app init
const stored = getStored();
applyTheme(stored);
