# GoJet V5 Brand Asset Contract

GJ-V5-002 requires the final production brand set below:

```text
logo-full-light.svg
logo-full-dark.svg
logo-mark.svg
favicon.svg
favicon.ico
apple-touch-icon.png
og-brand.png
```

## Current status

The frozen V4 repository does **not** contain a canonical committed GoJet logo set. V4 loads `brand.logo_url` / `brand.favicon_url` from public settings at runtime and falls back to text branding if the image fails. Therefore P02 does not fabricate or promote an unverified legacy asset into this directory.

The filenames above are reserved. A final file may be added only after its source/ownership is known and it has passed the visual acceptance rules below.

## Usage

- Mark safe area: at least `0.5 × mark height`.
- Website header logo: 28–32px high.
- Workspace sidebar logo: 28px high.
- Docs header logo: 26–28px high.
- Do not stretch, recolor, outline, glow or place the mark on a low-contrast complex photo.
- Light/dark assets must preserve the same geometry.
- Runtime white-label/site branding, if retained as a business capability, must be implemented explicitly and must not mutate the canonical GoJet Design System tokens globally as V4 did.
