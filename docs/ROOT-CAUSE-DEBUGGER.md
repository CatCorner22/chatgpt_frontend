# Root Cause Debugger — Focus

## 1. Problem statement and impact

The owner explicitly requested Root Cause Debugger, then Voice of Customer and Four Lens Build. No new production incident or error message was supplied. **Assumed scope:** verify the current local app's preservation and customer-handoff guarantees, and fix reproduced failures under the existing authorization to fix code while working.

Four failure groups were reproduced with synthetic inputs in isolated browser contexts: damaged Undo/Redo history could be silently discarded; library autosave discarded imported timelines and repeat restore could duplicate unchanged designs; transfer validation both rejected supported legacy state and accepted unusable state; stored-image corruption could yield a broken or omitted image while export was acknowledged. Frequency in real customer data is **unknown**. Impact is loss of recoverable history, blocked or confusing handoff, and falsely complete output.

## 2. Environment and evidence preserved

Baseline commit: `2e2f75e865b50214bdc79169c77386ddca602afb`. Node 24.22.1, npm 11.9.0, Linux; Chromium and Firefox are installed. Initial browser reproductions used the existing built Worker at `http://localhost:4173`. Changes were first checked against development port 3000 before the final production integration.

Before/after fixtures, result JSON, failing test output and independent reviews are retained under `artifacts/root-cause-debugger/`. Original failing records remain separate from passing results. No real customer browser profile, cloud account, paid provider, production data or external message was used.

## 3. Reproduction status

| Failure | Discriminating reproduction | Baseline observation |
|---|---|---|
| Damaged timeline entry | Change only a saved snapshot's `content.features` from an array to `null` | Valid control retains one entry; damaged case retains zero, with no original recovery copy. |
| Damaged timeline container | Change only `past` to `null`, or `future` to an object | Original was quarantined, but valid current words were replaced by the empty fallback. Independently reproduced by the Four Lens reviewer. |
| Imported timeline | Compare full valid state with and without one past/future snapshot; import, open, repeat import | With history, library timeline becomes empty and a second design appears. No-history control remains one design. |
| Legacy/default identity | Import a supported legacy state missing modern defaults, open, repeat unchanged import | Migration adds defaults; raw representation comparison treats the same work as a conflict. |
| Transfer contract | Remove only optional legacy pick `reason`; separately supply `quick: "yes"` | Valid legacy backup is rejected; invalid runtime state is accepted by restore. |
| Stored image | Change only stored bytes: absent, bad signature, signature-only, digest mismatch; keep a valid image control | Bad data can be omitted or break rendering, yet ZIP export is acknowledged. Missing-asset control already avoided acknowledgement. |
| Missing image description | Select a valid image, leave its description empty, download | Renderer omits the selected image even though the ZIP is offered. Explicitly removing the image is the supported text-only alternative. |

## 4. Timeline and recent-change context

The preceding pass verified local creation, ordinary image transfer, recovery and customer ZIPs. These checks did not cover every representation of damaged nested history, supported legacy defaults or browser-storage asset corruption. This pass preserved that release as the baseline, introduced controlled failing cases, implemented narrow corrections, and added those cases to reusable tests. Customer and independent code perspectives were applied before the integrated completion gate.

## 5. Ranked hypothesis matrix

| Hypothesis | Supporting evidence | Contradicting evidence / control | Status |
|---|---|---|---|
| Loss occurs in history migration rather than JSON parsing | `migrate` catches snapshot failures and filters them; no original copy follows a successful top-level parse | Current content and JSON stay valid; one damaged nested field changes the outcome | **Verified cause** |
| Malformed timeline containers invalidate the whole current design | Strict current-state validation runs before timeline repair | Same current words/tokens survive when the container is an array | **Verified neighboring cause**, fixed without relaxing other import entry points |
| Timeline loss is caused by asset decoding or restore writes | Import initially retains the timeline | Opening triggers `libState` removal of `past`/`future`; no image is needed to reproduce | Rejected; **archive projection** is the cause |
| Repeat import reflects genuinely changed work | Conflict behavior is appropriate for real edits | Opening alone or adding migration defaults changes identity; no owner edit occurs | Rejected; **inconsistent normalization** is the cause |
| Legacy transfer failures come from storage quota | Restore fails before writing | Supplying only `reason: ""` makes the same state pass | Rejected; **divergent validation contracts** are the cause |
| Upload validation is responsible for corrupt image output | Image output is broken | Valid upload path works; changing persisted bytes after upload reproduces the issue | Rejected; **stored bytes were trusted without full validation** |
| File signature alone proves an image is usable | Some raster signatures are recognized | Signature-only data with matching hash cannot decode | Rejected; bytes, identity and actual decoding are all required |

## 6. Root cause or unresolved causal set

The common boundary problem was disagreement between representations: migration and preservation, current state and archived state, transfer and runtime validation, stored asset strings and usable exported images. This is a causal description of the reproduced cases, not a claim that every app defect shares one cause.

See the detailed [image investigation](../artifacts/root-cause-debugger/HANDOFF-ROOT-CAUSE.md), [transfer investigation](../artifacts/root-cause-debugger/library-transfer/AFTER-FIX.md), and [independent review](../artifacts/root-cause-debugger/four-lens-review.md). No broader unresolved incident is inferred from these fixtures.

## 7. Targeted correction

- Preserve the exact original save before lossy history repair. Keep valid current work; if preservation fails, block replacement and offer original download and retry.
- Retain bounded past/future timelines in library autosaves. Compare transferred work using the same migration semantics as the Studio, while keeping genuinely different history distinct.
- Default supported legacy fields and apply the runtime state validator to every decoded transfer state before any storage write.
- Validate stored image bytes, canonical encoding, raster type, size, digest and actual decoding before preview or download. Keep original bytes intact and offer replacement or explicit removal. Require a description for a selected image before customer download.
- Explain download choices before delivery, name the original browser for old backups, and give actionable rejection and recovery messages.

## 8. Regression and validation evidence

Final source validation passed: **479 tests across 52 files**, `npx tsc --noEmit`, scoped ESLint and `npm run build`. The same extracted source passed `npm ci`, all 479 tests, type checking and production build independently. All **359 source/configuration files** matched that installation byte-for-byte.

| Acceptance | Executed evidence | Observed final result |
|---|---|---|
| Preserve valid current work and exact damaged originals | `scripts/test-studio-recovery.mjs` at 4173 in Chromium and Firefox | 11/11 scenarios per engine; includes damaged entries/containers, unavailable storage, download, retry and reload |
| Retain history and avoid false copies/revisions | `scripts/test-history-transfer.mjs` at 4173 in both engines | Four fixture shapes stay one design with zero false versions; actual Undo/Redo works |
| Match supported legacy and runtime validation | `library-transfer/validation-browser.mjs` at 4173 in both engines | Legacy export and neighboring restore pass; unusable import leaves original bytes unchanged |
| Do not hand off an unusable chosen image | `handoff-image-validation.mjs` at 4173 in both engines | Eight controls per engine pass; valid/invalid bytes, identity, decoding, description, explicit removal and replacement |
| Preserve ordinary creation, backup and recovery | `browser-smoke.mjs`, `test-library-transfer.mjs` in both engines | Passed; no page errors or local-flow server-function requests |
| Customer can use actual delivered files independently | `test-customer-handoff.mjs` against the fresh production installation at 4284 | All five actual UI ZIPs per engine pass; content/image, edits, native interactions, 320px and standalone visual parity |
| Customer understands the file and next step | `CUSTOMER-GUIDANCE.json` and screenshot | Actual archival JSON safely rejected; actionable explanation; original browser and download choices visible |
| Independent four-lens review | `four-lens-review.md` | 123 affected/neighbor tests and exact previously failing legacy flow passed; no remaining bounded blocker |

Evidence logs and per-engine JSON are under `artifacts/root-cause-debugger/`; customer ZIPs and screenshots remain in `artifacts/customer-handoff/`. Original failed controls are retained separately. A pre-existing revision test used unsupported object navigation values; it was corrected to actual `NavId` strings, its original behavioral assertions retained, and a navigation-only regression added. No failing requirement was removed.

## 9. Residual uncertainty and monitoring

The original deployed customer environment was not available; the exact baseline local build and synthetic data conditions were reproduced. Actual failure prevalence is unknown. One independent development-browser initial-status wait timed out; a fresh diagnostic and the complete exact rerun passed. No cause was established for that isolated timeout; it remains recorded rather than attributed to the app or tooling without evidence. Public deployment, live Supabase/cloud synchronization, paid AI, Safari/iOS, mobile hardware, full screen-reader tasks and human-equivalence studies remain unverified. Web Storage does not provide atomic transactions across simultaneous tabs. Actual UI Undo/Redo verification covers the app’s flat timeline. The nested-history identity regression proves that distinct accepted data is not silently conflated; it does not establish nested Undo navigation. The tests check only fixture destinations and do not contact a customer's real email, booking or payment service.

Monitor reported failed restores and damaged-asset messages when a real deployment is operated; retain the customer's original backup before investigation. No telemetry collection or external monitoring was enabled here.

## 10. Prevention recommendations

Keep runtime and transfer migration semantics shared. Retain the new malformed-history, legacy, repeat-import and stored-image regressions alongside the normal customer ZIP tests. Before changing persistence or export code, run the receiving customer's complete path as well as the editor path. Preserve unknowns and failure states rather than interpreting a successful download as proof that every intended asset was delivered.

## Voice of Customer and Four Lens acceptance

**Real evidence:** the owner requires stability from launch, fixes during development, thorough testing and deliberate customer handoff. **Assumed perspectives:** a nontechnical owner returning on laptop/phone, and a recipient with basic HTML skills using a fresh browser. These are modeled reviews, not customer interviews or research findings.

| Customer / starting state | Step and expectation | Observed issue | Severity | Response |
|---|---|---|---|---|
| Owner with a rejected backup | Understand the next action and whether current work is safe | Technical generic error lacked guidance | Friction | Actionable backup-selection message and unchanged-work reassurance |
| Owner moving an old backup | Find the source of missing image files | “Where those images still exist” was ambiguous | Friction | Name the original browser and create a new complete backup there |
| Recipient choosing downloads | Distinguish a standalone page, editable source and a Focus backup | Explanation was easiest to find after downloading | Friction | Explain the three choices next to download controls |
| Recipient restoring work | Open, reload, Undo/Redo, repeat unchanged import | Timeline loss and false duplicates | Blocker | Retain history and share migration-based identity |
| Recipient receiving an image page | Chosen image must actually work, or delivery must stop with a repair path | Damaged/missing-description image could yield partial output | Blocker | Validate, block incomplete delivery, replace/describe/remove actions |

Customer done-when ledger: current words survive history repair; recovery download equals the original; valid legacy backup restores; invalid backup changes nothing; imported Undo/Redo survives return; unchanged repeat import stays one design; chosen images are usable in downloaded pages; artifact choices and recovery next steps are visible. All listed done-when criteria passed in the recorded production and fresh-install checks above. Customer perspectives remain assumed; these results are observed task checks, not research interviews.

Four Lens coverage: work backward from those results; establish state/asset contracts before rendering and storage writes; review ownership, async state and failure propagation; inspect each changed branch and compare before/after evidence. The independent judge's report separates verified blockers from assumptions.


## Completion evidence gate

Acceptance: preserve usable work and recoverable originals, make supported transfers repeatable, and deliver complete customer pages with clear choices.
Evidence: the final commands, before/after controls, browser interactions, source manifest and package integrity record listed above.
Observed: all scoped final checks passed; the isolated development timeout remains disclosed without an invented cause.
Changed surface: shared Studio migration, recovery, library/version identity, transfer validation, persisted-image validation, download gating and customer guidance.
Not verified: external-service, browser/hardware, nested-navigation and human-study limits in section 9.
Verdict: confirmed causes fixed and regression-verified in the local production build and fresh customer installation. Public deployment is not certified by these tests.
