/**
 * Client entry. Everything expensive is dynamically imported so the initial
 * bundle stays inside the §11 budget: Pagefind loads on first search, GSAP on
 * first note/index paint under `prefers-reduced-motion: no-preference`.
 */
import { initFilters } from './filters';
import { initPwa } from './pwa';
import { initSearch } from './search';
import { initTheme } from './theme';

initTheme();
initFilters();
initSearch();
initPwa();

// Motion is the last thing to load and the first thing to skip (§7.8).
const wantsMotion = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
const hasAnimatable =
  document.querySelector('[data-branch]') !== null ||
  document.querySelector('[data-redaction]') !== null;

if (hasAnimatable) {
  if (wantsMotion) {
    import('./motion').then((m) => m.initMotion()).catch(() => applyStaticFallback());
  } else {
    applyStaticFallback();
  }
}

/**
 * Reduced-motion / load-failure end states (§7.8): blossoms at full scale with
 * no stagger, static branch fill, redaction bars fading with no wipe.
 */
function applyStaticFallback() {
  import('./static-state').then((m) => m.applyStaticState());
}
