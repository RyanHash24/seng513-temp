import { useEffect, useState } from 'react';

function readAuthTheme(): 'light' | 'dark' {
  let preference = 'dark';
  try {
    const saved = JSON.parse(localStorage.getItem('finclear-appearance') || 'null');
    if (saved?.theme === 'light' || saved?.theme === 'system') preference = saved.theme;
  } catch {
    // Use the app's default appearance when browser storage is unavailable.
  }
  return preference === 'light' ||
    (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches === false)
    ? 'light'
    : 'dark';
}

export function useAuthTheme() {
  const [theme, setTheme] = useState(readAuthTheme);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setTheme(readAuthTheme());
    const storage = (event: StorageEvent) => {
      if (event.key === 'finclear-appearance' || event.key === null) update();
    };
    media.addEventListener('change', update);
    window.addEventListener('storage', storage);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('storage', storage);
    };
  }, []);
  return theme;
}
