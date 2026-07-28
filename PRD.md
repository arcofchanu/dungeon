# PRD — YOZAKURA

**A personal research archive for AI/LLM red-teaming work.**

Working title: `yozakura` (夜桜 — night cherry blossom viewing). Rename freely.

---

## 1. Problem

Research notes on prompt injection, jailbreak taxonomies, model behaviour, and competition write-ups currently live scattered across chat logs, local files, and browser bookmarks. Retrieval is the bottleneck: finding a technique tried three months ago costs more time than re-deriving it.

## 2. Goal

One site. Drop a `.md` file into a folder, `git push`, and it appears — rendered well, tagged, and full-text searchable. Works offline on a phone. Doubles as a public portfolio of red-teaming work.

## 3. Users

- **Primary:** the author. Reading and searching own notes, often on mobile, often offline.
- **Secondary:** recruiters, security researchers, competition peers who land on a public note.

These have different needs. The private use case wants speed and search. The public one wants the work to look credible. The design must not sacrifice the first for the second.

## 4. Non-goals

Explicitly out of scope for v1:

- CMS or web-based editor — the editor is the local text editor
- Comments, reactions, social features
- User accounts or auth
- Server-side anything — this is a static site
- RSS (add in v2 if wanted)

---

## 5. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Astro 5** | Content Collections give typed frontmatter with zod validation. Ships zero JS by default, so GSAP is the only client JS. |
| Content | Markdown + MDX | MDX only where a note needs an interactive component. Default to plain `.md`. |
| Search | **Pagefind** | Static full-text index built at compile time. No server, no API key, works offline. |
| Animation | **GSAP 3.13+** | ScrollTrigger and SplitText are free for commercial use as of April 2025 — no license key or Club membership needed. Install via `npm i gsap`. |
| Code highlighting | **Shiki** | Built into Astro. Custom theme required — see §7.6. |
| PWA | **@vite-pwa/astro** | Installable app + offline precaching. |
| Hosting | **Cloudflare Pages** | Already familiar. Build: `npm run build`, output: `dist`. |

**Alternative considered:** SvelteKit + mdsvex, for stack consistency with existing projects. Rejected — Astro's Content Collections and Pagefind integration are purpose-built for content sites and save meaningful work. Astro is learnable in an afternoon coming from SvelteKit.

---

## 6. Content model

### Directory structure

```
src/content/notes/
├── indirect-injection-primer.md
├── context-overloading.md
├── gsa/
│   └── june26-writeup.md
└── reading/
    └── kafka-on-bureaucratic-systems.md
```

Subfolders are organisational only. Taxonomy comes from frontmatter, not paths.

### Frontmatter schema

Enforce with zod in `src/content.config.ts`. Build must fail on invalid frontmatter — this is what keeps the archive usable at 300 notes.

```yaml
Three required fields. That is the whole ritual for a normal note:

```yaml
---
title: "Context Overloading in Indirect Injection"
date: 2026-07-28
tags: [gsa, indirect-injection, model:claude-sonnet-4]
---
```

**This is a hard constraint, not a starting point.** Frontmatter friction is what kills personal archives — every additional required field lowers the odds a note gets written at all. Do not add required fields in later phases.

### Namespaced tags

Tags may carry an optional `namespace:value` prefix. This replaces what would otherwise be separate `target` and `technique` fields — one concept instead of three.

Recognised namespaces: `model:` (system under test), `type:` (technique class), `comp:` (competition or platform). Anything without a prefix is a free tag.

The filter rail groups namespaced tags into labelled sections and pools the rest under "Tags". Pagefind indexes them identically either way, so nothing breaks if a namespace is never used.

### Optional fields

All default sensibly. Type them only when a specific note needs them.

| Field | Default | Purpose |
|---|---|---|
| `visibility` | `public` | `private` removes the note from the build entirely — see below |
| `draft` | `false` | `true` renders in dev, excluded from production |
| `summary` | first 160 chars of body | Index card text. Override only when the opening line reads badly out of context |
| `updated` | — | Shown next to `date` when present |
| `redact` | — | List of phrases rendered as redaction bars, see §7.5 |

**`visibility: private` is the one worth keeping** despite the simplification. It filters the note out of the production build entirely — not hidden by CSS, not `noindex`, but absent from `dist/` and absent from the Pagefind index. Given that this archive will hold live payloads and unpublished competition work, one optional word is a cheap safety valve. Add a build test asserting no private slug appears in output.

### Derived, never typed

- **Slug** — from filename
- **Reading time** — from word count
- **Backlinks** — from wikilink parsing across the collection

---

## 7. Design direction

### 7.1 The idea

**Yozakura** — cherry blossoms viewed at night. Deep plum-indigo ground, pale petal text, blossom pink accent.

The concept is the tension between container and contents: soft, organic, seasonal forms carrying hard adversarial material. Redaction bars and payload dumps sit inside a palette borrowed from a night garden. That contrast is the entire point, and it is what makes the site memorable in a field where every other researcher's page is black with green monospace.

**Deliberately avoided:** near-black plus acid-green terminal styling. It is the default answer for anything security-adjacent and carries no information.

**The kitsch trap:** this direction fails if it drifts toward anime fan-page. The guardrails in §7.7 are not optional polish — they are what keeps it on the right side of the line.

### 7.2 Color tokens

Define as CSS custom properties on `:root`. Every color in the build derives from these six. No one-off hex values anywhere.

```css
--yozakura: #16121C;  /* base ground — plum-black night */
--bark:     #241C2B;  /* raised surfaces, code blocks, redaction bars */
--petal:    #F2DCE4;  /* primary text */
--dusk:     #9B8DA6;  /* metadata, secondary text, hairlines */
--blossom:  #E890AC;  /* accent — links, tags, active states, focus ring */
--fallen:   #9E3B5C;  /* status and severity ONLY */
```

Two supporting values, derived — not new colors:

```css
--branch:   #3A2E42;  /* --bark lightened; unbloomed branch, dividers */
--stem:     #7A4A5C;  /* --fallen desaturated; tag borders, bloomed branch */
```

`--fallen` is rationed. If it appears more than twice on a screen it has stopped meaning anything.

### 7.3 Typography

Three faces, three jobs. Self-host via `@fontsource-variable` — no render-blocking Google Fonts request.

| Role | Face | Usage |
|---|---|---|
| Display | **Fraunces** (variable) | Titles and section heads. Set `wonk` on and `soft` moderate — the axes produce asymmetric, slightly organic letterforms that rhyme with the petal motif without being floral. Weight 500–600. |
| Body | **Newsreader** | All prose. Comfortable for long reading sessions, and a serif keeps the pink from reading as UI-candy. |
| Utility | **JetBrains Mono** | Metadata lines, tags, code blocks, payloads. |

Type scale: 1.25 ratio. Body 17px / 1.7 line-height. Measure capped at 68ch.

Set body type at a genuinely comfortable size. Small type plus pink reads twee; generous type plus pink reads confident. This is one of the highest-leverage decisions in the build.

### 7.4 Layout

**Index (`/`)**

```
┌──────────────────────────────────────────────┐
│  YOZAKURA                        ⌘K  [◐]     │
├────────────┬─────────────────────────────────┤
│ FILTERS    │  2026-07-28 · INDIRECT-INJECTION│
│            │  Context overloading            │
│ ▸ technique│  Filling the ███████ to push    │
│ ▸ target   │  safety instructions out of ██  │
│ ▸ tags     │  ─────────────────────────────  │
│ ▸ status   │  2026-07-14 · TOOL-ABUSE        │
│            │  README injection in coding...  │
└────────────┴─────────────────────────────────┘
```

Left rail is a persistent filter column on desktop, collapsing to a sheet triggered by a filter button on mobile. Right column is a dense list — mono metadata line, display-face title, body-face summary.

No cards, no borders, no shadows. Separation comes from a single hairline `--branch` rule between rows. The palette is doing enough work; adding container chrome on top is what tips it into decoration.

**Note page (`/notes/[slug]`)**

Single column, 68ch, generous top margin, with the branch running down the left margin (§7.5). Desktop places metadata — target, technique, status, date — as a small block beneath the title in mono. No floating sidebar; the branch already occupies that side.

### 7.5 Signature elements

Two, on two different routes. Index gets the redaction reveal, note pages get the branch. Neither is decorative — both do a job that would otherwise need a UI control.

**A. The branch that blooms** *(note pages)*

A bare vertical line runs down the left margin of every note. Each `h2` is a node on it, rendered initially as a closed bud — a 3px `--branch` circle.

As the reader scrolls past a section, GSAP opens that bud: five petals scale from 0 with a 40ms stagger and a slight rotation, filled `--blossom`. The branch segment above the node fills from `--branch` to `--stem`.

The bloom line is therefore reading progress, and the buds are the table of contents — each is clickable and scrolls to its section. Current section's blossom sits at full scale and full `--blossom`; passed sections render at 0.62 scale in `--stem` so the current position stays legible.

Petal geometry: five instances of a single notched-tip path, rotated 72° apart, with a small `--petal` circle at the centre. Define the path once in `<defs>` and instantiate with `<use>`.

**B. The redaction reveal** *(index)*

Any phrase listed in a note's `redact:` frontmatter renders wrapped in a `<span class="redaction">` — present in the DOM, covered by a solid `--bark` bar.

On scroll into viewport, the bar wipes away left-to-right via `clip-path` over 400ms, revealing the text beneath, with a single-frame `--blossom` flash at the leading edge. Staggered 60ms down the list.

Redaction bars are hard-edged rectangles. `border-radius: 0`, no exceptions. They are the one brutal element in a soft palette and that contrast is load-bearing — round them and the whole concept goes soft.

This also does real work: publish a note publicly while keeping a live payload covered.

### 7.6 Shiki theme

Code blocks must not look imported from another site. Author a custom Shiki theme from the palette:

```
background      --bark
foreground      --petal
comment         --dusk
keyword         --blossom
string          --stem
function        --petal at 90% opacity
number/constant --fallen
punctuation     --dusk
```

Payload blocks — code fences tagged with a `payload` meta — get a 2px `--fallen` left border and a mono `PAYLOAD` label. This is the one place the harsh register is allowed to dominate.

### 7.7 Restraint rules

Non-negotiable. Each one is a specific failure mode this direction is prone to.

- **No falling petal animation.** Ambient drifting petals is the single most obvious move available and it will make the site look like a fan page. The petals bloom on the branch, tied to scroll position, and nowhere else.
- **No cherry blossom background imagery, illustrations, or hero graphics.** The motif appears only as the branch glyphs.
- **No Japanese-brush or calligraphic display fonts.** Fraunces, as specified.
- **`--fallen` maximum twice per viewport.**
- **`border-radius: 0` on redaction bars, code blocks, and payload blocks.** Soft corners are permitted only on the filter rail and the search overlay.
- **No gradients.** Flat color throughout.
- **No more than three animations total** — the two in §7.5 plus the search overlay in §8. The index row hover changes color only, with no transform.

### 7.8 Motion

Wrap everything in `gsap.matchMedia()` under a `(prefers-reduced-motion: no-preference)` condition.

Reduced-motion fallbacks: blossoms render at full scale immediately with no stagger and the branch fill is static; redaction bars fade over 200ms with no wipe; SplitText does not run.

Mobile: the branch collapses to a 3px vertical progress rail with a single blossom marking current position. Five-petal glyphs at 375px are mush — do not attempt them.

---

## 8. Search

Pagefind indexes at build time and is queried entirely client-side.

**Requirements:**

- `⌘K` / `Ctrl+K` opens a full-screen overlay. `Esc` closes. `/` also opens it.
- Overlay entry animation: SplitText char-stagger on the placeholder string, 20ms per char, 200ms total. This is the third and final animation.
- Results show title, matched excerpt with the term highlighted in `--blossom`, and the mono metadata line.
- Arrow keys navigate, `Enter` opens, focus is trapped while open and returns to the trigger on close.
- Frontmatter `tags`, `technique`, and `target` are indexed as Pagefind filters, so the filter rail and search share one index rather than two systems.
- Private and draft notes must not appear in the index. Verify explicitly.
- On mobile the overlay is full-screen with the input pinned to the top and the keyboard-safe area respected.

Search is the single most important feature on the site. If a tradeoff appears between search quality and any animation, search wins.

---

## 9. PWA

Installable to home screen on iOS and Android, fully functional offline.

**Manifest:** name `Yozakura`, short name `Yozakura`, `display: standalone`, `theme_color: #16121C`, `background_color: #16121C`. Icons at 192px, 512px, and a 512px maskable variant — use a single five-petal blossom in `--blossom` on `--yozakura`, with generous padding inside the maskable safe zone.

**Service worker (Workbox via `@vite-pwa/astro`):**

- Precache: all note pages, the Pagefind index and its chunks, fonts, CSS, JS.
- Runtime: `StaleWhileRevalidate` for pages, `CacheFirst` for fonts and static assets.
- Non-blocking toast when a new build is available, with a "Reload" action. Never auto-reload mid-read.

**Acceptance:** load the site, enable airplane mode, navigate to three notes and run a search. All must work.

---

## 10. Build phases

Ship each phase working before starting the next. Do not build the design system before content renders.

**Phase 0 — Scaffold**
Astro project, TypeScript strict, Prettier, `.gitignore`, deploy an empty site to Cloudflare Pages. Confirm the pipeline works end to end before writing features.

**Phase 1 — Content pipeline**
Content collection with the §6 zod schema. Note page route. Index route. Verify: build fails on bad frontmatter; private and draft notes absent from `dist/`.

**Phase 2 — Design system**
Tokens, fonts, type scale, layouts, Shiki theme. Static branch and static redaction bars rendered but not animated. The site should look finished while completely still.

**Phase 3 — Search**
Pagefind integration, overlay, keyboard handling, filter rail wired to Pagefind filters.

**Phase 4 — Motion**
GSAP. The three animations only. `matchMedia` guards written from the start, not retrofitted.

**Phase 5 — PWA**
Manifest, blossom icons, service worker, update toast. Run the airplane-mode test.

**Phase 6 — Polish**
Lighthouse pass, keyboard audit, real-device mobile check, 404 page, per-note OG images.

---

## 11. Acceptance criteria

- [ ] A new `.md` file with valid frontmatter appears on the live site after `git push`, with no other changes required
- [ ] Invalid frontmatter fails the build with a readable error naming the file and field
- [ ] No note with `visibility: private` or `status: draft` appears in `dist/` or the Pagefind index
- [ ] Search returns results in under 100ms for a 200-note archive
- [ ] Full keyboard operation. Visible `--blossom` focus ring on every interactive element
- [ ] `--petal` on `--yozakura` and `--dusk` on `--yozakura` both pass WCAG AA
- [ ] `prefers-reduced-motion: reduce` disables all three animations without breaking layout
- [ ] Every restraint rule in §7.7 holds in the shipped build
- [ ] Lighthouse: Performance ≥ 95, Accessibility 100, Best Practices ≥ 95
- [ ] Installs to iOS and Android home screen; three notes readable and search functional in airplane mode
- [ ] No horizontal scroll at 320px width
- [ ] Total client JS under 60KB gzipped, GSAP included

---

## 12. Notes for the implementing agent

- Build mobile-first. The primary reading device is a phone.
- Do not add a library for anything CSS can do. No Tailwind unless you hit a real reason — the §7.2 token set is small enough for plain CSS custom properties, and it keeps the output legible.
- Watch CSS specificity between section-level and element-level selectors, particularly for section padding and margins. Cancelled-out rules are the most common failure in this kind of build.
- Every color and font size must trace to a token. If you need a value that is not there, add it to the token block rather than inlining it.
- Screenshot after Phase 2 and Phase 4, and critique against §7.7 line by line before continuing.
- Seed the repo with 5–6 real notes of varying length during development. Lorem ipsum hides layout problems that real content exposes.
