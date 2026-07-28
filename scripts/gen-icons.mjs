/**
 * PWA icons (§9): a single five-petal blossom in --blossom on --yozakura.
 * Same petal path as the branch buds, so the app icon and the signature
 * element are literally the same glyph.
 *
 * Run: node scripts/gen-icons.mjs   (writes public/icons + public/favicon.svg)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const YOZAKURA = '#16121C';
const BLOSSOM = '#E890AC';
const PETAL = '#F2DCE4';

/** The §7.5A petal, drawn tip-up around the origin. */
const PETAL_PATH =
  'M0,-2.4 C-3.4,-4.6 -4.6,-8 -2.8,-10.8 L0,-9 L2.8,-10.8 C4.6,-8 3.4,-4.6 0,-2.4 Z';

/**
 * @param scale  blossom radius as a fraction of the canvas half-width.
 *               0.72 fills the tile; 0.46 keeps it inside the maskable safe zone.
 */
function blossomSvg(scale, background = YOZAKURA) {
  // The petal path spans roughly 11 units from the origin.
  const factor = (scale * 16) / 11;
  const petals = [0, 72, 144, 216, 288]
    .map(
      (angle) =>
        `<g transform="rotate(${angle})"><path d="${PETAL_PATH}" fill="${BLOSSOM}"/></g>`,
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" fill="${background}"/>
  <g transform="translate(16 16) scale(${factor.toFixed(4)})">
    ${petals}
    <circle r="1.5" fill="${PETAL}"/>
  </g>
</svg>`;
}

await mkdir('public/icons', { recursive: true });

const targets = [
  { file: 'public/icons/icon-192.png', size: 192, scale: 0.72 },
  { file: 'public/icons/icon-512.png', size: 512, scale: 0.72 },
  // Maskable: generous padding inside the safe zone (§9).
  { file: 'public/icons/icon-512-maskable.png', size: 512, scale: 0.46 },
];

for (const { file, size, scale } of targets) {
  await sharp(Buffer.from(blossomSvg(scale)))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log(`gen-icons: ${file} (${size}px)`);
}

// Favicon uses a transparent ground so it sits on any browser chrome.
await writeFile('public/favicon.svg', blossomSvg(0.78, 'none'), 'utf8');
console.log('gen-icons: public/favicon.svg');
