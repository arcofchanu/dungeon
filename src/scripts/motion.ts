/**
 * The three animations (§7.5, §8) and nothing else (§7.7).
 *
 *   1. The branch that blooms  — note pages
 *   2. The redaction reveal    — index and note bodies
 *   3. Search placeholder      — SplitText char stagger
 *
 * Everything is inside `gsap.matchMedia()` under
 * `(prefers-reduced-motion: no-preference)`; the reduced-motion branch hands
 * off to ./static-state, which is also the no-JS end state. Written that way
 * from the start rather than retrofitted (§10, Phase 4).
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

import { applyStaticState } from './static-state';

gsap.registerPlugin(ScrollTrigger, SplitText);

let started = false;

export function initMotion() {
  if (started) return;
  started = true;

  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const cleanupBranch = initBranch();
    const cleanupRedactions = initRedactions();
    return () => {
      cleanupBranch?.();
      cleanupRedactions?.();
    };
  });

  mm.add('(prefers-reduced-motion: reduce)', () => {
    applyStaticState();
  });
}

/* ------------------------------------------------------------------ */
/* 1. The branch that blooms (§7.5A)                                    */
/* ------------------------------------------------------------------ */

function initBranch(): (() => void) | void {
  const branch = document.querySelector<HTMLElement>('[data-branch]');
  const prose = document.querySelector<HTMLElement>('[data-prose]');
  const article = document.querySelector<HTMLElement>('[data-note-article]');
  if (!branch || !prose || !article) return;

  const nodes = Array.from(branch.querySelectorAll<HTMLElement>('.branch-node'));
  const headings = Array.from(prose.querySelectorAll<HTMLElement>('h2'));
  if (nodes.length === 0 || headings.length !== nodes.length) return;

  // Buds start closed once JS owns them.
  branch.classList.add('js-ready');

  const petalGroups = nodes.map((node) =>
    Array.from(node.querySelectorAll<SVGGElement>('.bud-petals > g')),
  );
  const centres = nodes.map((node) => node.querySelector<SVGCircleElement>('.bud-centre'));

  // GSAP owns bud geometry; CSS classes own bud colour. Keeping those separate
  // is what stops the two systems fighting over the same inline style.
  for (const group of petalGroups) {
    gsap.set(group, { transformOrigin: '0px 0px', svgOrigin: '0 0', scale: 0 });
  }
  gsap.set(centres.filter(Boolean), { transformOrigin: '0px 0px', svgOrigin: '0 0', scale: 0 });

  const bloomed = new Array(nodes.length).fill(false);

  function bloom(index: number) {
    if (bloomed[index]) return;
    bloomed[index] = true;
    // Five petals scale from 0 with a 40ms stagger and a slight rotation.
    gsap.to(petalGroups[index], {
      scale: 1,
      rotation: '+=10',
      duration: 0.45,
      stagger: 0.04,
      ease: 'back.out(1.7)',
    });
    const centre = centres[index];
    if (centre) gsap.to(centre, { scale: 1, duration: 0.3, delay: 0.16, ease: 'power2.out' });
  }

  function unbloom(index: number) {
    if (!bloomed[index]) return;
    bloomed[index] = false;
    gsap.to(petalGroups[index], {
      scale: 0,
      rotation: '-=10',
      duration: 0.25,
      stagger: { each: 0.03, from: 'end' },
      ease: 'power2.in',
    });
    const centre = centres[index];
    if (centre) gsap.to(centre, { scale: 0, duration: 0.15, ease: 'power2.in' });
  }

  function setCurrent(index: number) {
    nodes.forEach((node, i) => {
      node.classList.toggle('is-current', i === index);
      node.classList.toggle('is-passed', i < index && bloomed[i]);
    });
  }

  /** Place each bud at its section's real share of the article (§7.5A). */
  function positionBuds() {
    const top = article!.offsetTop;
    const height = Math.max(article!.offsetHeight, 1);
    nodes.forEach((node, index) => {
      const share = (headings[index].offsetTop + prose!.offsetTop - top) / height;
      node.style.setProperty('--pos', String(gsap.utils.clamp(0.02, 0.98, share)));
    });
  }

  positionBuds();

  const triggers: ScrollTrigger[] = [];

  // Fill: the segment above the reader's position, --branch -> --stem.
  triggers.push(
    ScrollTrigger.create({
      trigger: article,
      start: 'top top+=140',
      end: 'bottom bottom',
      onRefresh: positionBuds,
      onUpdate: (self) => {
        branch.style.setProperty('--progress', `${(self.progress * 100).toFixed(2)}%`);
      },
    }),
  );

  headings.forEach((heading, index) => {
    triggers.push(
      ScrollTrigger.create({
        trigger: heading,
        start: 'top 45%',
        end: 'bottom 45%',
        onEnter: () => {
          bloom(index);
          setCurrent(index);
        },
        onEnterBack: () => {
          bloom(index);
          setCurrent(index);
        },
        onLeaveBack: () => {
          unbloom(index);
          setCurrent(index - 1);
        },
      }),
    );
  });

  const onLoad = () => ScrollTrigger.refresh();
  window.addEventListener('load', onLoad);

  return () => {
    window.removeEventListener('load', onLoad);
    for (const trigger of triggers) trigger.kill();
    branch.classList.remove('js-ready');
    gsap.set(petalGroups.flat(), { clearProps: 'all' });
  };
}

/* ------------------------------------------------------------------ */
/* 2. The redaction reveal (§7.5B)                                      */
/* ------------------------------------------------------------------ */

function initRedactions(): (() => void) | void {
  const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-redaction]'));
  if (targets.length === 0) return;

  const bars = new Map<HTMLElement, HTMLElement>();
  for (const target of targets) {
    const bar = target.querySelector<HTMLElement>(':scope > .redaction-bar');
    if (bar) bars.set(target, bar);
  }

  const batches = ScrollTrigger.batch(targets, {
    start: 'top 92%',
    once: true,
    onEnter: (batch) => {
      batch.forEach((element, index) => {
        const bar = bars.get(element as HTMLElement);
        if (!bar) return;
        gsap.to(bar, {
          // Wipe left-to-right over 400ms, staggered 60ms down the list.
          clipPath: 'inset(0 0 0 100%)',
          duration: 0.4,
          delay: index * 0.06,
          ease: 'power2.inOut',
          onStart: () => {
            // Single-frame --blossom flash at the leading edge.
            bar.classList.add('is-wiping');
          },
          onComplete: () => {
            bar.classList.remove('is-wiping');
            (element as HTMLElement).classList.add('is-revealed');
            bar.style.clipPath = '';
          },
        });
      });
    },
  });

  return () => {
    for (const trigger of batches) trigger.kill();
  };
}

/* ------------------------------------------------------------------ */
/* 3. Search overlay placeholder (§8)                                   */
/* ------------------------------------------------------------------ */

const splitCache = new WeakMap<HTMLElement, SplitText>();

/** 20ms per char, ~200ms total. Called by search.ts on overlay open. */
export function animatePlaceholderChars(placeholder: HTMLElement) {
  let split = splitCache.get(placeholder);
  if (!split) {
    split = new SplitText(placeholder, { type: 'chars' });
    splitCache.set(placeholder, split);
  }
  gsap.fromTo(
    split.chars,
    { opacity: 0, y: '0.25em' },
    { opacity: 1, y: 0, duration: 0.2, stagger: 0.02, ease: 'power2.out', overwrite: true },
  );
}
