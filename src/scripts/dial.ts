/**
 * Note pages: the petal dial turns to select a note.
 *
 * The markup is a <details> full of real links (see PetalDial.astro), so with
 * this module absent the flower still opens, every petal is still a link to a
 * note, and the card still names the note being read. What this adds is the
 * turning: drag the flower, scroll it, arrow-key it, or click a petal, and the
 * ring sweeps that note round to the slot facing the card.
 *
 * The petal already selected is left alone — a click on it is an ordinary
 * navigation, and so are modified clicks anywhere, so "open in a new tab" keeps
 * working on all of them.
 */

export function initDial(): void {
  const dial = document.querySelector<HTMLDetailsElement>('[data-dial]');
  if (!dial) return;

  const ring = dial.querySelector<HTMLElement>('[data-dial-ring]');
  const tab = dial.querySelector<HTMLElement>('summary');
  const title = dial.querySelector<HTMLElement>('[data-dial-title]');
  const meta = dial.querySelector<HTMLElement>('[data-dial-meta]');
  const eyebrow = dial.querySelector<HTMLElement>('[data-dial-eyebrow]');
  const openLink = dial.querySelector<HTMLAnchorElement>('[data-dial-open]');
  const openLabel = dial.querySelector<HTMLElement>('[data-dial-open-label]');
  const links = Array.from(dial.querySelectorAll<HTMLAnchorElement>('[data-dial-item]'));

  if (!ring || !title || !meta || !eyebrow || !openLink || !openLabel || links.length === 0) return;

  const count = links.length;
  const step = 360 / count;

  let index = wrap(Number(dial.dataset.start ?? 0) || 0);
  /**
   * Where the ring is pointing, in degrees, counted continuously — it is free
   * to run past ±360 so that the twelfth note followed by the first is one step
   * clockwise rather than eleven steps back.
   */
  let turn = 180 - index * step;

  /* Drag state. `turned` is the one piece two handlers share: the click that
     the browser fires at the end of a drag has to be told apart from a click
     that was only ever a click. */
  let pointer = -1;
  let lastAngle = 0;
  let startTurn = 0;
  let swept = 0;
  let turned = false;
  let scrolled = 0;

  function wrap(value: number): number {
    return ((Math.round(value) % count) + count) % count;
  }

  /** The equivalent of `degrees` inside [-180, 180) — i.e. the short way round. */
  function shortest(degrees: number): number {
    return (((degrees % 360) + 540) % 360) - 180;
  }

  /** Bring note `next` round to the slot facing the card. */
  function select(next: number, moveFocus = false): void {
    index = wrap(next);
    turn += shortest(180 - index * step - turn);
    ring!.style.setProperty('--turn', `${turn}deg`);

    links.forEach((link, i) => link.classList.toggle('is-active', i === index));

    const link = links[index];
    const reading = link.dataset.current !== undefined;
    title!.textContent = link.dataset.title ?? '';
    meta!.textContent = link.dataset.meta ?? '';
    eyebrow!.textContent = reading ? 'You are reading' : `Note ${index + 1} of ${count}`;
    openLabel!.textContent = reading ? 'This note' : 'Open note';
    openLink!.href = link.href;

    if (moveFocus) link.focus();
  }

  function close(restoreFocus = false): void {
    if (!dial!.open) return;
    dial!.open = false;
    if (restoreFocus) tab?.focus();
  }

  /* --- clicking a petal --- */

  ring.addEventListener('click', (event) => {
    // The tail end of a drag: the pointer came to rest on a petal and the
    // browser is reporting a click. It was a turn, not a choice.
    if (turned) {
      turned = false;
      event.preventDefault();
      return;
    }
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const link = (event.target as Element | null)?.closest?.('[data-dial-item]');
    const next = link ? links.indexOf(link as HTMLAnchorElement) : -1;
    // The selected petal is a plain link — this is where the dial gets out of
    // the way and lets the navigation happen.
    if (next === -1 || next === index) return;
    event.preventDefault();
    select(next, true);
  });

  /* Tabbing onto a petal turns it to the front, so the card always describes
     whatever has focus. */
  ring.addEventListener('focusin', (event) => {
    const link = (event.target as Element | null)?.closest?.('[data-dial-item]');
    const next = link ? links.indexOf(link as HTMLAnchorElement) : -1;
    if (next !== -1 && next !== index) select(next);
  });

  /* --- keyboard --- */

  dial.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      close(true);
      return;
    }
    if (!dial.open) return;

    // Only chase focus if it is already on a petal; taking it off the flower
    // itself would be the dial deciding where the reader is looking.
    const chase = ring.contains(document.activeElement);

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        select(index + 1, chase);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        select(index - 1, chase);
        break;
      case 'Home':
        select(0, chase);
        break;
      case 'End':
        select(count - 1, chase);
        break;
      default:
        return;
    }
    event.preventDefault();
  });

  /* --- the wheel --- */

  dial.addEventListener(
    'wheel',
    (event) => {
      if (!dial.open) return;
      event.preventDefault();
      // deltaMode 1 is lines, 2 is pages; normalise both to something the same
      // threshold can judge.
      const scale = event.deltaMode === 0 ? 1 : event.deltaMode === 1 ? 16 : 100;
      scrolled += (event.deltaY + event.deltaX) * scale;
      if (Math.abs(scrolled) < 40) return;
      select(index + Math.sign(scrolled));
      scrolled = 0;
    },
    { passive: false },
  );

  /* --- turning it by hand --- */

  /** Pointer angle about the hub. The ring is a zero-sized box pinned on the
      hub centre, so its own rect gives the centre without measuring anything. */
  function angleAt(event: PointerEvent): number {
    const box = ring!.getBoundingClientRect();
    return (Math.atan2(event.clientY - box.top, event.clientX - box.left) * 180) / Math.PI;
  }

  ring.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    pointer = event.pointerId;
    lastAngle = angleAt(event);
    startTurn = turn;
    swept = 0;
    turned = false;
    ring.setPointerCapture(pointer);
  });

  ring.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointer) return;
    const angle = angleAt(event);
    // Accumulated one move at a time, so a drag can pass through ±180° without
    // the ring snapping back the other way.
    swept += shortest(angle - lastAngle);
    lastAngle = angle;

    if (!turned) {
      if (Math.abs(swept) < 4) return;
      turned = true;
      ring.classList.add('is-turning');
    }
    turn = startTurn + swept;
    ring.style.setProperty('--turn', `${turn}deg`);
  });

  function release(event: PointerEvent): void {
    if (event.pointerId !== pointer) return;
    pointer = -1;
    ring!.classList.remove('is-turning');
    // Let go and the nearest petal eases into the slot.
    if (turned) select((180 - turn) / step);
  }

  ring.addEventListener('pointerup', release);
  ring.addEventListener('pointercancel', release);

  /* --- getting out --- */

  document.addEventListener('click', (event) => {
    if (!dial.open) return;
    const node = event.target as Element | null;
    if (node && dial.contains(node)) return;
    close();
  });
}
