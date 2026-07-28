/**
 * Yozakura Shiki theme — every colour traces to a §7.2 token.
 * Shiki needs literal hex, so the token values are mirrored here and nowhere else.
 */

export const TOKENS = {
  yozakura: '#16121C',
  bark: '#241C2B',
  petal: '#F2DCE4',
  dusk: '#9B8DA6',
  blossom: '#E890AC',
  fallen: '#9E3B5C',
  branch: '#3A2E42',
  stem: '#7A4A5C',
};

/** --petal at 90% opacity, per §7.6. */
const petal90 = `${TOKENS.petal}E6`;

/** @type {import('shiki').ThemeRegistration} */
export const yozakuraTheme = {
  name: 'yozakura',
  type: 'dark',
  colors: {
    'editor.background': TOKENS.bark,
    'editor.foreground': TOKENS.petal,
  },
  tokenColors: [
    {
      scope: ['comment', 'punctuation.definition.comment', 'string.comment'],
      settings: { foreground: TOKENS.dusk, fontStyle: 'italic' },
    },
    {
      scope: [
        'keyword',
        'keyword.control',
        'keyword.operator',
        'storage',
        'storage.type',
        'storage.modifier',
        'variable.language',
        'entity.name.tag',
        'support.type',
        'markup.heading',
        'entity.other.attribute-name',
      ],
      settings: { foreground: TOKENS.blossom },
    },
    {
      scope: [
        'string',
        'string.quoted',
        'string.template',
        'constant.character.escape',
        'markup.inserted',
      ],
      settings: { foreground: TOKENS.stem },
    },
    {
      scope: [
        'entity.name.function',
        'support.function',
        'meta.function-call',
        'variable.function',
      ],
      settings: { foreground: petal90 },
    },
    {
      scope: [
        'constant.numeric',
        'constant.language',
        'constant.other',
        'support.constant',
        'markup.deleted',
      ],
      settings: { foreground: TOKENS.fallen },
    },
    {
      scope: [
        'punctuation',
        'punctuation.separator',
        'punctuation.terminator',
        'punctuation.definition',
        'meta.brace',
        'meta.delimiter',
      ],
      settings: { foreground: TOKENS.dusk },
    },
    {
      scope: [
        'variable',
        'variable.other',
        'meta.definition.variable',
        'entity.name.type',
        'entity.name.class',
        'support.class',
      ],
      settings: { foreground: TOKENS.petal },
    },
  ],
};
