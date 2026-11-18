# Portable authored typography

## Intent and authorization

Close a concrete North Star gap: the authored page must carry the chosen font files instead of depending on fonts installed on its recipient’s computer. Blake has authorized autonomous improvements toward North Star while preserving Cat Samurai, customer safety, existing behavior and thorough testing. This implementation decision uses that standing authorization.

## Approaches and choice

1. Runtime remote font CSS: small initial download, but external availability/privacy and offline rendering remain uncertain.
2. Async local font loading: bounded assets, but adds a new loading/failure/owner-lifetime dependency to export.
3. **Chosen: a small checked-in font catalog, embedded synchronously by the existing renderer.** Selected assets travel inside the same CSS in preview, single HTML and editable ZIP. This increases the app bundle but retains current lifecycle protections.

The authored panel and its catalog load together when Studio or Stratosphere mounts the panel for an authored website. Garden and availability checks use no font bytes from this catalog. The panel shows a loading status, and a load failure can be retried inside the panel while the surrounding work stays available. Once the panel mounts, rendering and download preparation use the existing path.

## Contract

- Cover the three Stratosphere pairs: Instrument Serif / Instrument Sans, Space Grotesk / IBM Plex Sans, Newsreader / Literata. Only normal styles needed by the existing renderer; supply real400/600 weights where available, Instrument Serif heading400.
- Development-time acquisition from official Google Fonts sources, exact hashes, provenance and matching OFL notices; do not modify source fonts. Declare subset/glyph coverage honestly.
- A deterministic generated catalog (base64 plus license/provenance) stays below1MiB; embedded CSS includes only selected families, deduplicated. Use fixed versioned CSS aliases and data:font/woff2 sources, no local() or runtime remote fetch.
- Pure helper buildEmbeddedFonts(headingFont,bodyFont) returns CSS, stacks, actual heading weight, included/missing families and fixed-name supporting files/license notice. Unsupported choices retain local fallbacks and clear readiness notes. No arbitrary uploads/URLs or executable font-CSS input.
- buildAuthoredPage retains its same-renderer contract, sandbox, owner/revision export guards, no scripts and no network resources. Standalone HTML retains selected licenses; ZIP retains identical CSS and selected license/provenance files.
- Existing customer-app scoped packs and remote Studio specimen font loading remain unchanged in this slice. Do not claim a delivered full application or actual clean-device rendering without browser evidence.

## Acceptance

Tests cover all six families/three pairs, exact font bytes/hashes and WOFF2 magic, declared weights/subsets, selected-only dedup, unknown/hostile inputs, license retention, preview/standalone/editable parity and no remote CSS URLs. Production build stays within catalog cap. Rendered browser acceptance remains blocked until the supported browser works; source tests do not substitute for it.
