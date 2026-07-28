import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Slug comes from the filename only — subfolders are organisational, never
 * taxonomy (§6). Collisions across folders are caught in src/lib/notes.ts.
 */
export function slugFromPath(entryPath: string): string {
  return entryPath
    .split('/')
    .pop()!
    .replace(/\.mdx?$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const notes = defineCollection({
  loader: glob({
    base: './src/content/notes',
    pattern: '**/*.{md,mdx}',
    generateId: ({ entry }) => slugFromPath(entry),
  }),
  // Three required fields. That is the whole ritual (§6) — do not add a fourth.
  // `.strict()` turns a typo'd optional field into a build failure rather than
  // a silently ignored line.
  schema: z
    .object({
      title: z.string().min(1, 'title must not be empty'),
      date: z.coerce.date(),
      tags: z.array(z.string().min(1)).min(1, 'at least one tag is required'),

      visibility: z.enum(['public', 'private']).default('public'),
      draft: z.boolean().default(false),
      summary: z.string().optional(),
      updated: z.coerce.date().optional(),
      redact: z.array(z.string().min(1)).default([]),
    })
    .strict(),
});

export const collections = { notes };
