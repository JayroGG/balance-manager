// Pure hex-color helpers for the theme seam (ADR-013). Validation happens at the UI boundary
// (team create / manage); everything downstream trusts a normalized '#RRGGBB'.

export const isValidHex = (value) => /^#?[0-9A-Fa-f]{6}$/.test(value ?? '');

// '7c3aed' | '#7c3aed' → '#7C3AED'; null when invalid.
export const normalizeHex = (value) => {
  if (!isValidHex(value)) return null;
  const hex = value.startsWith('#') ? value.slice(1) : value;
  return `#${hex.toUpperCase()}`;
};

// Readable text color on a given background — YIQ luminance picks dark text on light accents so a
// custom team color (e.g. a pale yellow) never yields white-on-light buttons.
export const contrastOn = (hex) => {
  const value = normalizeHex(hex);
  if (!value) return '#FFFFFF';
  const r = parseInt(value.slice(1, 3), 16);
  const g = parseInt(value.slice(3, 5), 16);
  const b = parseInt(value.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 150 ? '#16181D' : '#FFFFFF';
};

// Soft pastel hues derived from an accent (hex), for the blurred glass backdrop (ADR-027). Same hue plus two
// neighbours; light mode is bright and airy, dark mode deeper so the white glass wash still reads.
export const pastelPalette = (hex, scheme = 'light') => {
  const m = /^#?([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/.exec(hex ?? '');
  const [r, g, b] = m ? [m[1], m[2], m[3]].map((x) => parseInt(x, 16) / 255) : [0.15, 0.39, 0.92];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = (h * 60 + 360) % 360;
  const l = scheme === 'dark' ? 0.42 : 0.8;
  const s = scheme === 'dark' ? 0.55 : 0.85;
  const hsl = (hue) => `hsl(${Math.round((hue + 360) % 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
  return [hsl(h), hsl(h + 38), hsl(h - 38)];
};
