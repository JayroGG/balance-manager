const fs = require('fs');
const path = require('path');

// RN 0.85 removed StyleSheet.absoluteFillObject: spreading it yields nothing, silently, so a face that relied on it
// collapsed to ~0 height on device while jest stayed green (ADR-027). Use StyleSheet.absoluteFill or explicit edges.
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(js|jsx)$/.test(e.name) && !e.name.endsWith('.test.js') ? [p] : [];
  });

it('no source file uses the removed StyleSheet.absoluteFillObject', () => {
  const offenders = walk(path.join(__dirname, '..'))
    .filter((f) => /\.\.\.\s*StyleSheet\.absoluteFillObject/.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(path.join(__dirname, '..', '..'), f));
  expect(offenders).toEqual([]);
});
