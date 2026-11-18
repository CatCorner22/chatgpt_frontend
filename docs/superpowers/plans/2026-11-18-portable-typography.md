# Portable Typography Implementation Plan

> **For agentic workers:** Use subagent-driven-development for bounded implementation and independent review. Existing user authorization covers execution.

**Goal:** Preserve selected typography across authored preview, HTML and ZIP delivery.
**Architecture:** A bounded, versioned asset catalog feeds a pure helper consumed by the existing renderer. No new runtime requests or asynchronous export state.
**Tech Stack:** Existing TypeScript/React/Vite/Vitest; Node generation script and WOFF2 assets; no new dependencies.
**Spec:** docs/superpowers/specs/2026-11-18-portable-typography-design.md

## Global Constraints

- Six named families, normal styles only, real weights, generated catalog <=1MiB.
- Fixed aliases; selected-only data:font/woff2; no arbitrary URLs, local() resolution or runtime remote font request.
- Keep existing owner/revision guards, pure renderer, sandbox, content/Undo and customer pack contracts.
- Licenses/provenance accompany standalone and editable outputs; missing coverage explicitly falls back.
- Browser/customer acceptance remains unverified while capture infrastructure is blocked.

## Review Focus

- Hostile saved font names cannot introduce CSS or HTML.
- Mixed included/missing families do not claim complete embedding.
- Same family in both roles is embedded once.
- Instrument Serif is not silently fake-bolded at600.
- A malicious/broken font asset or omitted license fails catalog generation/verification.

## Tasks

- [x] 1. Official assets: brand_names owns assets/vendor-fonts only; inspect licenses, source URLs, SHA256, WOFF2 metadata and bounds.
- [x] 2. Pure catalog/helper + renderer: isolated implementation agent owns scripts/generate-authored-fonts.mjs, generated src/lib/authored-fonts.data.json, src/lib/authored-fonts.ts, src/lib/authored-page.ts and corresponding tests. Establish failing assertions, implement, run narrow tests/TS/lint, produce report. Root integrates no overlapping edits.
- [x] 3. Root updates Stratosphere learning/availability explanations and the authored browser-runner’s explicit Studio destination. Test relevant behavior; do not run alternate browser automation as a workaround.
- [x] 4. Independently review exact changed boundaries and licensing; fix material findings, then full app tests, types and changed lint. 1,009 tests / 93 files pass. The authored panel is lazily loaded with a scoped retry, keeping font bytes out of the Garden entry path without adding an asynchronous export step.
- [ ] 5. Commit/push exact source, preserve owner-only publication, verify deployed assets; record evidence and next source-aware trial-patch work without asserting North Star equivalence.

Post-commit build/package/publication results for task 5 are recorded beside the exact archive in `/workspace/deliverables/focus-typography-release.json`. The user's additional welcome-page request is included: five practice stations, nineteen terms, a revisable choices summary, brief/deeper controls and no project mutation. See `docs/FIELD-GUIDE-SOURCES.md` and `docs/PORTABLE-TYPOGRAPHY-RELEASE.md`.
