// @ts-check
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import mdx from '@astrojs/mdx';

import { yozakuraTheme } from './src/lib/markdown/theme.mjs';
import { yozakuraTextPlugin, yozakuraFenceTransformer } from './src/lib/markdown/plugins.mjs';

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://yozakura.pages.dev',
  integrations: [mdx()],
  build: {
    // Pagefind indexes `dist/`; directory-style output keeps note URLs stable.
    format: 'directory',
  },
  markdown: {
    processor: satteri({
      hastPlugins: [yozakuraTextPlugin()],
    }),
    shikiConfig: {
      theme: yozakuraTheme,
      wrap: false,
      transformers: [yozakuraFenceTransformer],
    },
  },
  vite: {
    build: {
      // GSAP is the only client bundle; keep it one file so the budget is legible.
      assetsInlineLimit: 0,
    },
  },
});
