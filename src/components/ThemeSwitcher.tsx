import { useState, useEffect, useCallback } from 'react';
import { memo } from 'react';

const ThemeSwitcher = memo(() => {
  const [theme, setTheme] = useState(() => {
    // Check if there's a saved theme preference
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        return savedTheme;
      }
      // Check system preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    // Apply theme to document immediately - no delays or async operations
    const applyTheme = () => {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      // Save theme preference
      localStorage.setItem('theme', theme);
    };
    
    // Apply immediately, then also use requestAnimationFrame for smooth visual update
    applyTheme();
    requestAnimationFrame(applyTheme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    // Use flushSync to ensure immediate state update
    setTheme(prevTheme => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';
      // Apply theme immediately to prevent any delay
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('theme', newTheme);
      return newTheme;
    });
  }, []);

  return (
    <button 
      onClick={toggleTheme} 
      className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 shadow-sm"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <span className="text-lg">
        {theme === 'light' ? '🌙' : '☀️'}
      </span>
    </button>
  );
});

export default ThemeSwitcher;