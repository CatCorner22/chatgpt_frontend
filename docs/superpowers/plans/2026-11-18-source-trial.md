# Source-aware Target trial implementation

Design: [source trial](../specs/2026-11-18-source-trial-design.md). Existing user authorization covers the build and normal private publication; no additional action on a customer repository is authorized or implemented.

- [x] Core: bounded parser, preserved-span transformation, actual forward/inverse patches, deterministic contract and whole-file snapshot verification. Owner: `portable_type`.
- [x] Package: fixed-path ZIP, read-only recipient checker and plain instructions; executable verifier tests on owned temporary files. Owner: `cat_name_character`.
- [x] UX: lazy optional Target panel with local-only source state, role confirmation and current-context download guards. Owner: `customer_learning_review`.
- [x] Owned fixture: actual React/Vite build, before/after task proof, Git patch/reversal and drift checks. Owner: `brand_names`.
- [x] Independent review: parser, CSS scope/state, verifier filesystem boundary, stale source/owner and evidence claims. Owner: `handoff_audit`; implementation owners fixed findings.
- [x] Root: integrated suite (1,094 tests / 97 files), strict types and changed-file lint pass.
- [ ] Root release: exact source/build/package provenance, owner-only publication and live read-only checks. Preserve version 8 for code rollback. The final receipt is `/workspace/deliverables/focus-source-trial-release.json`; build and publication status must be read there, not inferred from this implementation checklist.

Use meaningful failing tests before new behavior. Do not add implementation-mirroring assertions or perform customer-code execution. Record findings and fix them before release. Browser and real-customer acceptance remain separate, unrun requirements while their prerequisites are unavailable.
