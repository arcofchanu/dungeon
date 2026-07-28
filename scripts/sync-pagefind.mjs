/**
 * Copy the freshly built Pagefind index into public/ so `astro dev` can serve
 * it. Without this, search is dead in development and only works after a
 * production build — which is exactly when you stop testing it.
 *
 * public/pagefind is gitignored; it is a build artefact, not source.
 */
import { cp, rm, stat } from 'node:fs/promises';

const from = 'dist/pagefind';
const to = 'public/pagefind';

try {
  await stat(from);
} catch {
  console.error(`sync-pagefind: ${from} not found — run \`pagefind --site dist\` first.`);
  process.exit(1);
}

await rm(to, { recursive: true, force: true });
await cp(from, to, { recursive: true });
console.log(`sync-pagefind: ${from} -> ${to}`);
