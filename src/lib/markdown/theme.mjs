/**
 * Yozakura Shiki themes — every colour traces to a §7.2 token.
 * Shiki needs literal hex, so the token values are mirrored here and nowhere else.
 *
 * Two themes, because a code block is the one place the palette cannot be left
 * to CSS custom properties: Shiki stamps the colour on every token at build
 * time. With one dark theme, light mode painted --petal text (near-white) onto
 * a --bark block (pale pink) and the code disappeared. Both themes are emitted
 * as --shiki-light / --shiki-dark variables and content.css picks one (§7.6).
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

/** The light theme's §7.2 values — a second palette, not an inversion. */
export const LIGHT_TOKENS = {
  yozakura: '#FAF3F5',
  bark: '#F0E4E9',
  petal: '#2A2030',
  dusk: '#6F6076',
  blossom: '#B64C72',
  fallen: '#9E3B5C',
  branch: '#D9C7D0',
  stem: '#C58EA1',
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

/**
 * The same theme on paper. Same scopes, same five inks, but the palette is
 * re-dealt for a --bark that is now pale rather than dark — a colour that is
 * legible *on* the night block is frequently the colour that vanishes *into*
 * the paper one. So the assignment is by weight, darkest ink to commonest
 * scope, measured against the block's own #F0E4E9:
 *
 *   text, variables, functions  --petal            13.9:1
 *   strings                     --stem, dark        6.8:1
 *   keywords                    --fallen            6.2:1
 *   comments, punctuation       --dusk              5.6:1
 *   constants                   --blossom           4.9:1  (the rarest scope)
 *
 * Two of those are the *dark* theme's values used as ink on paper, which is
 * still §7.2 — one palette, two arrangements of it.
 *
 * @type {import('shiki').ThemeRegistration}
 */
export const yozakuraLightTheme = {
  name: 'yozakura-light',
  type: 'light',
  colors: {
    'editor.background': LIGHT_TOKENS.bark,
    'editor.foreground': LIGHT_TOKENS.petal,
  },
  tokenColors: yozakuraTheme.tokenColors.map(({ scope, settings }) => ({
    scope,
    settings: { ...settings, foreground: lightInk(settings.foreground) },
  })),
};

/** Map one dark-theme ink to its paper equivalent. */
function lightInk(foreground) {
  switch (foreground) {
    case TOKENS.dusk:
      return LIGHT_TOKENS.dusk; // comments, punctuation
    case TOKENS.blossom:
      return LIGHT_TOKENS.fallen; // keywords
    case TOKENS.stem:
      return TOKENS.stem; // strings — the dark theme's --stem, as ink
    case TOKENS.fallen:
      return LIGHT_TOKENS.blossom; // constants
    case petal90:
      // Functions go to full strength on paper: 90% of a near-white on a dark
      // block is a shade, 90% of a near-black on a pale one is a smudge.
      return LIGHT_TOKENS.petal;
    default:
      return LIGHT_TOKENS.petal;
  }
}
