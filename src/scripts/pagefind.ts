/**
 * Shared Pagefind loader.
 *
 * Two callers now want the index — the ⌘K overlay and the index page's inline
 * filter — and both must get the *same* instance: `init()` is expensive and
 * `debouncedSearch` cancels against its own module state, so two copies would
 * both double the download and stop debouncing each other correctly.
 *
 * The runtime is fetched on first use, never at page load.
 */

export interface PagefindResultData {
  url: string;
  excerpt: string;
  meta: Record<string, string>;
  filters?: Record<string, string[]>;
}

export interface PagefindResult {
  id: string;
  data: () => Promise<PagefindResultData>;
}

export interface PagefindApi {
  init: () => Promise<void>;
  debouncedSearch: (
    query: string | null,
    options?: unknown,
    debounceMs?: number,
  ) => Promise<{ results: PagefindResult[] } | null>;
}

let pagefind: PagefindApi | null = null;
let failed = false;

export async function loadPagefind(): Promise<PagefindApi | null> {
  if (pagefind || failed) return pagefind;
  try {
    // Vite must not try to resolve this — the bundle is produced by the
    // `pagefind` CLI after `astro build`, so it does not exist at build time.
    const path = '/pagefind/pagefind.js';
    const module = (await import(/* @vite-ignore */ path)) as unknown as PagefindApi;
    await module.init();
    pagefind = module;
    return pagefind;
  } catch {
    failed = true;
    return null;
  }
}

/** `/notes/context-overloading/` -> `context-overloading`. */
export function slugFromUrl(url: string): string {
  return url.replace(/[?#].*$/, '').replace(/\/$/, '').split('/').pop() ?? '';
}
