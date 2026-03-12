/**
 * Video Converter Pro (Web) - Theme Manager
 * Light/dark mode toggle with system preference detection
 */

const STORAGE_KEY = 'vcp-theme';

export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');

  applyTheme(theme);

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem(STORAGE_KEY, next);
  applyTheme(next);
  return next;
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.content = theme === 'dark' ? '#0f0f1a' : '#ffffff';
  }
}

export function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}
