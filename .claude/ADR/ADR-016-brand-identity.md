# ADR-016 — Brand identity: the Balance Ring mark, app icons, splash, branded loader

- **Status:** Accepted
- **Date:** 2026-07-14
- **Deciders:** Jayro + mobile agent
- **Supersedes / Related:** builds on ADR-013 (theming, `DEFAULT_ACCENT`); replaces the default Expo placeholder assets

## Context

The app shipped with Expo's placeholder icon/splash and a bare `ActivityIndicator` as its loader —
no visual identity. Jayro's concept exploration (with an external LLM, `propose.md`) proposed three
directions: a **Balance Ring** (segmented ring + negative-space B), a vault-with-arrows, and a
bars-forming-a-B ledger mark, with a `#2563EB`-primary palette.

Constraints: assets must be generated reproducibly (no design tool in the loop), the loader must run
in **Expo Go** (no `lottie-react-native`, no `react-native-svg` dependency added for one spinner),
and the brand should reuse the theme palette so app and icon read as one system.

## Decision

**Mark — the Balance Ring, simplified:** a thick ring of two round-capped arcs — **blue
(`#2563EB` = `DEFAULT_ACCENT`) for available, green (`#16A34A` = `light.success`) for allocated** —
with two small gaps (flow), and a **solid minimal lowercase "b"** centered inside. The proposal's
*negative-space* B was rejected deliberately: at 48×48 px a negative-space letter inside a segmented
ring is illegible; a solid glyph keeps the meaning and survives small sizes. Brand dark is `#0F172A`.

**Assets (all generated, never hand-edited):** `scripts/generate-brand-assets.js` holds the SVG
geometry and renders every PNG in `assets/` via `sharp` (`npm i --no-save sharp && node scripts/generate-brand-assets.js`):
`icon.png` (dark, full-bleed), `android-icon-foreground.png` (safe-zone scaled) + dark
`backgroundColor` + `android-icon-monochrome.png` (wired via `adaptiveIcon.monochromeImage` for
Android 13+ themed icons), light/dark `splash-icon*.png`, `favicon.png`.

**Splash:** `expo-splash-screen` config gains a `dark` variant; backgrounds match the in-app theme
(`#F7F8FA` light / `#0F1115` dark) so the splash dissolves into the first screen instead of flashing.

**Loader:** `BrandSpinner` (`src/components/ui/`) — the ring as a rotating bordered `View`
(blue border, green top segment), pure RN `Animated`, colors from `useTheme()` so it follows the
team accent. It replaces the spinner only in `QueryBoundary` (section/screen loading); tiny inline
spinners (button loading, delete icons) stay `ActivityIndicator`.

**North star (deferred):** Lottie-based animated brand moments (Netflix-style intro, animated
splash-to-app handoff) once a dev build exists; the static assets and `BrandSpinner` seam are the
placeholders they'd replace.
*Update 2026-07-14:* the splash-to-app handoff shipped **without Lottie** — `AnimatedSplash`
(`src/components/`) stacks generated ring/glyph layer PNGs (`brand-ring.png`, `brand-glyph*.png`,
same geometry as `splash-icon.png`) over a splash-matched background and rotates the ring with
pure RN `Animated` (2 revs + landing pop + fade). Lottie remains the north star only for richer
moments.

## Consequences

- **Positive:** one palette across icon, splash, loader, and theme; assets regenerate from one
  script (icon tweaks are a code diff, not a binary blob mystery); Expo Go compatibility intact.
- **Negative / trade-offs:** the ring loader approximates the mark (border-quadrant trick can't do
  the two small gaps); `sharp` is install-on-demand rather than a devDependency.
- **Follow-ups:** iOS splash uses the light/dark image pair only after `npx expo prebuild`/EAS build
  regenerates native projects; Expo Go shows its own shell until then.

## Alternatives considered

- **Negative-space B ring (proposal as written)** — rejected: fails the 48 px legibility test.
- **Vault + arrows / ledger-bars concepts** — rejected: vault reads as "banking/security", bars read
  as generic charts; the ring maps directly to the product's core model (total = allocated + available).
- **`react-native-svg` or Lottie for the loader now** — rejected: new native-adjacent dep for one
  spinner; the bordered-View ring is dep-free and visually close.
