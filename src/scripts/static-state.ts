/**
 * Reduced-motion and GSAP-unavailable end states (§7.8).
 *
 * Blossoms render at full scale immediately with no stagger and the branch
 * fill is static; redaction bars fade over 200ms with no wipe; SplitText does
 * not run. No layout differs between this and the animated path — only the
 * transition into it (§11).
 */

export function applyStaticState() {
  const branch = document.querySelector<HTMLElement>('[data-branch]');
  if (branch) {
    // CSS already renders open buds when `.js-ready` is absent; the reduced
    // -motion rule keeps them open even if motion.ts added it. Mark the first
    // section current so the mobile rail has its single blossom.
    branch.classList.remove('js-ready');
    branch.style.setProperty('--progress', '100%');
    branch.querySelector('.branch-node')?.classList.add('is-current');
  }

  const targets = document.querySelectorAll<HTMLElement>('[data-redaction]');
  for (const target of targets) {
    target.classList.add('is-fading', 'is-revealed');
  }
}
