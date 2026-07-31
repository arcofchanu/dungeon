/**
 * The header lantern swings.
 *
 * A damped pendulum, integrated per frame: the angle is pulled back toward
 * upright in proportion to how far it has been pushed, the velocity bleeds off,
 * and the loop stops the moment it has settled — an idle lantern costs nothing.
 *
 * It takes a push from four places, and each one is a real thing happening on
 * the page rather than an animation playing at the reader:
 *
 *   click     the theme changes and the lantern rocks with it
 *   hover     a brush past it
 *   drag      grab the lantern and it follows the pointer, then swings free
 *   scroll    the page moving under it carries it a little
 *
 * Toggling the theme is src/scripts/theme.ts's job and stays there. This module
 * only tells it, via `data-lantern-drag`, when a click was really the end of a
 * drag — swinging a lantern should not change the lights.
 */

/** Restoring pull, per second². Roughly a 1.2s period. */
const STIFFNESS = 26;
/**
 * Velocity bleed, per second. Underdamped on purpose — it has to swing, not
 * glide back — but high enough to be still again in about three seconds. At
 * 1.5 it was recognisably a pendulum and still visibly moving five seconds
 * after a nudge, which is a fidget, not a lantern.
 */
const DAMPING = 2.4;
/** Degrees. Past this the lantern would swing outside the header. */
const MAX_TILT = 28;
/** Pointer travel that turns a click into a drag. */
const DRAG_SLOP = 4;

export function initLantern(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-lantern]');
  const swing = button?.querySelector<HTMLElement>('[data-lantern-swing]');
  if (!button || !swing) return;

  /* Reduced motion: the lantern is drawn, lit and completely still. It is a
     button either way, and nothing here is the only way to read anything. */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let angle = 0;
  let velocity = 0;
  let frame = 0;
  let last = 0;

  /* Drag state. A live `pointer` freezes the physics — the hand owns the angle
     while it holds the lantern — and the velocity carried out of the drag is
     what makes releasing it feel like letting go rather than like stopping. */
  let pointer = -1;
  let dragged = false;
  let startX = 0;

  function render(): void {
    swing.style.rotate = `${angle.toFixed(2)}deg`;
  }

  function step(now: number): void {
    const dt = Math.min((now - last) / 1000, 0.032);
    last = now;

    if (pointer === -1) {
      // Damped harmonic motion. Small angles, so degrees behave linearly
      // enough that there is no reason to carry radians around.
      velocity += (-STIFFNESS * angle - DAMPING * velocity) * dt;
      angle += velocity * dt;
    }

    if (angle > MAX_TILT || angle < -MAX_TILT) {
      angle = Math.max(-MAX_TILT, Math.min(MAX_TILT, angle));
      velocity = 0;
    }

    render();

    // Settled: park it exactly upright and let the loop end.
    if (pointer === -1 && Math.abs(angle) < 0.04 && Math.abs(velocity) < 0.4) {
      angle = 0;
      velocity = 0;
      render();
      frame = 0;
      return;
    }

    frame = requestAnimationFrame(step);
  }

  function wake(): void {
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(step);
  }

  function push(amount: number): void {
    velocity += amount;
    wake();
  }

  /* --- a click is a push, and the theme's own doing --- */

  button.addEventListener('click', () => {
    if (button.dataset.lanternDrag !== undefined) return;
    // Away from wherever it is leaning, so repeated clicks build a swing
    // instead of cancelling one.
    push(angle > 0 ? -64 : 64);
  });

  /* --- brushing past it --- */

  button.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse' || pointer !== -1) return;
    push(22);
  });

  /* --- grabbing it --- */

  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    pointer = event.pointerId;
    startX = event.clientX;
    dragged = false;
    delete button.dataset.lanternDrag;
    button.setPointerCapture(pointer);
    velocity = 0;
    wake();
  });

  button.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointer) return;

    const dx = event.clientX - startX;
    if (!dragged) {
      if (Math.abs(dx) < DRAG_SLOP) return;
      dragged = true;
      // Read by theme.ts: this click ends a drag, so it is not a choice.
      button.dataset.lanternDrag = '';
    }

    /* Measure the pivot from the button, not the swing: the swing is the thing
       being rotated, so its own rect moves with it. `offsetHeight` is layout
       and ignores the rotation, which makes it the honest cord length. */
    const pivot = button.getBoundingClientRect();
    const length = Math.max(swing.offsetHeight, 1);
    const previous = angle;
    angle = clamp(
      (Math.atan2(event.clientX - (pivot.left + pivot.width / 2), length) * 180) / Math.PI,
      -MAX_TILT,
      MAX_TILT,
    );
    // Hand the swing the speed it was being moved at, so it carries on.
    velocity = (angle - previous) * 12;
    render();
  });

  function release(event: PointerEvent): void {
    if (event.pointerId !== pointer) return;
    pointer = -1;
    wake();
    if (dragged) {
      // Outlive the click that follows this pointerup, then stop lying about it.
      setTimeout(() => delete button.dataset.lanternDrag, 0);
    }
  }

  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);

  /* --- the page moving under it --- */

  let lastScroll = window.scrollY;
  window.addEventListener(
    'scroll',
    () => {
      const delta = window.scrollY - lastScroll;
      lastScroll = window.scrollY;
      if (pointer !== -1) return;
      push(clamp(delta * 0.09, -14, 14));
    },
    { passive: true },
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
