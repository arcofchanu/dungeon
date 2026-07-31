/**
 * The live backdrop — a night-garden scene behind the page, and the petals
 * falling across it (§7.5C).
 *
 * Two halves, and they are sized differently on purpose:
 *
 *   - the scene is one SVG in a 1600×900 viewBox, laid in like a cover image,
 *     so its proportions hold at any window shape
 *   - the petals are viewport-sized HTML, so they fall the height of the screen
 *     rather than the height of the drawing
 *
 * Both are a different object from `DRIFT` in ./grove: that one falls *inside*
 * the tree's viewBox and is part of the composition on the page, these are the
 * weather behind it.
 *
 * Everything here is consumed as an attribute or a custom property by
 * Backdrop.astro, so the motion is CSS-only and stops dead under
 * `prefers-reduced-motion`.
 */

/* ------------------------------------------------------------------ */
/* The scene                                                           */
/* ------------------------------------------------------------------ */

/**
 * Laid in with `preserveAspectRatio="xMidYMax slice"` — cover, pinned to the
 * bottom, so the horizon is always on the horizon and a narrow window crops the
 * sides rather than squashing them. A phone sees roughly x 590–1010 of this
 * box, so everything that has to be seen on a phone lives in that band.
 */
export const SCENE_VIEW_BOX = '0 0 1600 900';

/*
 * The moon is deliberately *not* here: it is the one part of the scene that has
 * to dodge the page's text, and the text moves at every breakpoint. It lives in
 * CSS on its own element instead (Backdrop.astro), where a media query can put
 * it in the gap beside the wordmark on a wide screen and in the corner on a
 * narrow one. Everything else can hold its place in the drawing.
 */

/**
 * Ridges, far to near. Each one is a closed shape that runs off both sides and
 * down past the bottom edge, so no window shape can reveal an end.
 *
 * `depth` is how far back it reads, and the component turns it into opacity:
 * distance hazes a silhouette out rather than darkening it, which is what makes
 * three flat fills of one colour resolve into three planes.
 */
export const HILLS: readonly { d: string; depth: number }[] = [
  {
    d: 'M0,712 C160,678 300,690 448,706 C596,722 700,706 838,682 C976,658 1120,668 1268,690 C1380,706 1500,712 1600,704 L1600,900 L0,900 Z',
    depth: 0.42,
  },
  {
    d: 'M0,796 C140,770 268,762 420,776 C572,790 690,782 840,762 C990,742 1150,752 1300,774 C1400,788 1520,796 1600,790 L1600,900 L0,900 Z',
    depth: 0.66,
  },
  {
    d: 'M0,858 C180,838 340,846 520,856 C700,866 880,858 1060,846 C1240,834 1420,842 1600,856 L1600,900 L0,900 Z',
    depth: 0.9,
  },
];

/**
 * Sakura standing on the ridges, drawn from the *same* curves as the tree on
 * the page (TRUNK_D / BOUGH_DS in ./grove) at a fraction of the size. One tree
 * shape, two jobs: the grove is the subject, these are the horizon.
 *
 * `ridge` says which hill a tree stands on — the component draws each hill,
 * then the trees rooted in it, then the next hill in front, so a nearer ridge
 * covers the trunks behind it the way ground actually does.
 *
 * `sway` and `tilt` are the life in it: a slow lean either side of upright,
 * each tree on its own period so the horizon never pulses in unison.
 */
export interface SceneTree {
  x: number;
  y: number;
  scale: number;
  ridge: number;
  /** Seconds for one lean and back. */
  sway: number;
  /** Degrees either side of upright. Small — a tree is not a metronome. */
  tilt: number;
  /** Blossoms in the canopy; positions come from groveAnchors(). */
  blooms: number;
}

export const SCENE_TREES: readonly SceneTree[] = [
  { x: 196, y: 704, scale: 0.4, ridge: 0, sway: 13, tilt: 0.5, blooms: 4 },
  { x: 948, y: 674, scale: 0.46, ridge: 0, sway: 16, tilt: 0.45, blooms: 5 },
  { x: 1516, y: 708, scale: 0.36, ridge: 0, sway: 11, tilt: 0.6, blooms: 3 },
  { x: 432, y: 780, scale: 0.62, ridge: 1, sway: 18, tilt: 0.4, blooms: 6 },
  { x: 1322, y: 774, scale: 0.56, ridge: 1, sway: 15, tilt: 0.5, blooms: 5 },
];

/**
 * Night sparks over the near ground — the one thing in the scene that is not
 * cherry or landscape. They fade up, drift a few units, and fade out; nothing
 * moves fast enough to catch the eye off the page.
 */
export const SPARKS: readonly {
  x: number;
  y: number;
  r: number;
  rise: number;
  duration: number;
  delay: number;
  opacity: number;
}[] = [
  { x: 268, y: 828, r: 3.2, rise: 34, duration: 9, delay: -2, opacity: 0.5 },
  { x: 612, y: 796, r: 2.6, rise: 28, duration: 11, delay: -7, opacity: 0.42 },
  { x: 806, y: 846, r: 3.6, rise: 40, duration: 8, delay: -4, opacity: 0.55 },
  { x: 1044, y: 806, r: 2.4, rise: 26, duration: 12, delay: -9, opacity: 0.38 },
  { x: 1398, y: 838, r: 3, rise: 32, duration: 10, delay: -6, opacity: 0.46 },
];

/* ------------------------------------------------------------------ */
/* The petals                                                          */
/* ------------------------------------------------------------------ */

/**
 * Three depth bands do the work here too. Small + slow + faint reads as far
 * away, large + quick + stronger reads as close, and the eye assembles the
 * difference into depth.
 *
 * Positions carry no meaning, so they are generated rather than hand-placed —
 * but from a fixed seed, so a given build always renders the same field and the
 * markup is stable between deploys.
 */
export type Depth = 'far' | 'mid' | 'near';

export interface BackdropPetal {
  /** Start position across the viewport, in vw. May sit slightly off either edge. */
  x: number;
  /** Total downwind travel over one fall, in vw. Positive: one prevailing wind. */
  drift: number;
  /** Rendered size, px. */
  size: number;
  /** Seconds for one fall. */
  duration: number;
  /** Seconds for one flutter of the petal about its own centre. */
  flutter: number;
  /** Negative — seconds already elapsed at first paint, so the field starts full. */
  delay: number;
  /** Peak opacity, before the layer's own veil. */
  opacity: number;
  depth: Depth;
}

type Range = readonly [number, number];

interface Band {
  depth: Depth;
  count: number;
  size: Range;
  duration: Range;
  drift: Range;
  flutter: Range;
  opacity: Range;
}

const BANDS: readonly Band[] = [
  { depth: 'far', count: 8, size: [7, 10], duration: [34, 46], drift: [4, 10], flutter: [5, 8], opacity: [0.12, 0.2] },
  { depth: 'mid', count: 6, size: [12, 16], duration: [24, 32], drift: [8, 16], flutter: [3.5, 6], opacity: [0.2, 0.3] },
  { depth: 'near', count: 4, size: [18, 24], duration: [16, 22], drift: [12, 22], flutter: [2.4, 4], opacity: [0.26, 0.36] },
];

/** Linear congruential generator — same numbers on every machine, every build. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function lerp([min, max]: Range, t: number): number {
  return min + (max - min) * t;
}

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function field(): BackdropPetal[] {
  const random = lcg(0x5a4b0731);
  const out: BackdropPetal[] = [];

  for (const band of BANDS) {
    for (let i = 0; i < band.count; i++) {
      // Each petal owns a slice of the width and jitters inside it, so the band
      // covers the viewport evenly instead of clumping the way pure random does.
      const slice = (i + random() * 0.85) / band.count;
      const duration = lerp(band.duration, random());
      out.push({
        x: round(slice * 100 - 8),
        drift: round(lerp(band.drift, random())),
        size: round(lerp(band.size, random()), 1),
        duration: round(duration, 1),
        flutter: round(lerp(band.flutter, random()), 1),
        // Staggered across one full cycle: no two petals in a band land together.
        delay: round(-duration * ((i + random()) / band.count), 1),
        opacity: round(lerp(band.opacity, random())),
        depth: band.depth,
      });
    }
  }

  return out;
}

export const BACKDROP: readonly BackdropPetal[] = field();
