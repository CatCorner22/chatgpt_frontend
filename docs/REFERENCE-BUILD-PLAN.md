# Reference-informed Focus pass

## Outcome and actors
A signed-out owner can choose a page structure suited to an image-led brand or a content-rich publication, keep their words/assets through revisions, and deliver a working page with trustworthy check results. Actors: owner, exported-page visitor, reviewer, receiving developer. Audi.com and Firehouse.com are inspiration references, not benchmark equivalents or copied assets.

## Lifecycle coverage
| Stage | Coverage | This pass |
|---|---|---|
| Discover / Enter | covered | Existing local studio; extend composition choices in final working-page editor. |
| Trust | covered | State reference scope, local image storage, static output, and audit limitations. |
| Configure / Create | covered | Current content/image schema; two additional compositions change layout without replacing content. |
| Review / Approve | covered | Owner reviews exact exported document; automated findings keep unknowns explicit; existing blinded-review room remains. |
| Deliver / Handoff | covered | Standalone HTML and linked CSS ZIP; project JSON retains owner inputs. No production deployment. |
| Confirm | covered | Verify downloaded files, native links, and offline rendering in actual browser. |
| Correct | covered | Versions and undo capture content/page/navigation changes, with meaningful typing-burst snapshots. |
| Operate | covered | Local audit CLI and stored receipts; no external monitoring promise. |
| Recover | covered | Image-complete library backups; original-byte recovery copies; visible blocked-storage recovery; accurate cloud image scope. Final integrated evidence is in LAUNCH-READINESS.md. |
| Exit | covered | Portable exports remain owned by the user; no new service or account. |

## Artifact handoff
| Artifact | Owner / format | Delivery / acknowledgement | Correction / retention |
|---|---|---|---|
| Working page | owner; HTML + CSS | browser download, inspect same bytes as preview | revise locally and re-export; user retains files |
| Design state/image | owner; versioned library JSON with embedded rasters, plus source ZIP | backup and validated additive restore; cloud does not carry local raster | browser library versions/undo; recovery copies retain damaged originals before replacement |
| Audit receipt | owner; bounded JSON + screenshots | run CLI, import receipt in Quality lab | rerun after change; no 'fixed' result for missing/contradictory evidence |
| Reference observations | development evidence; screenshots/notes | local artifacts and comparison document | capture date and limits; no reference artwork/fonts in output |

## Decisions / sequence
1. Preserve verified existing app and kit; compare uploaded Lovable kit and judge report by behavior, not matching names alone.
2. Reproduce and fix audit/repair false-success paths, and work-preservation bugs.
3. Add original Showcase and Journal compositions with native section navigation and robust missing-image layouts. Current tokens and owner content stay authoritative.
4. Make editing and image-description requirements clear in the UI.
5. Test actual export, recovery and 320px/768px/1440px layouts; refresh portable package and evidence.

## Acceptance ledger
- passed: new choices survive save/reload and render distinct structure without invented dates, categories, proof or brand assets (`artifacts/PRODUCTION-AUTHORED.txt`).
- passed: section links move keyboard focus; supplied content appears in output; missing content/image remains useful (`artifacts/reference-layouts/RESULTS.json`, 34 scenarios).
- passed: layout/content/navigation revisions are recoverable and invalidate preserved-work status (`src/test/undo-versions.test.ts`, `src/test/account-save.test.ts`).
- passed: image upload failure retains the prior image; required description and editor focus work (`artifacts/PRODUCTION-EDITOR.txt`).
- passed: hostile runtime, contradictory findings and unknown rule IDs retain honest evidence limits (`docs/DEVIN-BROWSER-TRIAGE.md`, kit isolated-copy evidence).
- final gate: production creation/preservation/recovery in both browsers, full tests, static checks, and ZIP integrity are recorded in `docs/LAUNCH-READINESS.md` and `artifacts/VERIFICATION.json`.
- not claimed: general frontend human equivalence, full publishing/CMS, or independent study outcomes.
