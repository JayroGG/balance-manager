// Regenerates every PNG in assets/ from the brand SVG geometry below.
// sharp is not a project dep — install it transiently, then run:
//   npm i --no-save sharp && node scripts/generate-brand-assets.js
//
// Brand mark (ADR-016): the Balance Ring — blue arc = available, green arc = allocated,
// small gaps = flow out — with a minimal lowercase "b" at the center.

const sharp = require('sharp');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets');

// Palette mirrors src/components/theme.js (DEFAULT_ACCENT / light.success).
const BLUE = '#2563EB';
const GREEN = '#16A34A';
const DARK = '#0F172A'; // brand navy (icon bg)
const WHITE = '#FFFFFF';

const CX = 512;
const CY = 512;
const R = 380; // ring centerline radius
const RING_W = 110;
const GLYPH_W = 102;

const pt = (deg) => {
  const rad = (deg * Math.PI) / 180;
  return `${(CX + R * Math.cos(rad)).toFixed(2)} ${(CY + R * Math.sin(rad)).toFixed(2)}`;
};

// Arc from a1 to a2 (degrees, increasing = clockwise on screen)
const arc = (a1, a2, color) => {
  const large = a2 - a1 > 180 ? 1 : 0;
  return `<path d="M ${pt(a1)} A ${R} ${R} 0 ${large} 1 ${pt(a2)}" stroke="${color}" stroke-width="${RING_W}" stroke-linecap="round" fill="none"/>`;
};

const logo = (glyphColor) => `
  ${arc(323, 557, BLUE)}
  ${arc(223, 297, GREEN)}
  <line x1="393" y1="312" x2="393" y2="695" stroke="${glyphColor}" stroke-width="${GLYPH_W}" stroke-linecap="round"/>
  <circle cx="514" cy="574" r="121" stroke="${glyphColor}" stroke-width="${GLYPH_W}" fill="none"/>
`;

const svg = ({ bg = null, glyphColor = WHITE, scale = 1, mono = null, cornerR = 0 }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  ${bg ? `<rect width="1024" height="1024" rx="${cornerR}" fill="${bg}"/>` : ''}
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    ${mono ? logo(mono).replace(new RegExp(`${BLUE}|${GREEN}`, 'g'), mono) : logo(glyphColor)}
  </g>
</svg>`;

const render = (name, svgStr, size) =>
  sharp(Buffer.from(svgStr), { density: 300 }).resize(size, size).png().toFile(path.join(OUT, name));

(async () => {
  // iOS / main icon: full-bleed dark
  await render('icon.png', svg({ bg: DARK, scale: 0.88 }), 1024);
  // Android adaptive foreground: transparent, logo inside the 66% safe zone
  await render('android-icon-foreground.png', svg({ scale: 0.66 }), 512);
  await render('android-icon-background.png', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${DARK}"/></svg>`, 512);
  // Android 13+ themed icon: single-color glyph
  await render('android-icon-monochrome.png', svg({ scale: 0.66, mono: WHITE }), 432);
  // Splash logos (transparent): navy glyph on the light splash, white on the dark one
  await render('splash-icon.png', svg({ glyphColor: DARK, scale: 0.92 }), 1024);
  await render('splash-icon-dark.png', svg({ glyphColor: WHITE, scale: 0.92 }), 1024);
  // Expo Go splash (top-level `splash` key): Expo Go fits the image to screen width, so the
  // logo needs heavy padding to end up ~175pt wide
  await render('splash-icon-go.png', svg({ glyphColor: DARK, scale: 0.45 }), 1024);
  await render('favicon.png', svg({ bg: DARK, scale: 0.88, cornerR: 180 }), 48);
  console.log('brand assets written to assets/');
})();
