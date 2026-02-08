import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'rescuelink_theme';

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
  } catch {
    return 'dark';
  }
}

const ThemeContext = createContext({ theme: 'dark', setTheme: () => {}, toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getStoredTheme);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-swal2-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-swal2-theme');
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  const setTheme = (next) => {
    setThemeState(next === 'light' ? 'light' : 'dark');
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
