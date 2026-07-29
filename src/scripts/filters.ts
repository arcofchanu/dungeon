/**
 * The index's filtering: tag facets and the free-text query, in one pass.
 *
 * Selection semantics are the conventional faceted ones: OR within a group,
 * AND across groups, AND against the query. Rows are server-rendered and
 * filtered in the DOM, so this is instant, works offline, and preserves date
 * ordering. Both this and the ⌘K overlay read the same Pagefind index and the
 * same frontmatter tags, so there is still one taxonomy (§8) — see the
 * deviation note in README.md.
 *
 * The query runs twice per keystroke on purpose: a synchronous pass over
 * title/tag/summary text lands in the same frame you typed in, then Pagefind's
 * full-text answer folds in when it resolves and can only *add* rows. Typing a
 * title is never gated on a network round trip, and body-only matches still
 * turn up a moment later.
 */

import { loadPagefind, slugFromUrl } from './pagefind';

const NAMESPACES = new Set(['type', 'model', 'comp']);

function groupOf(rawTag: string): string {
  const separator = rawTag.indexOf(':');
  if (separator > 0) {
    const prefix = rawTag.slice(0, separator);
    if (NAMESPACES.has(prefix)) return prefix;
  }
  return 'tag';
}

export function initFilters() {
  const rail = document.querySelector<HTMLElement>('[data-filter-rail]');
  const list = document.querySelector<HTMLElement>('[data-note-list]');
  if (!rail || !list) return;

  const rows = Array.from(list.querySelectorAll<HTMLElement>('[data-note]'));
  const buttons = Array.from(rail.querySelectorAll<HTMLButtonElement>('[data-filter-tag]'));
  const countEl = document.querySelector<HTMLElement>('[data-visible-count]');
  const railCountEl = rail.querySelector<HTMLElement>('[data-filter-count]');
  const emptyEl = document.querySelector<HTMLElement>('[data-empty]');
  const clearBtn = rail.querySelector<HTMLButtonElement>('[data-filter-clear]');
  const openBtn = document.querySelector<HTMLButtonElement>('[data-filter-open]');
  const closeBtns = Array.from(rail.querySelectorAll<HTMLButtonElement>('[data-filter-close]'));

  const queryInput = document.querySelector<HTMLInputElement>('[data-note-query]');
  const queryStatus = document.querySelector<HTMLElement>('[data-query-status]');
  const queryClear = document.querySelector<HTMLButtonElement>('[data-query-clear]');

  const selected = new Set<string>();
  let query = '';
  /** Slugs Pagefind matched for the current query; null until it answers. */
  let bodyHits: Set<string> | null = null;
  let queryToken = 0;

  // Precompute each row's tag set and searchable text once — filtering is then
  // pure set lookups and one `includes`.
  const rowTags = new Map<HTMLElement, Set<string>>(
    rows.map((row) => [row, new Set((row.dataset.tags ?? '').split(' ').filter(Boolean))]),
  );
  const rowText = new Map<HTMLElement, string>(
    rows.map((row) => [row, `${row.textContent ?? ''} ${row.dataset.tags ?? ''}`.toLowerCase()]),
  );

  function matchesQuery(row: HTMLElement): boolean {
    if (!query) return true;
    if ((rowText.get(row) ?? '').includes(query)) return true;
    const slug = row.dataset.slug;
    return slug !== undefined && bodyHits !== null && bodyHits.has(slug);
  }

  function apply() {
    const byGroup = new Map<string, string[]>();
    for (const tag of selected) {
      const group = groupOf(tag);
      byGroup.set(group, [...(byGroup.get(group) ?? []), tag]);
    }

    let visible = 0;
    for (const row of rows) {
      const tags = rowTags.get(row)!;
      let matches = matchesQuery(row);
      if (matches) {
        for (const group of byGroup.values()) {
          if (!group.some((tag) => tags.has(tag))) {
            matches = false;
            break;
          }
        }
      }
      row.hidden = !matches;
      if (matches) visible += 1;
    }

    const label = `${visible} ${visible === 1 ? 'note' : 'notes'}`;
    if (countEl) countEl.textContent = label;
    if (railCountEl) railCountEl.textContent = label;
    if (emptyEl) {
      emptyEl.hidden = visible !== 0;
      emptyEl.textContent = query
        ? `No notes match “${queryInput?.value ?? query}”.`
        : 'No notes match those filters.';
    }
    if (clearBtn) clearBtn.hidden = selected.size === 0;
    if (queryClear) queryClear.hidden = query.length === 0;
    if (queryStatus) {
      queryStatus.textContent = query
        ? `${label} · results below`
        : `${rows.length} ${rows.length === 1 ? 'note' : 'notes'} in the archive`;
    }

    const params = new URLSearchParams(window.location.search);
    params.delete('tag');
    for (const tag of selected) params.append('tag', tag);
    params.delete('q');
    if (query) params.set('q', queryInput?.value ?? query);
    const search = params.toString();
    history.replaceState(null, '', search ? `?${search}` : window.location.pathname);
  }

  /** Ask Pagefind for body matches, then widen the current result set. */
  async function widenWithBodies(raw: string) {
    const mine = ++queryToken;
    const api = await loadPagefind();
    if (mine !== queryToken || !api) return;

    const response = await api.debouncedSearch(raw, undefined, 140);
    // null means a later keystroke superseded this call.
    if (mine !== queryToken || response === null) return;

    const items = await Promise.all(response.results.slice(0, 60).map((r) => r.data()));
    if (mine !== queryToken) return;

    bodyHits = new Set(items.map((item) => slugFromUrl(item.url)));
    apply();
  }

  function setQuery(raw: string) {
    query = raw.trim().toLowerCase();
    // The old body hits belong to the old query — drop them rather than let
    // them leak a stale row into the next result set.
    bodyHits = null;
    queryToken += 1;
    apply();
    if (query) void widenWithBodies(raw.trim());
  }

  function setTag(tag: string, on: boolean) {
    if (on) selected.add(tag);
    else selected.delete(tag);
    for (const button of buttons) {
      if (button.dataset.filterTag === tag) button.setAttribute('aria-pressed', String(on));
    }
  }

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const tag = button.dataset.filterTag!;
      setTag(tag, button.getAttribute('aria-pressed') !== 'true');
      apply();
    });
  }

  clearBtn?.addEventListener('click', () => {
    for (const tag of [...selected]) setTag(tag, false);
    apply();
    clearBtn.blur();
  });

  // --- Free-text query ---
  if (queryInput) {
    queryInput.addEventListener('input', () => setQuery(queryInput.value));

    // Enter is "take me to the results" — on a phone the cards are below the
    // fold, so filtering silently in place would look like nothing happened.
    queryInput.form?.addEventListener('submit', (event) => {
      event.preventDefault();
      setQuery(queryInput.value);
      document.querySelector('#all')?.scrollIntoView({ block: 'start' });
    });

    queryInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && queryInput.value) {
        event.preventDefault();
        queryInput.value = '';
        setQuery('');
      }
    });
  }

  queryClear?.addEventListener('click', () => {
    if (!queryInput) return;
    queryInput.value = '';
    setQuery('');
    queryInput.focus();
  });

  // --- Mobile sheet ---
  let lastFocused: HTMLElement | null = null;

  function openRail() {
    lastFocused = document.activeElement as HTMLElement | null;
    rail.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    rail.querySelector<HTMLButtonElement>('[data-filter-close]')?.focus();
  }

  function closeRail() {
    rail.classList.remove('is-open');
    document.body.style.overflow = '';
    lastFocused?.focus();
  }

  openBtn?.addEventListener('click', openRail);
  for (const button of closeBtns) button.addEventListener('click', closeRail);

  rail.addEventListener('click', (event) => {
    // Backdrop dismiss — the panel stops propagation by being the click target.
    if (event.target === rail) closeRail();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && rail.classList.contains('is-open')) {
      event.preventDefault();
      closeRail();
    }
  });

  // Deep links: /?tag=type:indirect-injection from note-page metadata, and
  // /?q=… so a filtered view is shareable and survives reload.
  const params = new URLSearchParams(window.location.search);
  const known = new Set(buttons.map((b) => b.dataset.filterTag!));
  for (const tag of params.getAll('tag')) if (known.has(tag)) setTag(tag, true);

  const initialQuery = params.get('q') ?? '';
  if (initialQuery && queryInput) {
    queryInput.value = initialQuery;
    setQuery(initialQuery);
  } else {
    apply();
  }
}
