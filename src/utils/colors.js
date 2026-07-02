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
