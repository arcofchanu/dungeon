/**
 * The filter rail.
 *
 * Selection semantics are the conventional faceted ones: OR within a group,
 * AND across groups. Rows are server-rendered and filtered in the DOM, so the
 * rail is instant, works offline, and preserves date ordering. Both the rail
 * and Pagefind read the same frontmatter tags, so there is still one taxonomy
 * (§8) — see the deviation note in README.md.
 */

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

  const selected = new Set<string>();

  // Precompute each row's tag set once — filtering is then pure set lookups.
  const rowTags = new Map<HTMLElement, Set<string>>(
    rows.map((row) => [row, new Set((row.dataset.tags ?? '').split(' ').filter(Boolean))]),
  );

  function apply() {
    const byGroup = new Map<string, string[]>();
    for (const tag of selected) {
      const group = groupOf(tag);
      byGroup.set(group, [...(byGroup.get(group) ?? []), tag]);
    }

    let visible = 0;
    for (const row of rows) {
      const tags = rowTags.get(row)!;
      let matches = true;
      for (const group of byGroup.values()) {
        if (!group.some((tag) => tags.has(tag))) {
          matches = false;
          break;
        }
      }
      row.hidden = !matches;
      if (matches) visible += 1;
    }

    const label = `${visible} ${visible === 1 ? 'note' : 'notes'}`;
    if (countEl) countEl.textContent = label;
    if (railCountEl) railCountEl.textContent = label;
    if (emptyEl) emptyEl.hidden = visible !== 0;
    if (clearBtn) clearBtn.hidden = selected.size === 0;

    const params = new URLSearchParams(window.location.search);
    params.delete('tag');
    for (const tag of selected) params.append('tag', tag);
    const query = params.toString();
    history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
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

  // Deep links from note-page metadata: /?tag=type:indirect-injection
  const initial = new URLSearchParams(window.location.search).getAll('tag');
  const known = new Set(buttons.map((b) => b.dataset.filterTag!));
  for (const tag of initial) if (known.has(tag)) setTag(tag, true);
  apply();
}
