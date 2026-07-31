// @ts-check
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import mdx from '@astrojs/mdx';

import { yozakuraLightTheme, yozakuraTheme } from './src/lib/markdown/theme.mjs';
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
      /*
       * Both themes, and no default colour: Shiki then writes --shiki-light and
       * --shiki-dark onto every token instead of a hard `color`, and content.css
       * chooses between them. Without this the block keeps its dark-mode inks on
       * light mode's pale --bark and the code is unreadable (§7.6).
       */
      themes: { dark: yozakuraTheme, light: yozakuraLightTheme },
      defaultColor: false,
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
