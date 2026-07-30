/**
 * The grove — geometry for the sakura tree on the index (§7.5C).
 *
 * The branches and the blossom positions come from the *same* control points,
 * so a blossom can never drift off a branch: `TRUNK_D`/`BOUGH_DS` are the
 * rendered `d` attributes and `groveAnchors()` samples the identical curves.
 * Everything here is pure build-time maths — no layout, no measurement, and
 * therefore identical between the server render and any rehydration.
 */

export type Pt = readonly [number, number];

/**
 * A polybezier: `[p0, c1, c2, p1, c3, c4, p2, …]`. Each following triple is one
 * cubic segment, so a 7-point list is two segments.
 */
type Poly = readonly Pt[];

/**
 * Rises from the ground with a slight lean; the leader continues past it.
 * Only the first segment reaches the ground — the second is where boughs 1–4
 * attach, so its control points are load-bearing and must not be retuned.
 */
const TRUNK: Poly = [
  [240, 306],
  [237, 288],
  [232, 272],
  [234, 258],
  [236, 236],
  [234, 218],
  [238, 198],
];

/** Ground line and the drift of fallen petals share this baseline. */
export const GROUND_Y = 310;

/**
 * Nine boughs, alternating left and right up the trunk. Each `p0` was solved
 * against the trunk (or, for 6–9, against the leader) so the joins are seamless
 * rather than eyeballed.
 */
const BOUGHS: readonly Poly[] = [
  [
    [235, 252],
    [217, 247],
    [199, 241],
    [181, 245],
    [165, 248],
    [151, 242],
    [141, 231],
  ],
  [
    [235, 242],
    [255, 236],
    [275, 232],
    [293, 238],
    [307, 243],
    [321, 238],
    [331, 227],
  ],
  [
    [235, 224],
    [219, 214],
    [203, 206],
    [187, 200],
    [175, 195],
    [165, 186],
    [159, 174],
  ],
  [
    [236, 216],
    [252, 206],
    [268, 198],
    [284, 194],
    [296, 191],
    [306, 182],
    [312, 170],
  ],
  // The leader — boughs 5–8 branch off this one, not off the trunk.
  [
    [238, 198],
    [236, 182],
    [234, 168],
    [238, 154],
    [241, 144],
    [240, 134],
    [236, 124],
  ],
  [
    [236, 180],
    [222, 172],
    [208, 164],
    [196, 152],
    [188, 144],
    [180, 138],
    [170, 134],
  ],
  [
    [236, 173],
    [250, 165],
    [264, 157],
    [276, 145],
    [284, 137],
    [292, 131],
    [302, 127],
  ],
  [
    [239, 151],
    [229, 141],
    [221, 131],
    [217, 119],
    [214, 109],
    [209, 101],
    [201, 95],
  ],
  [
    [240, 145],
    [250, 135],
    [258, 125],
    [262, 113],
    [265, 103],
    [270, 95],
    [278, 89],
  ],
];

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function pathOf(poly: Poly): string {
  let d = `M${poly[0][0]},${poly[0][1]}`;
  for (let i = 1; i + 2 < poly.length; i += 3) {
    const [c1, c2, p] = [poly[i], poly[i + 1], poly[i + 2]];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p[0]},${p[1]}`;
  }
  return d;
}

/** Cubic Bézier at `t` on segment `seg` of a polybezier. */
function pointAt(poly: Poly, seg: number, t: number): Pt {
  const i = seg * 3;
  const [p0, c1, c2, p1] = [poly[i], poly[i + 1], poly[i + 2], poly[i + 3]];
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    round(a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0]),
    round(a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]),
  ];
}

export const TRUNK_D = pathOf(TRUNK);
export const BOUGH_DS = BOUGHS.map(pathOf);

/**
 * Blossoms fill by rank, not by branch: the tip of every bough first, then the
 * next position in on every bough, and so on. A three-note archive gets three
 * blossoms spread across the canopy instead of three stacked on one twig.
 */
const RANKS: readonly (readonly [number, number])[] = [
  [1, 1], // tip
  [1, 0.66],
  [0, 0.85],
  [1, 0.34],
  [0, 0.48],
];

/** Visit order within a rank — deliberately non-adjacent so filling looks sown. */
const ORDER = [4, 0, 6, 2, 8, 1, 5, 3, 7];

export interface Anchor {
  x: number;
  y: number;
  /** 0.82–1.18, so a canopy of identical stamps doesn't read as a pattern. */
  scale: number;
  /** Degrees. Five-fold symmetry means ±36° covers every distinct orientation. */
  rotate: number;
}

/**
 * `count` positions on the tree, deterministic for a given count — the same
 * note lands in the same place on every build.
 */
export function groveAnchors(count: number): Anchor[] {
  const slots: Pt[] = [];
  for (const [seg, t] of RANKS) {
    for (const bough of ORDER) slots.push(pointAt(BOUGHS[bough], seg, t));
  }

  const out: Anchor[] = [];
  for (let i = 0; i < count; i++) {
    const [x, y] = slots[i % slots.length];
    // Past one full pass the tree is out of distinct spots; nudge the repeats
    // so they cluster like a real double blossom rather than overprinting.
    const lap = Math.floor(i / slots.length);
    out.push({
      x: x + (lap ? ((i * 7) % 9) - 4 : 0),
      y: y + (lap ? ((i * 5) % 7) - 3 : 0),
      scale: round(0.82 + (((i * 37) % 11) / 11) * 0.36),
      rotate: round((((i * 53) % 73) / 73) * 72 - 36),
    });
  }
  return out;
}

/**
 * Petals still in the air. Pure decoration, never interactive — every field is
 * consumed as a custom property by the keyframes on the index, so the motion is
 * CSS-only and stops dead under `prefers-reduced-motion`.
 *
 * `wind` is positive on every petal on purpose: one prevailing direction is
 * what reads as wind. The side-to-side is the keyframe curve overshooting and
 * falling back along that drift, not a change of direction.
 *
 * The delays are negative so the fall is already under way on first paint —
 * otherwise the canopy sits still for the first ten seconds of a visit.
 */
export interface Drift {
  x: number;
  y: number;
  /** Total downwind travel over one fall, in user units. */
  wind: number;
  /** Vertical travel; `y + fall` lands on the drift of fallen petals. */
  fall: number;
  scale: number;
  /** Seconds for one fall, and for one flutter of the petal about its centre. */
  duration: number;
  flutter: number;
  /** Negative — seconds already elapsed at load. */
  delay: number;
  /** Peak opacity. Tied loosely to scale, so the small ones read as further. */
  opacity: number;
}

export const DRIFT: readonly Drift[] = [
  { x: 212, y: 78, wind: 30, fall: 228, scale: 0.56, duration: 15, flutter: 4.4, delay: -11, opacity: 0.34 },
  { x: 274, y: 76, wind: 15, fall: 230, scale: 0.54, duration: 18, flutter: 5.6, delay: -16, opacity: 0.32 },
  { x: 240, y: 82, wind: 22, fall: 226, scale: 0.6, duration: 17, flutter: 5.2, delay: -4, opacity: 0.36 },
  { x: 296, y: 84, wind: 18, fall: 222, scale: 0.44, duration: 13, flutter: 3.8, delay: -7, opacity: 0.26 },
  { x: 320, y: 92, wind: 16, fall: 216, scale: 0.52, duration: 16, flutter: 4.9, delay: -13, opacity: 0.3 },
  { x: 168, y: 96, wind: 24, fall: 212, scale: 0.5, duration: 11, flutter: 3.1, delay: -2, opacity: 0.3 },
  { x: 258, y: 104, wind: 20, fall: 204, scale: 0.4, duration: 12, flutter: 2.9, delay: -9, opacity: 0.24 },
  { x: 150, y: 112, wind: 34, fall: 196, scale: 0.46, duration: 14, flutter: 3.4, delay: -5, opacity: 0.28 },
  { x: 306, y: 118, wind: 19, fall: 190, scale: 0.48, duration: 15, flutter: 4.1, delay: -14, opacity: 0.28 },
  { x: 186, y: 120, wind: 26, fall: 188, scale: 0.38, duration: 10, flutter: 2.6, delay: -6, opacity: 0.22 },
  { x: 226, y: 130, wind: 28, fall: 178, scale: 0.42, duration: 13, flutter: 3.6, delay: -10, opacity: 0.26 },
  { x: 160, y: 142, wind: 32, fall: 166, scale: 0.44, duration: 12, flutter: 3.2, delay: -8, opacity: 0.26 },
];

/** Petals already on the ground — pure decoration, never interactive. */
export const FALLEN: readonly { x: number; y: number; scale: number; rotate: number }[] = [
  { x: 176, y: 300, scale: 0.5, rotate: 18 },
  { x: 205, y: 307, scale: 0.42, rotate: -24 },
  { x: 262, y: 305, scale: 0.55, rotate: 40 },
  { x: 296, y: 299, scale: 0.45, rotate: -12 },
  { x: 318, y: 307, scale: 0.38, rotate: 62 },
  { x: 150, y: 306, scale: 0.4, rotate: -48 },
];

/** The whole composition, with room for a blossom's radius at every extreme. */
export const VIEW_BOX = '118 74 236 246';
