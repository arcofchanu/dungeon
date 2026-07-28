/**
 * Pagefind-backed search overlay (§8).
 *
 * Pagefind's runtime is fetched on first open, not at page load, so the
 * always-on cost of the most important feature on the site is one keydown
 * listener. `⌘K` / `Ctrl+K` / `/` open, `Esc` closes, arrows navigate, focus is
 * trapped while open and returned to the trigger on close.
 */

interface PagefindResultData {
  url: string;
  excerpt: string;
  meta: Record<string, string>;
  filters?: Record<string, string[]>;
}

interface PagefindResult {
  id: string;
  data: () => Promise<PagefindResultData>;
}

interface PagefindApi {
  init: () => Promise<void>;
  debouncedSearch: (
    query: string | null,
    options?: unknown,
    debounceMs?: number,
  ) => Promise<{ results: PagefindResult[] } | null>;
}

const MAX_RESULTS = 20;

let pagefind: PagefindApi | null = null;
let pagefindFailed = false;

async function loadPagefind(): Promise<PagefindApi | null> {
  if (pagefind || pagefindFailed) return pagefind;
  try {
    // Vite must not try to resolve this — the bundle is produced by the
    // `pagefind` CLI after `astro build`, so it does not exist at build time.
    const path = `${import.meta.env.BASE_URL}pagefind/pagefind.js`;
    const module = (await import(/* @vite-ignore */ path)) as unknown as PagefindApi;
    await module.init();
    pagefind = module;
    return pagefind;
  } catch {
    pagefindFailed = true;
    return null;
  }
}

export function initSearch() {
  const root = document.querySelector<HTMLElement>('[data-search]');
  const input = document.querySelector<HTMLInputElement>('[data-search-input]');
  const resultsEl = document.querySelector<HTMLUListElement>('[data-search-results]');
  const statusEl = document.querySelector<HTMLElement>('[data-search-status]');
  if (!root || !input || !resultsEl || !statusEl) return;

  const dismissers = Array.from(root.querySelectorAll<HTMLElement>('[data-search-dismiss]'));
  const triggers = Array.from(document.querySelectorAll<HTMLElement>('[data-search-open]'));

  let open = false;
  let activeIndex = -1;
  let lastFocused: HTMLElement | null = null;
  let token = 0;

  function setStatus(text: string) {
    statusEl!.textContent = text;
  }

  function focusableInPanel(): HTMLElement[] {
    return Array.from(
      root!.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null || el === input);
  }

  function openSearch() {
    if (open) return;
    open = true;
    lastFocused = document.activeElement as HTMLElement | null;
    root!.hidden = false;
    document.body.style.overflow = 'hidden';
    input!.focus();
    setStatus('');
    void loadPagefind();
    animatePlaceholder();
  }

  function closeSearch() {
    if (!open) return;
    open = false;
    root!.hidden = true;
    document.body.style.overflow = '';
    input!.value = '';
    root!.classList.remove('is-typing');
    resultsEl!.replaceChildren();
    activeIndex = -1;
    setStatus('');
    lastFocused?.focus();
  }

  /** The third and final animation (§8): char-stagger on the placeholder. */
  function animatePlaceholder() {
    const placeholder = root!.querySelector<HTMLElement>('[data-search-placeholder]');
    if (!placeholder) return;
    if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
    import('./motion')
      .then((m) => m.animatePlaceholderChars(placeholder))
      .catch(() => {
        /* placeholder just appears — no loss of function */
      });
  }

  function renderResults(items: PagefindResultData[], query: string) {
    resultsEl!.replaceChildren();
    activeIndex = items.length > 0 ? 0 : -1;

    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'result';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(index === 0));
      if (index === 0) li.classList.add('is-active');

      const link = document.createElement('a');
      link.className = 'result-link';
      link.href = item.url;

      const meta = document.createElement('p');
      meta.className = 'result-meta';
      const date = item.meta?.date ?? '';
      const reading = item.meta?.reading ?? '';
      meta.textContent = [date, reading].filter(Boolean).join(' · ');

      const title = document.createElement('p');
      title.className = 'result-title';
      title.textContent = item.meta?.title ?? item.url;

      const excerpt = document.createElement('p');
      excerpt.className = 'result-excerpt';
      // Pagefind returns its own <mark> tags around matches; it escapes the
      // surrounding content itself, and the corpus is this repo's own notes.
      excerpt.innerHTML = item.excerpt;

      link.append(meta, title, excerpt);
      li.append(link);
      resultsEl!.append(li);
    });

    setStatus(
      items.length === 0
        ? `No results for “${query}”`
        : `${items.length}${items.length === MAX_RESULTS ? '+' : ''} ${
            items.length === 1 ? 'result' : 'results'
          }`,
    );
  }

  function setActive(next: number) {
    const options = Array.from(resultsEl!.querySelectorAll<HTMLElement>('.result'));
    if (options.length === 0) return;
    const clamped = (next + options.length) % options.length;
    options.forEach((option, index) => {
      option.classList.toggle('is-active', index === clamped);
      option.setAttribute('aria-selected', String(index === clamped));
    });
    activeIndex = clamped;
    options[clamped].scrollIntoView({ block: 'nearest' });
  }

  async function runSearch(query: string) {
    const mine = ++token;
    root!.classList.toggle('is-typing', query.length > 0);

    if (query.trim().length === 0) {
      resultsEl!.replaceChildren();
      setStatus('');
      return;
    }

    const api = await loadPagefind();
    if (mine !== token) return;

    if (!api) {
      setStatus('Search index unavailable — run `npm run build` to generate it.');
      return;
    }

    const response = await api.debouncedSearch(query, undefined, 120);
    if (mine !== token || response === null) return;

    const items = await Promise.all(response.results.slice(0, MAX_RESULTS).map((r) => r.data()));
    if (mine !== token) return;
    renderResults(items, query);
  }

  input.addEventListener('input', () => void runSearch(input.value));

  for (const trigger of triggers) trigger.addEventListener('click', openSearch);
  for (const dismisser of dismissers) dismisser.addEventListener('click', closeSearch);

  document.addEventListener('keydown', (event) => {
    // Open: ⌘K / Ctrl+K anywhere, `/` when not already typing somewhere.
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      open ? closeSearch() : openSearch();
      return;
    }

    if (!open) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;
      if (event.key === '/' && !typing) {
        event.preventDefault();
        openSearch();
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        closeSearch();
        break;
      case 'ArrowDown':
        event.preventDefault();
        setActive(activeIndex + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive(activeIndex - 1);
        break;
      case 'Enter': {
        const active = resultsEl.querySelector<HTMLAnchorElement>('.result.is-active .result-link');
        if (active) {
          event.preventDefault();
          window.location.href = active.href;
        }
        break;
      }
      case 'Tab': {
        // Focus is trapped while open (§8).
        const focusable = focusableInPanel();
        if (focusable.length === 0) break;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        break;
      }
    }
  });
}
