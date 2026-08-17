# GoJet V5 — P02 Brand Foundation Acceptance

**Specification:** GJ-V5-002  
**Phase:** P02  
**Scope:** brand foundations only — no P03 component completion claims.

## 1. Frozen code sources

| Concern | Source | Contract |
|---|---|---|
| Brand / surface / status color | `frontend/packages/tokens/src/tokens.css` | semantic CSS variables only |
| Typography | `frontend/packages/tokens/src/tokens.css` | Inter-first Latin, system CJK fallback, frozen scale |
| Spacing / radius / elevation | `frontend/packages/tokens/src/tokens.css` | 4px grid and GJ-V5-002 scales |
| Light / Dark / System | `tokens.css` + `tokens/src/theme.ts` | `light`, `dark`, and attribute-less `system` |
| Motion | `frontend/packages/motion/src/motion.css` | Levels, breathing, float, Jet Path, reduced motion |
| Functional icons | `frontend/packages/icons/src/index.ts` | Lucide is the sole default functional icon source |
| Brand icon licensing | `frontend/packages/icons/BRAND-ASSET-LICENSES.md` | explicit source/terms register |
| External imagery | `frontend/assets/ATTRIBUTION.md` | self-host + attribution register |
| GoJet logo contract | `frontend/assets/brand/README.md` | reserved canonical asset set and usage rules |

## 2. V4 brand asset audit

The frozen V4 tree does not contain a canonical committed logo set. `frontend/shared/brandruntime.js` obtains `brand.logo_url`, `brand.favicon_url`, `site.name`, and `brand.primary_color` from `/api/public/settings`; image failure falls back to text branding.

P02 decision:

- do not fabricate a V5 logo from the old text fallback;
- do not claim a settings URL is a canonical source asset;
- reserve the GJ-V5-002 filenames for a verified brand set;
- do not carry V4's arbitrary primary-color mutation into core V5 semantic tokens;
- if white-label branding remains a product capability, implement it as an explicit capability later without collapsing brand and semantic status colors.

## 3. Theme contract

`ThemePreference = "light" | "dark" | "system"`.

- `light`: `data-theme="light"`.
- `dark`: `data-theme="dark"`.
- `system`: no `data-theme`; CSS `prefers-color-scheme` selects the active aliases.
- Theme preference is visually scoped and not coupled to authentication/session persistence.

## 4. Motion contract

P02 freezes four levels:

- Feedback: 120–180ms.
- Transition: 180–320ms.
- Product motion: 350–650ms.
- Brand ambient: 5–10s.

Brand ambient primitives implement the specified 8s/10s breathing phases, approximately ±8px product float, and Jet Path progress. `prefers-reduced-motion: reduce` removes infinite ambient/path/float animations and retains information-preserving opacity feedback.

## 5. Typography / font asset rule

The token stack supports `InterVariable, Inter` for Latin and system CJK fallbacks. P02 does not commit or redistribute font binaries. If self-hosted Inter assets are later added, they must be deliberately sourced, subset and licensed; CJK remains system-first to avoid loading a full webfont payload.

## 6. P02 automated gate

`frontend/scripts/verify-brand-foundation.mjs` must fail when:

- a required GJ-V5-002 token disappears;
- Light/Dark/System contract disappears;
- reduced-motion handling disappears;
- Lucide ceases to be the declared default functional icon source;
- asset/license registers disappear;
- an application source introduces raw hexadecimal colors instead of consuming semantic tokens.

This gate deliberately scans V5 `apps/`, not frozen V4 legacy frontend directories.

## 7. Exit criteria

P02 is DONE only when, on one exact V5 HEAD:

- [ ] frozen-lock install passes;
- [ ] P01 Web Storage guard remains green;
- [ ] strict TypeScript remains green;
- [ ] all independent builds remain green;
- [ ] Docs EN/zh-CN static output remains green;
- [ ] Workspace/Admin route split checks remain green;
- [ ] P02 brand-foundation verifier passes.

P03 starts only after all boxes above are evidenced by CI. P02 does not claim Button/Input/DataTable/Shell completion.
