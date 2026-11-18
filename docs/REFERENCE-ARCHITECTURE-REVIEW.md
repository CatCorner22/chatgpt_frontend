# Reference composition architecture review

Reviewed 2026-11-18. Scope: the current authored renderer, saved page settings, image assets, exports, undo/version history, and their integration boundaries. The next design pass uses Audi.com and Firehouse.com as quality references; this code review did not inspect those sites and makes no claim to reproduce or equal their design quality.

Method: `pilchard-forensic-audit`, using the data, state, lifecycle, boundaries, failure, customer, and maintainability lenses. An independent agent repeated the asset and persistence analysis. Application source was not changed in this review. Findings below distinguish executable evidence from proposed integration requirements.

## Review contract

- Outcome: identify defects and constraints before adding two compositions, provisionally `showcase` and `journal`.
- Protected behavior: existing Studio/Editorial/Product saves; escaped owner content; native working navigation; honest readiness notes; browser-local images; portable standalone HTML and editable source; undo, version history, and artifact-bound launch evidence.
- Valuable assets and boundaries: owner words and uploaded bytes enter browser storage, generated HTML/CSS, source ZIPs, and optionally account project records. A successful export or save must describe what it actually preserved.
- Acceptance checks: reproduce suspected persistence failures, run affected tests, check migration registrations, and identify delivery/restore contracts. New layouts need their own rendered-browser checks after implementation.
- Authorization: this assignment authorizes read-only application review and this document. It does not authorize deployment, hosted mutations, paid AI, schema changes, or copying reference-site assets.

## Verified findings

### P2: a composition change does not create a recoverable saved version

Affected paths: `src/lib/library.ts:103–120`, plus `libState()` in `src/routes/index.tsx`, which removes the studio undo timeline before archiving.

Reproduction: bundle the existing library functions with esbuild, call `withVersion()` for a Studio state, then call it with identical tokens and `page.composition: "editorial"`; attempt `restoreVersion(entries, id, 0, at)`.

Expected: an earlier saved version retains Studio when a user changes the page layout. Observed:

```json
{"after":"editorial","versions":0,"restored":"editorial"}
```

Cause: `look()` compares normalized tokens only. Page settings and content are not part of its identity. The current studio timeline can still undo recent edits; the defect is the saved library's version history, particularly after reopening another design.

Recommended fix: include canonical page settings in version identity. Decide when text edits create checkpoints so typing does not consume the ten-version history one character at a time. If content is included, coalesce a text-edit session or checkpoint it explicitly. Add a regression proving the prior composition and image reference survive switching/reopening and restoration.

Retest status: reproduced against current code; no repair made by this read-only reviewer.

### P2: the library backup omits uploaded images

Affected paths: `src/routes/library.tsx:105–119`, `src/lib/page-settings.ts:16`, `src/lib/library.ts:26`.

Reproduction: store a valid embedded PNG under `focus:page-image:<sha256>`, create a library entry referencing that ID, serialize the same `{ version: 1, entries }` shape used by **Back up library**, clear the asset storage, then parse the backup.

Expected: a library backup either preserves referenced images or explicitly limits itself to design metadata. Observed:

```json
{"originalImagePresent":true,"restoredEntries":1,"retainedImageId":true,"restoredImagePresent":false,"backupContainsImageBytes":false}
```

Cause: images occupy separate local-storage keys; the backup includes only library entries. This matters more for image-led compositions because restoring the saved metadata cannot recover the page's main visual.

Recommended fix: export the deduplicated set of referenced image assets with a validated restore format, including assets retained by saved versions. Validate MIME, bytes, size, and digest before restoring. Alternatively, rename and explain the action as a metadata export and direct users to the authored source ZIP for current-page image preservation. Do not label metadata-only output a complete backup.

Retest status: the data-loss boundary was reproduced locally; no app restore UI or live cloud service was used.

### P2: navigation and experience edits do not invalidate the saved-work marker

Affected paths: `src/lib/ux.ts:4–22`, advanced navigation/experience controls and export status in `src/routes/index.tsx`.

Reproduction: compute `savedHash = workHash(state)`, then change `nav` from `top-menu` to `bottom-tabs`, or change `purpose.experience` from `website` to `app`. Execute `workHash()` and `hasUnsavedWork()` on the changed state.

Expected: a material decision that changes the exported specification requires preservation again. Observed for both cases: `hashChanged: false`, `unsaved: false`.

Cause: `WorkState` and `workHash()` omit navigation and purpose. Launch evidence already includes navigation and experience, so its artifact identity is more complete than the unsaved-work identity.

Recommended fix: use a shared canonical definition of meaningful design state, or add the export-affecting navigation/purpose fields to the work hash and undo keys. Preserve compatibility by treating older saved hashes as needing one fresh export. Test both the helper and the reset/leave warning after changing these controls.

Retest status: reproduced by executing the current helper; no repair made.

### P2: account-save status overstates image preservation

Affected paths: `src/lib/projects.ts:7–10`, `src/routes/index.tsx:289–297`, image-storage help in `src/components/AuthoredPagePanel.tsx`.

Reproduction: run the actual `saveProject()` with an isolated Supabase stub capturing its payload, using a state with a valid image reference. The payload contains `page.imageId` but no image bytes; reading that ID after clearing the browser asset storage returns `null`.

Expected: the save status distinguishes account-retained design metadata from image bytes retained only in this browser. Observed: `save()` sets the whole `savedHash` and says **Saved to your account** after the metadata-only operation.

Cause: the account serializer and preservation status predate local image assets. The image editor does disclose local storage, so lack of asset synchronization itself is a known scope limitation; the defect is the unqualified complete-save marker.

Recommended fix: say that design settings were saved while the image remains local, and keep whole-project preservation pending until an image-bearing ZIP succeeds. Asset sync is an alternative only if deliberately designed and authorized. Do not change the database as an incidental fix.

Retest status: local payload proof only. Real cloud behavior, authentication, and server storage were not exercised.

## Integration constraints for two new compositions

1. **Register each composition at every boundary.** Today the union in `authored-page.ts`, renderer allowlist and layout map, `normalizePageSettings()` allowlist, and `COMPOSITIONS` in `AuthoredPagePanel.tsx` each list three choices. Executing both new names against the current code returns `studio` from normalization and rendering. That is correct handling of an unknown value today, not a current defect. Extend all registrations together, preferably from one shared data definition. Prove selection → reload → library reopen → undo/redo → ZIP preservation for each new name.

2. **Treat the content model honestly.** `Content` supplies a brand, headline, supporting text, one CTA label, title/body feature rows, and an optional quote. `PageSettings` supplies one destination and one image. It does not contain article URLs, bylines, publication dates, per-story images, product specifications, or multiple independent destinations. A journal treatment can organize these real words differently; it must not fabricate news metadata or add dead “read story” controls. If richer content becomes necessary, add validated editable fields and carry them through persistence, exports, version identity, and launch identity.

3. **Preserve both delivery formats.** Standalone `html` embeds CSS; `files["index.html"]` links to the identical `styles.css`. Source ZIP adds `focus-project.json` and the current embedded image. A new renderer branch must reach both formats, preserve the same body content, and remain editable after extraction. The project JSON is currently source for engineering handoff, not an in-app restore format; no importer exists. Do not present it as a tested round-trip restore until one is implemented.

4. **Do not infer image-overlay contrast from token contrast.** Current text sits on controlled solid surfaces and the renderer corrects foreground contrast. An image-led layout with text over arbitrary uploads changes that assumption. Use a solid backing or verify the actual composite; otherwise the contrast remains unmeasured. Keep meaningful image descriptions, dimension/aspect-ratio reservation, safe local raster handling, and a useful no-image layout. Current file limit is 750 KB; do not silently require large photographic assets to make the composition usable.

5. **Keep new layout decisions in existing state and identity boundaries.** Page settings are included in undo steps, work hashes, project-state export, and full launch fingerprints. The panel is keyed by library ID and cancels uploads on unmount. Preserve those behaviors. If a composition adds a separate settings object, remember to include it in each boundary rather than keeping it in transient component state.

6. **Keep behavior real and measurable.** Current exports have no script runtime: native anchors and disclosures provide their interactions. New menus, searches, filters, carousels, or article actions require implemented behavior and task tests. A static reference-informed layout does not imply those application functions exist. Avoid autoplay, and retain reduced-motion, forced-colors, text expansion, long-word wrapping, focus visibility, and actual 320 CSS pixel checks.

7. **Verify new outputs separately.** The existing authored-page browser receipts cover the three existing compositions. They cannot substantiate newly added Showcase/Journal layouts. Run each new output with absent image, real local image, minimal content, eight long features, large text/spacing, dark and light palettes, keyboard navigation, and editable-source extraction. Verify actual viewport width; the studio's narrow preview can shrink below the button's nominal 320 px label on a small host screen.

## Rejected or bounded hypotheses

- The previously reported disconnected source stylesheet is fixed: editable HTML now links to `styles.css`; standalone HTML intentionally embeds it.
- Omitted optional effects are now disclosed in readiness notes and source README. Their absence is a documented rendering choice, not a hidden exact-match claim.
- The previous upload-after-unmount race is guarded and has an affected regression test. No new cross-design upload defect was proved in this pass.
- Previous token-only launch identity has been replaced with the supplied artifact identity, including content/page/navigation/experience; affected tests cover invalidation and stale asynchronous completion.
- Owner copy is escaped, action protocols are restricted, and normal UI uploads verify MIME signatures and decode before storage. Existing tests exercise those boundaries. This does not certify every future renderer branch or source importer.
- No judgment of Audi.com/Firehouse.com visual similarity, original asset rights, or reviewer indistinguishability was made by this architecture review.

## Verification and delivery verdict

Acceptance: review the current integration boundaries without changing application source; distinguish proved defects from constraints.

Evidence: `npx vitest run src/test/authored-page.test.ts src/test/authored-page-panel.test.tsx src/test/page-settings.test.ts src/test/undo-versions.test.ts src/test/launch-panel.test.tsx src/test/launch.test.ts`; local esbuild bundles executed the original persistence, normalization, renderer, and work-status helpers; an independent isolated payload test inspected `saveProject()` without network calls.

Observed: **67 tests passed across 6 files**. Three persistence reproductions above were independently executed; the account payload case was executed by the delegated reviewer. Passing existing tests does not refute defects those tests do not cover.

Changed surface: only this review document. No application fixes, optimizations, hosted mutations, or deployments were performed by this reviewer.

Not verified: new compositions before implementation; live cloud saves/restores; full backup UI round trip; external destination operation; visual reference fidelity; representative human evaluation. Full build/lint were not rerun because this assignment changes no application code and the primary agent owns the active implementation verification.

Verdict: the existing renderer can support additional compositions, provided the registration/content/delivery contracts are kept intact. The four verified preservation issues remain open at the time of this review. No claim of completed new layouts or human-equivalent output is supported by this review.
