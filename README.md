# Yozakura

A personal research archive for AI/LLM red-teaming work. Static site — drop a
`.md` file in `src/content/notes/`, push, and it appears: rendered, tagged,
full-text searchable, and readable offline.

Built to [PRD.md](./PRD.md). Deviations from it are listed at the bottom.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Dev server. Drafts render here; private notes never do. |
| `npm run build` | Build → Pagefind index → service worker → verify. Fails on any broken guarantee. |
| `npm run preview` | Serve `dist/` locally. |
| `npm test` | Unit tests for the Markdown plugins (redaction, wikilinks). |
| `npm run clean` | Clear **all** caches. Needed after editing anything in `src/lib/markdown/`. |
| `npm run check` | `astro check` — TypeScript across `.astro` files. |

### Clearing caches actually matters

Astro caches rendered Markdown in `node_modules/.astro/data-store.json`, which
`rm -rf .astro` does **not** touch. Edit a Markdown plugin and rebuild without
clearing it and you get stale HTML with no warning — the plugin runs, the output
is from last time. `npm run clean` removes `.astro`, `dist`, `node_modules/.astro`
and `node_modules/.vite`. Editing a note is fine (mtime invalidates that file);
it is only plugin changes that need this.

## Writing a note

Three required fields. That is the whole ritual.

```yaml
---
title: 'Context Overloading in Indirect Injection'
date: 2026-07-28
tags: [comp:gsa, type:indirect-injection, model:claude-sonnet-4]
---
```

The schema is `.strict()` — a typo'd field fails the build rather than being
silently ignored.

### Tags

`namespace:value` puts a tag in a labelled section of the filter rail;
everything else pools under "Tags".

| Prefix | Section |
|---|---|
| `type:` | Technique |
| `model:` | Target |
| `comp:` | Competition |

### Optional fields

| Field | Default | Effect |
|---|---|---|
| `visibility` | `public` | `private` removes the note from `dist/` and the search index entirely |
| `draft` | `false` | Renders in `dev`, excluded from production |
| `summary` | first ~160 chars | Index card text |
| `updated` | — | Shown next to `date` |
| `redact` | `[]` | Phrases rendered under redaction bars |

`redact` matching is case-sensitive but whitespace-insensitive, so a phrase
written on one line in frontmatter still matches when the body wraps it across
two. Redacted text stays in the DOM under a bar — it is a presentation layer,
**not** a secrecy mechanism. Anything that must not be published goes in a note
marked `visibility: private`.

Fenced code takes meta flags: ` ```python payload ` adds the severity border and
`PAYLOAD` label; ` ```python redact ` covers the whole block with a bar.

### Wikilinks

`[[slug]]` or `[[slug|label]]`. Slugs come from the **filename** — subfolders
are organisational only, so `[[gsa/june26-writeup]]` and `[[june26-writeup]]`
resolve identically. Backlinks are derived from these and shown under "Linked
from". Two files with the same basename in different folders fail the build.

## What the build guarantees

`npm run build` fails if any of these break:

- a `visibility: private` note or its canary string appears anywhere in `dist/`
- a `draft: true` note appears in a production build
- the Pagefind index is missing
- client JS exceeds 60KB gzipped (currently **50.5KB**, GSAP included)

## Verified behaviour

Driven in a real browser via `scripts/drive.mjs` (a small CDP harness — the
`msedge --headless --screenshot/--dump-dom` flags run on a virtual clock that
Pagefind's WASM never settles under, so neither flag can test search):

- filter rail: OR within a group, AND across groups, URL-synced, `?tag=` deep links
- search: `⌘K`/`Ctrl+K`/`/` open, `Esc` closes, arrows navigate, focus trapped
- private and draft notes return zero search results
- branch: one bud per `h2`, all link to real sections, fill tracks scroll, buds bloom
- no horizontal scroll at 320/375/414/768/1280 on any route
- `--petal` on `--yozakura` 14.2:1, `--dusk` on `--yozakura` 5.9:1 — both AA

## Deploying

Cloudflare Pages. Build `npm run build`, output `dist`. Set `SITE_URL` to the
production origin so canonical and OG URLs are right.

Regenerate icons after changing the palette: `node scripts/gen-icons.mjs`.

## Deviations from the PRD

1. **Astro 7, not Astro 5.** `npm create astro` ships 7. Content Collections are
   the same shape. Astro 7 replaced remark/rehype with the Sätteri processor, so
   the wikilink and redaction plugins are written against its visitor API
   (`src/lib/markdown/plugins.mjs`) rather than as rehype plugins.

2. **Hand-rolled service worker instead of `@vite-pwa/astro`.** That integration
   peers Astro ≤6. The worker is ~90 lines with the two strategies §9 asks for
   (`scripts/gen-sw.mjs`); Workbox would have been a build dependency and roughly
   its own weight in runtime JS.

3. **The filter rail filters the DOM; Pagefind filters power search.** §8 asks
   for one index behind both. Both read the same frontmatter tags — there is one
   taxonomy — but driving the rail through Pagefind means fetching every result
   fragment just to restore date ordering, which is slow and offline-fragile for
   something that must feel instant. The rail filters server-rendered rows;
   Pagefind indexes the same tags as filters for search.

4. **`--stem` and `--fallen` are not used as text.** §7.2 assigns `--stem` to
   borders; as 13.6px text it is 2.6:1 and fails AA. The `PAYLOAD` label and draft
   badges invert into `--fallen` chips with `--petal` text (5.0:1), which is
   harsher and passes.

5. **`draft`, not `status: draft`.** §6's field table and §11's acceptance
   criteria disagree; the field table is the schema.

6. **Not done: per-note OG images** (§10 Phase 6) — a single static
   `og-default.png` is referenced and not yet generated. Lighthouse and
   real-device checks have not been run; the airplane-mode test needs a real
   install on a phone.
