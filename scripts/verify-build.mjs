/**
 * Build assertions from §11. Runs after `astro build` + `pagefind`, and fails
 * the build loudly rather than shipping a broken guarantee.
 *
 *   - no `visibility: private` note reaches dist/ or the Pagefind index
 *   - no `draft: true` note reaches a production build
 *   - the Pagefind index actually exists
 *   - client JS stays under the 60KB gzipped budget, GSAP included
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join, relative, extname } from 'node:path';

const DIST = 'dist';
const JS_BUDGET_BYTES = 60 * 1024;

/** Slugs and canary strings that must never appear anywhere in the output. */
const FORBIDDEN = [
  { label: 'private note slug', needle: 'live-payload-vault' },
  { label: 'private note canary', needle: 'PRIVATE_CANARY_7f3a' },
  { label: 'draft note slug', needle: 'draft-token-splitting' },
  { label: 'draft note canary', needle: 'DRAFT_CANARY_9b2e' },
];

const failures = [];

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else out.push(path);
  }
  return out;
}

const files = await walk(DIST);

if (files.length === 0) {
  console.error(`verify: ${DIST}/ is empty or missing. Did astro build run?`);
  process.exit(1);
}

// --- 1 & 2: private and draft notes absent from the whole output tree ---
const TEXTUAL = new Set(['.html', '.js', '.json', '.css', '.xml', '.txt', '.pf_meta', '.pf_fragment']);

for (const file of files) {
  const ext = extname(file);
  if (!TEXTUAL.has(ext) && !file.includes('pagefind')) continue;

  let contents;
  try {
    contents = await readFile(file, 'utf8');
  } catch {
    continue; // binary chunk — pagefind fragments are compressed
  }

  for (const { label, needle } of FORBIDDEN) {
    if (contents.includes(needle)) {
      failures.push(`${label} "${needle}" found in ${relative(DIST, file)}`);
    }
  }
}

// The route itself must not exist.
for (const { needle } of FORBIDDEN) {
  if (files.some((file) => file.includes(join('notes', needle)))) {
    failures.push(`excluded note "${needle}" has a generated route in ${DIST}/notes/`);
  }
}

// --- 3: the Pagefind index exists ---
const pagefindEntry = join(DIST, 'pagefind', 'pagefind.js');
try {
  await stat(pagefindEntry);
} catch {
  failures.push(`Pagefind index missing — expected ${pagefindEntry}`);
}

// --- 4: client JS budget (§11) ---
const appScripts = files.filter(
  (file) => file.endsWith('.js') && file.includes(join(DIST, '_astro')),
);

let gzipTotal = 0;
for (const file of appScripts) {
  gzipTotal += gzipSync(await readFile(file)).byteLength;
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)}KB`;

if (gzipTotal > JS_BUDGET_BYTES) {
  failures.push(
    `client JS is ${kb(gzipTotal)} gzipped across ${appScripts.length} files — budget is ${kb(JS_BUDGET_BYTES)}`,
  );
}

// --- report ---
if (failures.length > 0) {
  console.error('\nverify: FAILED\n');
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error('');
  process.exit(1);
}

console.log(`verify: ok — ${files.length} files, client JS ${kb(gzipTotal)} gzipped (budget ${kb(JS_BUDGET_BYTES)})`);
