/**
 * Sätteri hast plugins + Shiki transformers for Yozakura.
 *
 * Astro 7 runs Markdown through Sätteri rather than unified, so these are
 * visitor-style plugins rather than rehype ones. Two jobs, both in a single
 * text pass so ordering can't drift:
 *
 *   1. Wikilinks   `[[slug]]` / `[[slug|label]]` -> internal links (§6)
 *   2. Redaction   phrases listed in `redact:` frontmatter -> bars (§7.5B)
 */

const WIKILINK = /\[\[([^\][|]+?)(?:\|([^\][]+?))?\]\]/g;

/** Filename-derived slug, matching `slugFromId` in src/lib/notes.ts. */
function slugify(target) {
  return target
    .trim()
    .split('/')
    .pop()
    .replace(/\.mdx?$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function el(tagName, properties, children) {
  return { type: 'element', tagName, properties, children };
}

function text(value) {
  return { type: 'text', value };
}

/** Walk up from `node`, testing each ancestor element. Bounded — trees are shallow. */
function hasAncestor(node, ctx, predicate) {
  let current = ctx.parent(node);
  for (let depth = 0; current && depth < 24; depth++) {
    if (current.type === 'element' && predicate(current)) return true;
    current = ctx.parent(current);
  }
  return false;
}

function classesOf(node) {
  const raw = node.properties?.className ?? node.properties?.class;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : String(raw).split(/\s+/).filter(Boolean);
}

/** Split `value` on the wikilink syntax, emitting anchor nodes for each hit. */
function splitWikilinks(value) {
  const out = [];
  let last = 0;
  let hit = false;
  WIKILINK.lastIndex = 0;
  for (let m = WIKILINK.exec(value); m; m = WIKILINK.exec(value)) {
    hit = true;
    if (m.index > last) out.push(text(value.slice(last, m.index)));
    const slug = slugify(m[1]);
    out.push(
      el('a', { href: `/notes/${slug}/`, className: ['wikilink'], 'data-wikilink': slug }, [
        text((m[2] ?? m[1]).trim()),
      ]),
    );
    last = m.index + m[0].length;
  }
  if (!hit) return null;
  if (last < value.length) out.push(text(value.slice(last)));
  return out;
}

/**
 * Build a whitespace-insensitive matcher for a redaction phrase.
 *
 * Notes are hard-wrapped in the editor, so a phrase written on one line in
 * frontmatter routinely spans a line break in the body — the text node holds
 * "a base64 tool\nargument" where the phrase says "a base64 tool argument".
 * Matching literally silently fails to cover the payload, which is the one
 * failure mode this feature must not have.
 */
function phrasePattern(phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(escaped, 'g');
}

/**
 * Wrap every occurrence of a redacted phrase. The phrase stays in the DOM —
 * the bar is a sibling overlay, which is what makes the reveal possible.
 */
function splitRedactions(value, phrases) {
  if (!phrases.length) return null;

  const matches = [];
  for (const phrase of phrases) {
    const pattern = phrasePattern(phrase);
    for (let m = pattern.exec(value); m; m = pattern.exec(value)) {
      if (m[0].length === 0) break;
      matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    }
  }
  if (!matches.length) return null;

  // Earliest first; on a tie the longer match wins so a phrase nested inside
  // another doesn't leave a ragged uncovered tail.
  matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const out = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue; // overlaps something already covered
    if (match.start > cursor) out.push(text(value.slice(cursor, match.start)));
    out.push(
      el('span', { className: ['redaction'], 'data-redaction': '' }, [
        el('span', { className: ['redaction-bar'], 'aria-hidden': 'true' }, []),
        el('span', { className: ['redaction-text'] }, [text(match.text)]),
      ]),
    );
    cursor = match.end;
  }

  if (cursor < value.length) out.push(text(value.slice(cursor)));
  return out;
}

/** Apply redaction to an already-split node list, skipping the anchors' own text. */
function redactNodes(nodes, phrases) {
  let changed = false;
  const out = [];
  for (const node of nodes) {
    if (node.type !== 'text') {
      out.push(node);
      continue;
    }
    const split = splitRedactions(node.value, phrases);
    if (split) {
      changed = true;
      out.push(...split);
    } else {
      out.push(node);
    }
  }
  return changed ? out : null;
}

export function yozakuraTextPlugin() {
  return {
    name: 'yozakura-text',
    text(node, ctx) {
      const value = node.value;
      if (!value || !value.trim()) return;

      // Fenced code is already tokenised by Shiki; rewriting inside it would
      // shred the highlight spans. Use `redact` fence meta for those instead.
      // Skip anything already processed so the pass can't re-enter itself.
      const skip = hasAncestor(node, ctx, (parent) => {
        if (parent.tagName === 'pre') return true;
        const classes = classesOf(parent);
        return classes.includes('redaction') || classes.includes('wikilink');
      });
      if (skip) return;

      const redact = (ctx.data?.astro?.frontmatter?.redact ?? [])
        .filter((phrase) => typeof phrase === 'string' && phrase.length > 0)
        .sort((a, b) => b.length - a.length);

      const linked = splitWikilinks(value);
      const redacted = redactNodes(linked ?? [text(value)], redact);
      if (!linked && !redacted) return;

      return el('span', { className: ['md-text'] }, redacted ?? linked);
    },
  };
}

/**
 * Fence meta handling (§7.6). ```js payload  -> severity border + PAYLOAD label.
 *                            ```js redact   -> whole block covered by a bar.
 * @type {import('shiki').ShikiTransformer}
 */
export const yozakuraFenceTransformer = {
  name: 'yozakura-fence',
  pre(node) {
    const meta = this.options?.meta?.__raw ?? '';
    const isPayload = /(^|\s)payload(\s|$)/.test(meta);
    const isRedacted = /(^|\s)redact(ed)?(\s|$)/.test(meta);

    // Data attributes, not classes. The highlighter's `class` lives outside
    // `node.properties`, so assigning a class here appends a *second* class
    // attribute and the parser keeps only the first — the payload styling
    // silently never applied. A data attribute has no such collision.
    if (isPayload) node.properties['data-payload'] = '';
    if (isRedacted) {
      node.properties['data-fence-redacted'] = '';
      node.properties['data-redaction'] = '';
      node.children.unshift(
        el('span', { className: ['redaction-bar'], 'aria-hidden': 'true' }, []),
      );
    }
  },
};

