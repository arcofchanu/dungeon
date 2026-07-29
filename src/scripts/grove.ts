/**
 * Home page: a blossom opens a small preview of its note (§7.5C).
 *
 * Every blossom is still a plain `<a href="/notes/…/">` in the markup, so with
 * this module absent — JS off, a failed chunk, a crawler — a click is an
 * ordinary navigation and nothing is lost. When it does run, a left click is
 * intercepted and answered with a dialog carrying the title, the date and an
 * arrow that does the navigating. Modified clicks (⌘, ctrl, shift, middle) are
 * left alone so "open in a new tab" keeps working.
 */

interface Pop {
  root: HTMLElement;
  title: HTMLElement;
  meta: HTMLElement;
  link: HTMLAnchorElement;
}

export function initGrove(): void {
  const found = document.querySelector<HTMLElement>('[data-grove]');
  const root = document.querySelector<HTMLElement>('[data-grove-pop]');
  if (!found || !root) return;
  const tree: HTMLElement = found;

  const title = root.querySelector<HTMLElement>('[data-grove-pop-title]');
  const meta = root.querySelector<HTMLElement>('[data-grove-pop-meta]');
  const link = root.querySelector<HTMLAnchorElement>('[data-grove-pop-link]');
  if (!title || !meta || !link) return;

  const pop: Pop = { root, title, meta, link };
  /** The blossom the open dialog belongs to, and where focus goes on Esc. */
  let current: SVGAElement | null = null;

  function open(bloom: SVGAElement): void {
    // A second click on the same blossom puts it away again.
    if (current === bloom) {
      close(true);
      return;
    }

    current?.classList.remove('is-open');
    current = bloom;
    bloom.classList.add('is-open');

    pop.title.textContent = bloom.dataset.title ?? '';
    pop.meta.textContent = bloom.dataset.meta ?? '';
    pop.link.href = bloom.getAttribute('href') ?? '/notes/';

    pop.root.hidden = false;
    place();
    /* The arrow is the point of the dialog, so it is what receives focus. */
    pop.link.focus();
  }

  function close(restoreFocus = false): void {
    if (pop.root.hidden) return;
    pop.root.hidden = true;
    const bloom = current;
    current = null;
    bloom?.classList.remove('is-open');
    if (restoreFocus) bloom?.focus();
  }

  /**
   * Park the dialog above its blossom, flipping below when the canopy is close
   * to the top of the tree box, and clamp it inside that box either way — the
   * home page cannot scroll, so anything pushed outside is simply lost.
   */
  function place(): void {
    if (!current) return;

    const target = current.querySelector('.grove-hit') ?? current;
    const box = target.getBoundingClientRect();
    const frame = tree.getBoundingClientRect();
    const width = pop.root.offsetWidth;
    const height = pop.root.offsetHeight;
    const gap = 12;
    const edge = 4;

    const centre = box.left + box.width / 2 - frame.left;
    const maxLeft = Math.max(frame.width - width - edge, edge);
    const left = Math.min(Math.max(centre - width / 2, edge), maxLeft);

    const above = box.top - frame.top - height - gap;
    const below = box.bottom - frame.top + gap;
    const maxTop = Math.max(frame.height - height - edge, edge);
    const top = Math.min(above >= edge ? above : below, maxTop);

    pop.root.style.left = `${Math.round(left)}px`;
    pop.root.style.top = `${Math.round(Math.max(top, edge))}px`;
  }

  tree.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const bloom = (event.target as Element | null)?.closest?.('.grove-bloom');
    if (!bloom) return;
    event.preventDefault();
    open(bloom as SVGAElement);
  });

  root.querySelector('[data-grove-pop-close]')?.addEventListener('click', () => close(true));

  document.addEventListener('click', (event) => {
    if (pop.root.hidden) return;
    const node = event.target as Element | null;
    if (node && (pop.root.contains(node) || node.closest?.('.grove-bloom'))) return;
    close();
  });

  /* The search overlay owns Escape whenever it is open (see search.ts), and it
     covers the page, so the two handlers can never both be live. */
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !pop.root.hidden) close(true);
  });

  /* The blossom moves with the SVG when the box resizes, so the dialog follows
     it rather than being dismissed out from under the reader. */
  window.addEventListener('resize', place);
}
