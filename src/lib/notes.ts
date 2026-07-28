import { getCollection, type CollectionEntry } from 'astro:content';

export type NoteEntry = CollectionEntry<'notes'>;

/** Namespaced tag prefixes get their own section in the filter rail (§6). */
export const NAMESPACES = [
  { key: 'type', label: 'Technique' },
  { key: 'model', label: 'Target' },
  { key: 'comp', label: 'Competition' },
] as const;

export type Namespace = (typeof NAMESPACES)[number]['key'];

const NAMESPACE_KEYS = new Set<string>(NAMESPACES.map((n) => n.key));

export interface ParsedTag {
  /** Verbatim frontmatter value, e.g. `model:claude-sonnet-4`. */
  raw: string;
  /** Namespace prefix, or null for a free tag. */
  namespace: Namespace | null;
  /** The part after the prefix — what gets shown. */
  value: string;
}

export interface Note {
  slug: string;
  title: string;
  date: Date;
  updated?: Date;
  summary: string;
  tags: ParsedTag[];
  redact: string[];
  draft: boolean;
  readingMinutes: number;
  wordCount: number;
  entry: NoteEntry;
}

export function parseTag(raw: string): ParsedTag {
  const separator = raw.indexOf(':');
  if (separator > 0) {
    const prefix = raw.slice(0, separator);
    if (NAMESPACE_KEYS.has(prefix)) {
      return { raw, namespace: prefix as Namespace, value: raw.slice(separator + 1) };
    }
  }
  return { raw, namespace: null, value: raw };
}

/** Strip enough Markdown to make a body excerpt readable out of context. */
function toPlainText(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[\[([^\][|]+?)(?:\|([^\][]+?))?\]\]/g, (_, target, label) => label ?? target)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveSummary(body: string, override?: string): string {
  if (override) return override;
  const plain = toPlainText(body);
  if (plain.length <= 160) return plain;
  const cut = plain.slice(0, 160);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 100 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:]$/, '')}…`;
}

function countWords(body: string): number {
  const plain = toPlainText(body);
  return plain ? plain.split(' ').length : 0;
}

function toNote(entry: NoteEntry): Note {
  const body = entry.body ?? '';
  const wordCount = countWords(body);
  return {
    slug: entry.id,
    title: entry.data.title,
    date: entry.data.date,
    updated: entry.data.updated,
    summary: deriveSummary(body, entry.data.summary),
    tags: entry.data.tags.map(parseTag),
    redact: entry.data.redact,
    draft: entry.data.draft,
    wordCount,
    readingMinutes: Math.max(1, Math.round(wordCount / 200)),
    entry,
  };
}

let cache: Note[] | null = null;

/**
 * Every note that belongs in this build, newest first.
 *
 * `visibility: private` is dropped unconditionally — not hidden, not noindexed,
 * simply never handed to a route (§6). Drafts survive `astro dev` and are
 * dropped from production.
 */
export async function allNotes(): Promise<Note[]> {
  if (cache) return cache;

  const entries = await getCollection('notes', ({ data }) => {
    if (data.visibility === 'private') return false;
    if (data.draft && import.meta.env.PROD) return false;
    return true;
  });

  const notes = entries.map(toNote).sort((a, b) => b.date.getTime() - a.date.getTime());

  const seen = new Map<string, string>();
  for (const note of notes) {
    const previous = seen.get(note.slug);
    const path = note.entry.filePath ?? note.slug;
    if (previous) {
      throw new Error(
        `Duplicate note slug "${note.slug}": ${previous} and ${path}. ` +
          `Slugs come from the filename, so two files with the same name in ` +
          `different folders collide. Rename one.`,
      );
    }
    seen.set(note.slug, path);
  }

  cache = notes;
  return notes;
}

const WIKILINK = /\[\[([^\][|]+?)(?:\|([^\][]+?))?\]\]/g;

export interface Backlink {
  slug: string;
  title: string;
}

/** slug -> notes that link to it, derived from `[[wikilink]]`s across the collection. */
export async function backlinkMap(): Promise<Map<string, Backlink[]>> {
  const notes = await allNotes();
  const known = new Set(notes.map((n) => n.slug));
  const map = new Map<string, Backlink[]>();

  for (const note of notes) {
    const targets = new Set<string>();
    for (const match of (note.entry.body ?? '').matchAll(WIKILINK)) {
      const target = match[1]
        .trim()
        .split('/')
        .pop()!
        .replace(/\.mdx?$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      if (target === note.slug) continue;
      if (!known.has(target)) {
        console.warn(
          `[yozakura] ${note.slug}: wikilink [[${match[1]}]] resolves to "${target}", which is not a published note.`,
        );
        continue;
      }
      targets.add(target);
    }
    for (const target of targets) {
      const list = map.get(target) ?? [];
      list.push({ slug: note.slug, title: note.title });
      map.set(target, list);
    }
  }

  return map;
}

export interface TagGroup {
  key: Namespace | 'tag';
  label: string;
  tags: { raw: string; value: string; count: number }[];
}

/** Filter rail data: namespaced tags in labelled sections, the rest pooled (§6). */
export async function tagGroups(): Promise<TagGroup[]> {
  const notes = await allNotes();
  const counts = new Map<string, { tag: ParsedTag; count: number }>();

  for (const note of notes) {
    for (const tag of note.tags) {
      const existing = counts.get(tag.raw);
      if (existing) existing.count += 1;
      else counts.set(tag.raw, { tag, count: 1 });
    }
  }

  const groups: TagGroup[] = [];
  for (const { key, label } of NAMESPACES) {
    const tags = [...counts.values()]
      .filter(({ tag }) => tag.namespace === key)
      .map(({ tag, count }) => ({ raw: tag.raw, value: tag.value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    if (tags.length) groups.push({ key, label, tags });
  }

  const free = [...counts.values()]
    .filter(({ tag }) => tag.namespace === null)
    .map(({ tag, count }) => ({ raw: tag.raw, value: tag.value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  if (free.length) groups.push({ key: 'tag', label: 'Tags', tags: free });

  return groups;
}

/**
 * Apply a note's `redact:` phrases to a plain string (index summaries).
 *
 * Whitespace-insensitive for the same reason as the body-text plugin: notes
 * are hard-wrapped, so a phrase routinely spans a line break and a literal
 * match would silently leave the payload uncovered.
 */
export function redactionSegments(
  input: string,
  phrases: string[],
): { text: string; redacted: boolean }[] {
  const active = phrases.filter(Boolean);
  if (!active.length) return [{ text: input, redacted: false }];

  const matches: { start: number; end: number; text: string }[] = [];
  for (const phrase of active) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const pattern = new RegExp(escaped, 'g');
    for (let m = pattern.exec(input); m; m = pattern.exec(input)) {
      if (m[0].length === 0) break;
      matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    }
  }
  if (!matches.length) return [{ text: input, redacted: false }];

  matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const out: { text: string; redacted: boolean }[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue;
    if (match.start > cursor) out.push({ text: input.slice(cursor, match.start), redacted: false });
    out.push({ text: match.text, redacted: true });
    cursor = match.end;
  }

  if (cursor < input.length) out.push({ text: input.slice(cursor), redacted: false });
  return out;
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
