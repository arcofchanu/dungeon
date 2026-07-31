const STORAGE_KEY = 'yozakura-theme';

function currentTheme(): 'light' | 'dark' {
  const stamped = document.documentElement.dataset.theme;
  if (stamped === 'light' || stamped === 'dark') return stamped;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function initTheme() {
  const toggle = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  if (!toggle) return;

  const sync = () => {
    const theme = currentTheme();
    toggle.setAttribute('aria-pressed', String(theme === 'light'));
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#FAF3F5' : '#16121C';
  };

  toggle.addEventListener('click', () => {
    /* The toggle is a hanging lantern, and a lantern can be swung. src/scripts/
       lantern.ts marks the click that ends a drag; that is a push, not a
       choice, and the lights stay as they are. */
    if (toggle.dataset.lanternDrag !== undefined) return;

    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode — the choice just won't persist */
    }
    sync();
  });

  sync();
}
