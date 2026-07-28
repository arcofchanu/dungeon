/**
 * Unit tests for the Markdown text plugin. Runs the visitor against synthetic
 * hast text nodes so redaction/wikilink behaviour can be checked without the
 * whole Astro pipeline in the way.
 *
 *   node scripts/test-plugins.mjs
 */
import assert from 'node:assert/strict';
import { yozakuraTextPlugin } from '../src/lib/markdown/plugins.mjs';

const plugin = yozakuraTextPlugin();

/** Minimal HastVisitorContext stand-in: a flat tree with a known ancestry. */
function makeCtx(frontmatter, ancestors = []) {
  return {
    data: { astro: { frontmatter } },
    parent(node) {
      const index = ancestors.indexOf(node);
      if (index === -1) return ancestors[0];
      return ancestors[index + 1];
    },
  };
}

function textNode(value) {
  return { type: 'text', value };
}

function serialise(node) {
  if (!node) return null;
  if (node.type === 'text') return node.value;
  const classes = node.properties?.className ?? node.properties?.class ?? '';
  const name = Array.isArray(classes) ? classes.join('.') : String(classes);
  return `<${node.tagName}${name ? '.' + name : ''}>` + (node.children ?? []).map(serialise).join('') + `</${node.tagName}>`;
}

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures++;
    console.error(`  FAIL ${name}\n       ${error.message}`);
  }
}

console.log('plugin: redaction');

test('redacts a phrase on a single line', () => {
  const ctx = makeCtx({ redact: ['attention window'] });
  const out = plugin.text(textNode('Filling the attention window with filler.'), ctx);
  assert.match(serialise(out), /<span\.redaction>/);
});

test('redacts a phrase spanning a hard line wrap', () => {
  // This is the case that was silently failing: notes are wrapped at ~80
  // columns, so the body text carries a newline the frontmatter does not.
  const ctx = makeCtx({ redact: ['a base64 tool argument'] });
  const value = 'Encoding the exfiltration path as a base64 tool\nargument to a call.';
  const out = plugin.text(textNode(value), ctx);
  assert.notEqual(out, undefined, 'visitor returned nothing — phrase was not matched');
  const html = serialise(out);
  assert.match(html, /<span\.redaction>/);
  assert.match(html, /a base64 tool\nargument/);
});

test('is case sensitive (deliberately)', () => {
  const ctx = makeCtx({ redact: ['the readme vector'] });
  const out = plugin.text(textNode('The README vector is different.'), ctx);
  assert.equal(out, undefined);
});

test('redacts every occurrence', () => {
  const ctx = makeCtx({ redact: ['secret'] });
  const out = plugin.text(textNode('a secret and another secret here'), ctx);
  const html = serialise(out);
  assert.equal((html.match(/<span\.redaction>/g) ?? []).length, 2);
});

test('longer phrase wins on overlap', () => {
  const ctx = makeCtx({ redact: ['live payload', 'live payload vault'] });
  const out = plugin.text(textNode('the live payload vault is here'), ctx);
  assert.match(serialise(out), /live payload vault<\/span>/);
});

test('no redact frontmatter leaves text alone', () => {
  const ctx = makeCtx({});
  assert.equal(plugin.text(textNode('nothing to do here'), ctx), undefined);
});

console.log('plugin: wikilinks');

test('converts [[slug]]', () => {
  const out = plugin.text(textNode('see [[context-overloading]] for more'), makeCtx({}));
  const html = serialise(out);
  assert.match(html, /<a\.wikilink>context-overloading<\/a>/);
});

test('converts [[slug|label]] and strips folders', () => {
  const out = plugin.text(textNode('see [[gsa/june26-writeup|the write-up]]'), makeCtx({}));
  assert.match(serialise(out), /<a\.wikilink>the write-up<\/a>/);
});

test('redaction applies inside wikilink-split text', () => {
  const ctx = makeCtx({ redact: ['hidden thing'] });
  const out = plugin.text(textNode('a hidden thing and [[a-note]] after'), ctx);
  const html = serialise(out);
  assert.match(html, /<span\.redaction>/);
  assert.match(html, /<a\.wikilink>/);
});

console.log(failures === 0 ? '\nplugin tests: all passed' : `\nplugin tests: ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
