import { useCallback, useSyncExternalStore } from 'react';
import { STORAGE_KEYS } from '@/lib/constants';

type Theme = 'dark' | 'light';

function getSnapshot(): Theme {
  return (localStorage.getItem(STORAGE_KEYS.theme) as Theme) || 'dark';
}

function getServerSnapshot(): Theme {
  return 'dark';
}

function subscribe(onStoreChange: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEYS.theme) onStoreChange();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
  }
}

// Apply theme on load
applyTheme(getSnapshot());

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEYS.theme, next);
    applyTheme(next);
    // Force re-render by dispatching storage event on same window
    window.dispatchEvent(
      new StorageEvent('storage', { key: STORAGE_KEYS.theme, newValue: next })
    );
  }, [theme]);

  return { theme, toggleTheme } as const;
}
